import {
  applyRedemption,
  calculateAccruedPoints,
  calculateBasePoints,
  calculatePurchaseOutcome,
  canRedeemPoints,
  getTierForLifetimeEarned,
} from './loyalty-rules';

describe('loyalty rules', () => {
  describe('base accrual', () => {
    it.each([
      [99, 0],
      [100, 1],
      [199, 1],
      [200, 2],
    ])('rounds PKR %i to %i base points', (amountPkr, expected) => {
      expect(calculateBasePoints(amountPkr)).toBe(expected);
    });
  });

  describe('silver accrual', () => {
    it('awards base points at the silver rate', () => {
      expect(calculateAccruedPoints(1000, 'SILVER')).toBe(10);
    });
  });

  describe('gold accrual', () => {
    it('awards 1.5x using integer arithmetic', () => {
      expect(calculateAccruedPoints(1000, 'GOLD')).toBe(15);
    });

    it('uses floor for non-integer gold multipliers', () => {
      expect(calculateAccruedPoints(150, 'GOLD')).toBe(1);
    });
  });

  describe('tier calculation', () => {
    it('keeps lifetime earned below 5000 in SILVER', () => {
      expect(getTierForLifetimeEarned(4999)).toBe('SILVER');
    });

    it('promotes lifetime earned at 5000 to GOLD', () => {
      expect(getTierForLifetimeEarned(5000)).toBe('GOLD');
    });
  });

  describe('purchase timing', () => {
    it('uses the pre-purchase tier when calculating the purchase', () => {
      const result = calculatePurchaseOutcome(4990, 1000);

      expect(result.tierBefore).toBe('SILVER');
      expect(result.pointsEarned).toBe(10);
      expect(result.lifetimeEarnedAfter).toBe(5000);
      expect(result.tierAfter).toBe('GOLD');
    });
  });

  describe('redemptions', () => {
    it('rejects insufficient balance', () => {
      expect(canRedeemPoints(499, 500)).toBe(false);
      expect(applyRedemption(499, 500)).toEqual({
        isValid: false,
        remainingBalance: 499,
      });
    });

    it('allows exact balance redemption without going negative', () => {
      expect(canRedeemPoints(500, 500)).toBe(true);
      expect(applyRedemption(500, 500)).toEqual({
        isValid: true,
        remainingBalance: 0,
      });
    });
  });
});
