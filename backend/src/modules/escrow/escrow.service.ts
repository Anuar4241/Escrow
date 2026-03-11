import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EscrowEngine, EscrowStatus, EscrowTransitionException } from '../../domain/escrow/escrow.engine';
import { RabbitMQService } from '../../infrastructure/messaging/rabbitmq.service';

@Injectable()
export class EscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMQ: RabbitMQService,
  ) {}

  async createEscrow(data: { orderId: string; buyerId: string; sellerId: string; amount: number; txFee: number }) {
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.escrowDeal.create({
        data: {
          orderId: data.orderId,
          buyerId: data.buyerId,
          sellerId: data.sellerId,
          amount: data.amount,
          applicationFee: data.txFee,
          totalEscrowed: data.amount + data.txFee,
          status: EscrowStatus.AWAITING_PAYMENT, // Skipping Draft/Created for MVP demo ease
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days to pay
        }
      });

      await tx.escrowStatusHistory.create({
        data: {
          escrowId: deal.id,
          newStatus: EscrowStatus.AWAITING_PAYMENT,
          triggerEvent: 'DEAL_CREATED',
        }
      });

      return deal;
    });
  }

  async getTimeline(id: string) {
    return this.prisma.escrowStatusHistory.findMany({
      where: { escrowId: id },
      orderBy: { changedAt: 'asc' }
    });
  }

  // Idempotent Fund Webhook (triggered by PSP)
  async fundEscrow(id: string, expectedVersion: number, providerTxId: string) {
    return this.transitionStatus(id, EscrowStatus.FUNDED, expectedVersion, 'PSP_FUNDED_WEBHOOK', async (tx) => {
      await tx.paymentTransaction.create({
        data: {
          escrowId: id,
          intentType: 'CHARGE',
          status: 'SUCCESS',
          amount: 0, 
          providerTxId: providerTxId,
          idempotencyKey: `charge_${providerTxId}`,
        }
      });
    });
  }

  async confirmShipment(id: string, expectedVersion: number) {
    return this.transitionStatus(id, EscrowStatus.SHIPPED, expectedVersion, 'SELLER_MARKED_SHIPPED');
  }

  async confirmDelivery(id: string, expectedVersion: number) {
    return this.transitionStatus(id, EscrowStatus.AWAITING_BUYER_CONFIRMATION, expectedVersion, 'BUYER_CONFIRMED_DELIVERY');
  }

  async releaseFunds(id: string, expectedVersion: number) {
    return this.transitionStatus(id, EscrowStatus.COMPLETED, expectedVersion, 'BUYER_RELEASE_FUNDS');
  }

  async openDispute(id: string, expectedVersion: number, reason: string, openedById: string) {
    return this.transitionStatus(id, EscrowStatus.DISPUTE_OPENED, expectedVersion, 'DISPUTE_CREATED', async (tx) => {
      await tx.disputeCase.create({
        data: {
          escrowId: id,
          openedById,
          reason,
        }
      });
    });
  }

  /**
   * The core generic atomic transition wrapper
   * Guarantees all valid states and locks execution.
   */
  private async transitionStatus(
    escrowId: string, 
    targetStatus: EscrowStatus, 
    expectedVersion: number, 
    triggerEvent: string,
    sideEffect?: (tx: any) => Promise<void>
  ) {
    // 1. Transactional Database update
    const result = await this.prisma.$transaction(async (tx) => {
      const deal = await tx.escrowDeal.findUnique({ where: { id: escrowId } });
      if (!deal) throw new BadRequestException('Escrow deal not found');

      // Guard Concurrency
      EscrowEngine.checkOptimisticLock(deal as any, expectedVersion);

      // Guard Domain Rules
      try {
        EscrowEngine.validateTransition(deal.status, targetStatus);
      } catch(e) {
        throw new BadRequestException(e.message);
      }

      // Optional Side Effects
      if (sideEffect) await sideEffect(tx);

      // Update deal version and status atomically
      const updatedDeal = await tx.escrowDeal.update({
        where: { id: deal.id },
        data: {
          status: targetStatus,
          version: { increment: 1 }
        }
      });

      // Append immutable Audit log
      await tx.escrowStatusHistory.create({
        data: {
          escrowId: deal.id,
          previousStatus: deal.status,
          newStatus: targetStatus,
          triggerEvent: triggerEvent,
        }
      });

      return updatedDeal;
    });

    // 2. Publish Domain Event outbox AFTER successful DB commit
    await this.rabbitMQ.publishEvent(`escrow.${targetStatus.toLowerCase()}`, {
      escrowId: result.id,
      newStatus: result.status,
      timestamp: new Date().toISOString(),
      trigger: triggerEvent,
    });

    return result;
  }
}

