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
  PAID_OUT = 'paid_out',
  REFUND_APPROVED = 'refund_approved',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}
export class EscrowTransitionException extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Invalid escrow transition from '${from}' to '${to}'`);
    this.name = EscrowTransitionException.name;
  }
}
export class EscrowEngine {
  private static readonly transitions = new Map<EscrowStatus, EscrowStatus[]>([
    [EscrowStatus.DRAFT, [EscrowStatus.CREATED]],
    [
      EscrowStatus.CREATED,
      [EscrowStatus.AWAITING_PAYMENT, EscrowStatus.CANCELLED],
    ],
    [
      EscrowStatus.AWAITING_PAYMENT,
      [EscrowStatus.FUNDED, EscrowStatus.CANCELLED, EscrowStatus.EXPIRED],
    ],
    [
      EscrowStatus.FUNDED,
      [
        EscrowStatus.AWAITING_SELLER_ACTION,
        EscrowStatus.DISPUTE_OPENED,
        EscrowStatus.REFUND_APPROVED,
      ],
    ],
    [
      EscrowStatus.AWAITING_SELLER_ACTION,
      [
        EscrowStatus.SHIPPED,
        EscrowStatus.HANDED_OVER,
        EscrowStatus.DISPUTE_OPENED,
        EscrowStatus.EXPIRED,
        EscrowStatus.REFUND_APPROVED,
      ],
    ],
    [
      EscrowStatus.SHIPPED,
      [EscrowStatus.AWAITING_BUYER_CONFIRMATION, EscrowStatus.DISPUTE_OPENED],
    ],
    [
      EscrowStatus.HANDED_OVER,
      [EscrowStatus.AWAITING_BUYER_CONFIRMATION, EscrowStatus.DISPUTE_OPENED],
    ],
    [
      EscrowStatus.AWAITING_BUYER_CONFIRMATION,
      [EscrowStatus.COMPLETED, EscrowStatus.DISPUTE_OPENED],
    ],
    [EscrowStatus.COMPLETED, [EscrowStatus.PAYOUT_APPROVED]],
    [EscrowStatus.DISPUTE_OPENED, [EscrowStatus.UNDER_REVIEW]],
    [
      EscrowStatus.UNDER_REVIEW,
      [EscrowStatus.PAYOUT_APPROVED, EscrowStatus.REFUND_APPROVED],
    ],
    [EscrowStatus.REFUND_APPROVED, [EscrowStatus.REFUNDED]],
    [EscrowStatus.EXPIRED, [EscrowStatus.REFUND_APPROVED]],
    [EscrowStatus.PAYOUT_APPROVED, [EscrowStatus.PAID_OUT]],
    [EscrowStatus.PAID_OUT, []],
    [EscrowStatus.REFUNDED, []],
    [EscrowStatus.CANCELLED, []],
  ]);
  static validateTransition(
    currentStatus: string,
    targetStatus: EscrowStatus,
  ): void {
    if (
      !(this.transitions.get(currentStatus as EscrowStatus) ?? []).includes(
        targetStatus,
      )
    )
      throw new EscrowTransitionException(currentStatus, targetStatus);
  }
  static allowedTargets(currentStatus: EscrowStatus): readonly EscrowStatus[] {
    return this.transitions.get(currentStatus) ?? [];
  }
}
