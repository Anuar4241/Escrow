import {
  EscrowEngine,
  EscrowStatus,
  EscrowTransitionException,
} from './escrow.engine';
describe('EscrowEngine', () => {
  it('allows funding flow', () =>
    expect(() =>
      EscrowEngine.validateTransition(
        EscrowStatus.AWAITING_PAYMENT,
        EscrowStatus.FUNDED,
      ),
    ).not.toThrow());
  it('blocks shipment before funding', () =>
    expect(() =>
      EscrowEngine.validateTransition(
        EscrowStatus.AWAITING_PAYMENT,
        EscrowStatus.SHIPPED,
      ),
    ).toThrow(EscrowTransitionException));
  it('closes payout only after bank confirmation', () =>
    expect(EscrowEngine.allowedTargets(EscrowStatus.PAYOUT_APPROVED)).toEqual([
      EscrowStatus.PAID_OUT,
    ]));
});
