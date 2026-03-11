import { EscrowDeal } from '@prisma/client';

export enum EscrowStatus {
  DRAFT = 'draft',
  CREATED = 'created',
  AWAITING_PAYMENT = 'awaiting_payment',
  FUNDED = 'funded',
  AWAITING_SELLER_ACTION = 'awaiting_seller_action',
  SHIPPED = 'shipped',
  HANDED_OVER = 'handed_over',
  AWAITING_BUYER_CONFIRMATION = 'awaiting_buyer_confirmation',
  COMPLETED = 'completed',
  DISPUTE_OPENED = 'dispute_opened',
  UNDER_REVIEW = 'under_review',
  PAYOUT_APPROVED = 'payout_approved',
  REFUND_APPROVED = 'refund_approved',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export class EscrowTransitionException extends Error {
  constructor(public from: string, public to: string, message?: string) {
    super(`Invalid transition from '${from}' to '${to}'. ${message || ''}`);
    this.name = 'EscrowTransitionException';
  }
}

/**
 * EscrowEngine acts as a highly strict State Machine.
 * It prevents controllers or services from randomly assigning states.
 */
export class EscrowEngine {
  private static readonly transitions = new Map<EscrowStatus, EscrowStatus[]>([
    [EscrowStatus.DRAFT, [EscrowStatus.CREATED]],
    [EscrowStatus.CREATED, [EscrowStatus.AWAITING_PAYMENT, EscrowStatus.CANCELLED]],
    [EscrowStatus.AWAITING_PAYMENT, [EscrowStatus.FUNDED, EscrowStatus.CANCELLED, EscrowStatus.EXPIRED]],
    
    // Once funded, waiting for shipment tracking or handover
    [EscrowStatus.FUNDED, [EscrowStatus.AWAITING_SELLER_ACTION, EscrowStatus.CANCELLED, EscrowStatus.REFUND_APPROVED]],
    
    [EscrowStatus.AWAITING_SELLER_ACTION, [EscrowStatus.SHIPPED, EscrowStatus.HANDED_OVER, EscrowStatus.EXPIRED, EscrowStatus.REFUND_APPROVED]],
    
    // Handed over instantly asks for confirmation, shipped means waiting on courier
    [EscrowStatus.SHIPPED, [EscrowStatus.AWAITING_BUYER_CONFIRMATION, EscrowStatus.DISPUTE_OPENED]],
    [EscrowStatus.HANDED_OVER, [EscrowStatus.AWAITING_BUYER_CONFIRMATION, EscrowStatus.DISPUTE_OPENED]],
    
    [EscrowStatus.AWAITING_BUYER_CONFIRMATION, [EscrowStatus.COMPLETED, EscrowStatus.DISPUTE_OPENED, EscrowStatus.EXPIRED]],
    
    [EscrowStatus.COMPLETED, [EscrowStatus.PAYOUT_APPROVED]],
    
    [EscrowStatus.DISPUTE_OPENED, [EscrowStatus.UNDER_REVIEW]],
    [EscrowStatus.UNDER_REVIEW, [EscrowStatus.PAYOUT_APPROVED, EscrowStatus.REFUND_APPROVED]],
    
    [EscrowStatus.PAYOUT_APPROVED, []], // Terminal flow to payout service
    [EscrowStatus.REFUND_APPROVED, [EscrowStatus.REFUNDED]],
    
    [EscrowStatus.REFUNDED, []],
    [EscrowStatus.CANCELLED, []],
    [EscrowStatus.EXPIRED, [EscrowStatus.REFUND_APPROVED]], // Normally mapping to a refund job later
  ]);

  /**
   * Validate if the requested status transition is mathematically allowed by the engine rules
   */
  static validateTransition(currentStatus: string, targetStatus: EscrowStatus): void {
    const validNextStates = this.transitions.get(currentStatus as EscrowStatus) || [];
    if (!validNextStates.includes(targetStatus)) {
      throw new EscrowTransitionException(currentStatus, targetStatus);
    }
  }

  /**
   * Evaluates if an entity's optimistic version has changed (Concurrent Mutation Guard)
   */
  static checkOptimisticLock(deal: EscrowDeal, currentVersion: number): void {
    if (deal.version !== currentVersion) {
      throw new Error(`CONCURRENCY_ERROR: Escrow has been modified by another process. Received version ${currentVersion}, DB has ${deal.version}`);
    }
  }
}
