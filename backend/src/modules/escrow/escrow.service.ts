import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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

  async getDeal(id: string) {
    const deal = await this.prisma.escrowDeal.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Escrow deal not found');
    return deal;
  }

  async getTimeline(id: string) {
    return this.prisma.escrowStatusHistory.findMany({
      where: { escrowId: id },
      orderBy: { changedAt: 'asc' }
    });
  }

  // Idempotent Fund Webhook (triggered by PSP)
  async fundEscrow(id: string, expectedVersion: number, providerTxId: string) {
    return this.transitionStatus(id, EscrowStatus.FUNDED, expectedVersion, 'PSP_FUNDED_WEBHOOK', async (tx, deal) => {
      await tx.paymentTransaction.create({
        data: {
          escrowId: id,
          intentType: 'CHARGE',
          status: 'SUCCESS',
          amount: deal.totalEscrowed, // Use actual escrowed amount for accurate payment records
          providerTxId: providerTxId,
          idempotencyKey: `charge_${providerTxId}`,
        }
      });
    });
  }

  // Notify seller that payment is confirmed and shipment is required (FUNDED → AWAITING_SELLER_ACTION)
  async notifySeller(id: string, expectedVersion: number) {
    return this.transitionStatus(id, EscrowStatus.AWAITING_SELLER_ACTION, expectedVersion, 'SELLER_NOTIFIED');
  }

  async confirmShipment(id: string, expectedVersion: number) {
    return this.transitionStatus(id, EscrowStatus.SHIPPED, expectedVersion, 'SELLER_MARKED_SHIPPED');
  }

  // Marks item as physically delivered; transitions to AWAITING_BUYER_CONFIRMATION
  async markDelivered(id: string, expectedVersion: number) {
    return this.transitionStatus(id, EscrowStatus.AWAITING_BUYER_CONFIRMATION, expectedVersion, 'DELIVERY_NOTIFICATION');
  }

  // Buyer explicitly confirms receipt and releases funds (AWAITING_BUYER_CONFIRMATION → COMPLETED)
  async releaseFunds(id: string, expectedVersion: number) {
    return this.transitionStatus(id, EscrowStatus.COMPLETED, expectedVersion, 'BUYER_CONFIRMED_RECEIPT');
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
   * The core generic atomic transition wrapper.
   * Guarantees all valid state transitions and prevents concurrent mutations.
   * sideEffect receives the transaction client AND the current deal snapshot.
   */
  private async transitionStatus(
    escrowId: string,
    targetStatus: EscrowStatus,
    expectedVersion: number,
    triggerEvent: string,
    sideEffect?: (tx: any, deal: any) => Promise<void>,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const deal = await tx.escrowDeal.findUnique({ where: { id: escrowId } });
      if (!deal) throw new BadRequestException('Escrow deal not found');

      EscrowEngine.checkOptimisticLock(deal as any, expectedVersion);

      try {
        EscrowEngine.validateTransition(deal.status, targetStatus);
      } catch(e) {
        throw new BadRequestException(e.message);
      }

      if (sideEffect) await sideEffect(tx, deal);

      const updatedDeal = await tx.escrowDeal.update({
        where: { id: deal.id },
        data: {
          status: targetStatus,
          version: { increment: 1 },
        },
      });

      await tx.escrowStatusHistory.create({
        data: {
          escrowId: deal.id,
          previousStatus: deal.status,
          newStatus: targetStatus,
          triggerEvent: triggerEvent,
        },
      });

      return updatedDeal;
    });

    // Publish domain event AFTER successful DB commit
    await this.rabbitMQ.publishEvent(`escrow.${targetStatus.toLowerCase()}`, {
      escrowId: result.id,
      newStatus: result.status,
      timestamp: new Date().toISOString(),
      trigger: triggerEvent,
    });

    return result;
  }
}

