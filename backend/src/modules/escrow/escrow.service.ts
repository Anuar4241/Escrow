import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EscrowDeal, Prisma } from '@prisma/client';
import { AuthUser } from '../../auth/auth-user';
import {
  EscrowEngine,
  EscrowStatus,
  EscrowTransitionException,
} from '../../domain/escrow/escrow.engine';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BankWebhookDto } from '../webhooks/dto/bank-webhook.dto';
import {
  ConfirmShipmentDto,
  CreateEscrowDto,
  DisputeOutcome,
  OpenDisputeDto,
  ResolveDisputeDto,
} from './dto/escrow.dto';
const BANK_PROVIDER = 'sandbox-bank';
const PRIVILEGED_ROLES = ['MODERATOR', 'ADMIN'] as const;
@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService,
  ) {}
  createEscrow(data: CreateEscrowDto, actor: AuthUser) {
    if (actor.id === data.sellerId)
      throw new BadRequestException('Buyer and seller must be different users');
    const amount = new Prisma.Decimal(data.amount);
    if (amount.lte(0) || amount.gt(new Prisma.Decimal('100000000')))
      throw new BadRequestException(
        'Escrow amount must be between 0 and 100,000,000 KZT',
      );
    const applicationFee = amount
      .mul(this.config.getOrThrow<number>('ESCROW_FEE_BPS'))
      .div(10_000)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const totalEscrowed = amount.add(applicationFee);
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: [actor.id, data.sellerId] } },
      });
      const buyer = users.find((u) => u.id === actor.id);
      const seller = users.find((u) => u.id === data.sellerId);
      if (!buyer || !seller)
        throw new NotFoundException(
          'Buyer or seller identity is not synchronized',
        );
      if (buyer.kycStatus !== 'CLEARED' || seller.kycStatus !== 'CLEARED')
        throw new ForbiddenException(
          'Both parties must pass KYC before escrow creation',
        );
      const deal = await tx.escrowDeal.create({
        data: {
          orderId: data.orderId,
          buyerId: actor.id,
          sellerId: data.sellerId,
          amount,
          applicationFee,
          totalEscrowed,
          currency: data.currency,
          status: EscrowStatus.AWAITING_PAYMENT,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          termsSnapshot: {
            create: {
              listingStateAtPurchase:
                data.listingState as Prisma.InputJsonValue,
              agreementFlags: data.agreementFlags as Prisma.InputJsonValue,
            },
          },
        },
      });
      await tx.escrowStatusHistory.create({
        data: {
          escrowId: deal.id,
          newStatus: deal.status,
          triggerEvent: 'DEAL_CREATED',
          actorId: actor.id,
        },
      });
      await this.outbox.enqueue(tx, {
        aggregateType: 'escrow',
        aggregateId: deal.id,
        eventType: 'escrow.created',
        payload: this.eventPayload(deal, 'DEAL_CREATED'),
      });
      return deal;
    });
  }
  async getDeal(id: string, actor: AuthUser) {
    const deal = await this.requireDeal(id);
    this.assertParticipant(deal, actor);
    return deal;
  }
  listDeals(actor: AuthUser) {
    return this.prisma.escrowDeal.findMany({
      where: this.isPrivileged(actor)
        ? undefined
        : { OR: [{ buyerId: actor.id }, { sellerId: actor.id }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
  async getTimeline(id: string, actor: AuthUser) {
    const deal = await this.requireDeal(id);
    this.assertParticipant(deal, actor);
    return this.prisma.escrowStatusHistory.findMany({
      where: { escrowId: id },
      orderBy: { changedAt: 'asc' },
    });
  }
  confirmShipment(id: string, data: ConfirmShipmentDto, actor: AuthUser) {
    return this.mutate(
      id,
      data.expectedVersion,
      EscrowStatus.SHIPPED,
      'SELLER_MARKED_SHIPPED',
      actor,
      (d) => this.assertSeller(d, actor),
      {
        trackingNumber: data.trackingNumber ?? null,
        carrier: data.carrier ?? null,
      },
    );
  }
  markDelivered(id: string, expectedVersion: number, actor: AuthUser) {
    return this.mutate(
      id,
      expectedVersion,
      EscrowStatus.AWAITING_BUYER_CONFIRMATION,
      'BUYER_REPORTED_DELIVERY',
      actor,
      (d) => this.assertBuyer(d, actor),
    );
  }
  releaseFunds(id: string, expectedVersion: number, actor: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const deal = await this.requireDealInTransaction(tx, id);
      this.assertBuyer(deal, actor);
      const completed = await this.applyTransition(
        tx,
        deal,
        EscrowStatus.COMPLETED,
        expectedVersion,
        'BUYER_CONFIRMED_RECEIPT',
        actor.id,
      );
      const approved = await this.applyTransition(
        tx,
        completed,
        EscrowStatus.PAYOUT_APPROVED,
        completed.version,
        'PAYOUT_REQUESTED',
        actor.id,
      );
      await this.outbox.enqueue(tx, {
        aggregateType: 'escrow',
        aggregateId: approved.id,
        eventType: 'bank.payout.requested',
        payload: {
          escrowId: approved.id,
          amount: approved.amount.toString(),
          currency: approved.currency,
          sellerId: approved.sellerId,
        },
      });
      return approved;
    });
  }
  cancel(id: string, expectedVersion: number, actor: AuthUser) {
    return this.mutate(
      id,
      expectedVersion,
      EscrowStatus.CANCELLED,
      'BUYER_CANCELLED_BEFORE_PAYMENT',
      actor,
      (d) => this.assertBuyer(d, actor),
    );
  }
  openDispute(id: string, data: OpenDisputeDto, actor: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const deal = await this.requireDealInTransaction(tx, id);
      this.assertParticipant(deal, actor);
      const updated = await this.applyTransition(
        tx,
        deal,
        EscrowStatus.DISPUTE_OPENED,
        data.expectedVersion,
        'DISPUTE_OPENED',
        actor.id,
        { reason: data.reason },
      );
      await tx.disputeCase.create({
        data: {
          escrowId: id,
          openedById: actor.id,
          reason: data.reason,
          evidence: data.evidence as Prisma.InputJsonValue | undefined,
          status: 'opened',
        },
      });
      return updated;
    });
  }
  resolveDispute(id: string, data: ResolveDisputeDto, actor: AuthUser) {
    if (!this.isPrivileged(actor))
      throw new ForbiddenException('Only a moderator can resolve a dispute');
    return this.prisma.$transaction(async (tx) => {
      let deal = await this.requireDealInTransaction(tx, id);
      let version = data.expectedVersion;
      if (deal.status === String(EscrowStatus.DISPUTE_OPENED)) {
        deal = await this.applyTransition(
          tx,
          deal,
          EscrowStatus.UNDER_REVIEW,
          version,
          'MODERATOR_STARTED_REVIEW',
          actor.id,
        );
        version = deal.version;
      }
      const target =
        data.outcome === 'PAYOUT_SELLER'
          ? EscrowStatus.PAYOUT_APPROVED
          : EscrowStatus.REFUND_APPROVED;
      const resolved = await this.applyTransition(
        tx,
        deal,
        target,
        version,
        `DISPUTE_RESOLVED_${data.outcome}`,
        actor.id,
      );
      await tx.disputeCase.update({
        where: { escrowId: id },
        data: {
          status:
            data.outcome === 'PAYOUT_SELLER'
              ? 'resolved_seller'
              : 'resolved_buyer',
          resolutionNotes: data.resolutionNotes,
          resolvedAt: new Date(),
        },
      });
      await this.enqueueResolution(tx, resolved, data.outcome);
      return resolved;
    });
  }
  async handleBankWebhook(payload: BankWebhookDto, payloadHash: string) {
    const existing = await this.prisma.bankWebhookEvent.findUnique({
      where: {
        provider_eventId: { provider: BANK_PROVIDER, eventId: payload.eventId },
      },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        throw new ConflictException(
          'Bank event ID was reused with another payload',
        );
      return { received: true, duplicate: true, status: existing.status };
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.bankWebhookEvent.create({
          data: {
            provider: BANK_PROVIDER,
            eventId: payload.eventId,
            escrowId: payload.escrowId,
            type: payload.type,
            payload: payload as unknown as Prisma.InputJsonValue,
            payloadHash,
          },
        });
        const deal = await this.requireDealInTransaction(tx, payload.escrowId);
        const amount = new Prisma.Decimal(payload.amount);
        this.assertBankAmount(deal, amount, payload.currency, payload.type);
        let status = deal.status;
        if (payload.type === 'HOLD_SUCCEEDED')
          status = (await this.successfulHold(tx, deal, payload, amount))
            .status;
        else if (payload.type === 'REFUND_SUCCEEDED')
          status = (await this.successfulRefund(tx, deal, payload, amount))
            .status;
        else if (payload.type === 'PAYOUT_SUCCEEDED')
          status = (await this.successfulPayout(tx, deal, payload, amount))
            .status;
        else await this.failedBankTransaction(tx, deal, payload, amount);
        await tx.bankWebhookEvent.update({
          where: { id: event.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
        return { received: true, duplicate: false, status };
      });
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        const duplicate = await this.prisma.bankWebhookEvent.findUnique({
          where: {
            provider_eventId: {
              provider: BANK_PROVIDER,
              eventId: payload.eventId,
            },
          },
        });
        if (duplicate?.payloadHash === payloadHash)
          return { received: true, duplicate: true, status: duplicate.status };
        if (duplicate)
          throw new ConflictException(
            'Bank event ID was reused with another payload',
          );
      }
      await this.recordRejected(payload, payloadHash, error);
      throw error;
    }
  }
  private mutate(
    id: string,
    version: number,
    target: EscrowStatus,
    trigger: string,
    actor: AuthUser,
    authorize: (deal: EscrowDeal) => void,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const deal = await this.requireDealInTransaction(tx, id);
      authorize(deal);
      return this.applyTransition(
        tx,
        deal,
        target,
        version,
        trigger,
        actor.id,
        metadata,
      );
    });
  }
  private async applyTransition(
    tx: Prisma.TransactionClient,
    deal: EscrowDeal,
    target: EscrowStatus,
    expectedVersion: number,
    trigger: string,
    actorId?: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<EscrowDeal> {
    try {
      EscrowEngine.validateTransition(deal.status, target);
    } catch (error) {
      if (error instanceof EscrowTransitionException)
        throw new BadRequestException(error.message);
      throw error;
    }
    const changed = await tx.escrowDeal.updateMany({
      where: { id: deal.id, status: deal.status, version: expectedVersion },
      data: { status: target, version: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new ConflictException(
        'Escrow was changed by another request; reload and retry with the latest version',
      );
    const updated = await tx.escrowDeal.findUniqueOrThrow({
      where: { id: deal.id },
    });
    await tx.escrowStatusHistory.create({
      data: {
        escrowId: deal.id,
        previousStatus: deal.status,
        newStatus: target,
        triggerEvent: trigger,
        actorId,
        metadata,
      },
    });
    await this.outbox.enqueue(tx, {
      aggregateType: 'escrow',
      aggregateId: deal.id,
      eventType: `escrow.${target}`,
      payload: this.eventPayload(updated, trigger),
    });
    return updated;
  }
  private async successfulHold(
    tx: Prisma.TransactionClient,
    deal: EscrowDeal,
    payload: BankWebhookDto,
    amount: Prisma.Decimal,
  ) {
    const funded = await this.applyTransition(
      tx,
      deal,
      EscrowStatus.FUNDED,
      deal.version,
      'BANK_HOLD_SUCCEEDED',
    );
    await this.recordPayment(tx, deal, payload, amount, 'HOLD', 'SUCCESS');
    await tx.ledgerEntry.create({
      data: {
        escrowId: deal.id,
        type: 'ESCROW_FUNDED',
        debitAccount: `bank:clearing:${payload.currency}`,
        creditAccount: `escrow:held:${deal.id}`,
        amount,
        currency: payload.currency,
        reference: payload.providerTransactionId,
        idempotencyKey: `ledger:${BANK_PROVIDER}:${payload.eventId}`,
      },
    });
    return this.applyTransition(
      tx,
      funded,
      EscrowStatus.AWAITING_SELLER_ACTION,
      funded.version,
      'SELLER_ACTION_REQUESTED',
    );
  }
  private async successfulRefund(
    tx: Prisma.TransactionClient,
    deal: EscrowDeal,
    payload: BankWebhookDto,
    amount: Prisma.Decimal,
  ) {
    if (deal.status !== String(EscrowStatus.REFUND_APPROVED))
      throw new BadRequestException('Refund is not approved for this escrow');
    await this.recordPayment(tx, deal, payload, amount, 'REFUND', 'SUCCESS');
    await tx.ledgerEntry.create({
      data: {
        escrowId: deal.id,
        type: 'BUYER_REFUND',
        debitAccount: `escrow:held:${deal.id}`,
        creditAccount: `buyer:receivable:${deal.buyerId}`,
        amount,
        currency: payload.currency,
        reference: payload.providerTransactionId,
        idempotencyKey: `ledger:${BANK_PROVIDER}:${payload.eventId}`,
      },
    });
    return this.applyTransition(
      tx,
      deal,
      EscrowStatus.REFUNDED,
      deal.version,
      'BANK_REFUND_SUCCEEDED',
    );
  }
  private async successfulPayout(
    tx: Prisma.TransactionClient,
    deal: EscrowDeal,
    payload: BankWebhookDto,
    amount: Prisma.Decimal,
  ) {
    if (deal.status !== String(EscrowStatus.PAYOUT_APPROVED))
      throw new BadRequestException('Payout is not approved for this escrow');
    await this.recordPayment(tx, deal, payload, amount, 'PAYOUT', 'SUCCESS');
    await tx.ledgerEntry.create({
      data: {
        escrowId: deal.id,
        type: 'SELLER_PAYOUT',
        debitAccount: `escrow:held:${deal.id}`,
        creditAccount: `seller:receivable:${deal.sellerId}`,
        amount,
        currency: payload.currency,
        reference: payload.providerTransactionId,
        idempotencyKey: `ledger:${BANK_PROVIDER}:${payload.eventId}`,
      },
    });
    if (deal.applicationFee.gt(0))
      await tx.ledgerEntry.create({
        data: {
          escrowId: deal.id,
          type: 'PLATFORM_FEE',
          debitAccount: `escrow:held:${deal.id}`,
          creditAccount: `platform:fee-revenue:${payload.currency}`,
          amount: deal.applicationFee,
          currency: payload.currency,
          reference: payload.providerTransactionId,
          idempotencyKey: `ledger:fee:${BANK_PROVIDER}:${payload.eventId}`,
        },
      });
    return this.applyTransition(
      tx,
      deal,
      EscrowStatus.PAID_OUT,
      deal.version,
      'BANK_PAYOUT_SUCCEEDED',
    );
  }
  private async recordPayment(
    tx: Prisma.TransactionClient,
    deal: EscrowDeal,
    payload: BankWebhookDto,
    amount: Prisma.Decimal,
    intentType: 'HOLD' | 'PAYOUT' | 'REFUND',
    status: 'SUCCESS' | 'FAILED',
  ) {
    await tx.paymentTransaction.create({
      data: {
        escrowId: deal.id,
        intentType,
        status,
        amount,
        currency: payload.currency,
        provider: BANK_PROVIDER,
        providerTxId: payload.providerTransactionId,
        idempotencyKey: `${BANK_PROVIDER}:${payload.eventId}`,
      },
    });
  }
  private async failedBankTransaction(
    tx: Prisma.TransactionClient,
    deal: EscrowDeal,
    payload: BankWebhookDto,
    amount: Prisma.Decimal,
  ) {
    const intentType = payload.type.startsWith('HOLD')
      ? 'HOLD'
      : payload.type.startsWith('PAYOUT')
        ? 'PAYOUT'
        : 'REFUND';
    const required =
      intentType === 'HOLD'
        ? EscrowStatus.AWAITING_PAYMENT
        : intentType === 'PAYOUT'
          ? EscrowStatus.PAYOUT_APPROVED
          : EscrowStatus.REFUND_APPROVED;
    if (deal.status !== String(required))
      throw new BadRequestException(
        `${intentType.toLowerCase()} failure does not match the escrow state`,
      );
    await this.recordPayment(tx, deal, payload, amount, intentType, 'FAILED');
  }
  private async enqueueResolution(
    tx: Prisma.TransactionClient,
    deal: EscrowDeal,
    outcome: DisputeOutcome,
  ) {
    await this.outbox.enqueue(tx, {
      aggregateType: 'escrow',
      aggregateId: deal.id,
      eventType:
        outcome === 'PAYOUT_SELLER'
          ? 'bank.payout.requested'
          : 'bank.refund.requested',
      payload: {
        escrowId: deal.id,
        amount:
          outcome === 'PAYOUT_SELLER'
            ? deal.amount.toString()
            : deal.totalEscrowed.toString(),
        currency: deal.currency,
        beneficiaryId:
          outcome === 'PAYOUT_SELLER' ? deal.sellerId : deal.buyerId,
      },
    });
  }
  private assertBankAmount(
    deal: EscrowDeal,
    amount: Prisma.Decimal,
    currency: string,
    eventType: BankWebhookDto['type'],
  ) {
    if (currency !== deal.currency)
      throw new BadRequestException(
        'Bank event currency does not match escrow',
      );
    const expected = eventType.startsWith('PAYOUT')
      ? deal.amount
      : deal.totalEscrowed;
    if (!amount.equals(expected))
      throw new BadRequestException('Bank event amount does not match escrow');
  }
  private async requireDeal(id: string) {
    const deal = await this.prisma.escrowDeal.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Escrow deal not found');
    return deal;
  }
  private async requireDealInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    const deal = await tx.escrowDeal.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Escrow deal not found');
    return deal;
  }
  private assertParticipant(deal: EscrowDeal, actor: AuthUser) {
    if (
      deal.buyerId !== actor.id &&
      deal.sellerId !== actor.id &&
      !this.isPrivileged(actor)
    )
      throw new ForbiddenException('Escrow is not accessible to this user');
  }
  private assertBuyer(deal: EscrowDeal, actor: AuthUser) {
    if (deal.buyerId !== actor.id && !this.isPrivileged(actor))
      throw new ForbiddenException('Only the buyer can perform this action');
  }
  private assertSeller(deal: EscrowDeal, actor: AuthUser) {
    if (deal.sellerId !== actor.id && !this.isPrivileged(actor))
      throw new ForbiddenException('Only the seller can perform this action');
  }
  private isPrivileged(actor: AuthUser) {
    return actor.roles.some((role) =>
      (PRIVILEGED_ROLES as readonly string[]).includes(role),
    );
  }
  private eventPayload(
    deal: EscrowDeal,
    trigger: string,
  ): Prisma.InputJsonValue {
    return {
      escrowId: deal.id,
      status: deal.status,
      version: deal.version,
      trigger,
      occurredAt: new Date().toISOString(),
    };
  }
  private isUniqueConstraint(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
  private async recordRejected(
    payload: BankWebhookDto,
    payloadHash: string,
    error: unknown,
  ) {
    if (
      !(error instanceof BadRequestException) &&
      !(error instanceof NotFoundException)
    )
      return;
    try {
      await this.prisma.bankWebhookEvent.create({
        data: {
          provider: BANK_PROVIDER,
          eventId: payload.eventId,
          type: payload.type,
          payload: payload as unknown as Prisma.InputJsonValue,
          payloadHash,
          status: 'REJECTED',
          errorMessage: error.message.slice(0, 2000),
          processedAt: new Date(),
        },
      });
    } catch (auditError) {
      if (!this.isUniqueConstraint(auditError))
        this.logger.error(
          `Unable to persist rejected bank event ${payload.eventId}`,
        );
    }
  }
}
