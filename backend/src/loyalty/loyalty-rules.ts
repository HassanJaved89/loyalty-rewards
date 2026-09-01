export type CustomerTier = 'SILVER' | 'GOLD';

export function calculateBasePoints(amountPkr: number): number {
  if (amountPkr <= 0) {
    return 0;
  }

  return Math.floor(amountPkr / 100);
}

export function getTierForLifetimeEarned(lifetimeEarned: number): CustomerTier {
  return lifetimeEarned >= 5000 ? 'GOLD' : 'SILVER';
}

export function calculateAccruedPoints(amountPkr: number, tier: CustomerTier): number {
  const basePoints = calculateBasePoints(amountPkr);

  if (tier === 'GOLD') {
    return Math.floor((basePoints * 3) / 2);
  }

  return basePoints;
}

export type PurchaseResult = {
  pointsEarned: number;
  tierBefore: CustomerTier;
  lifetimeEarnedBefore: number;
  lifetimeEarnedAfter: number;
  tierAfter: CustomerTier;
};

export function calculatePurchaseOutcome(
  lifetimeEarnedBefore: number,
  amountPkr: number,
): PurchaseResult {
  const tierBefore = getTierForLifetimeEarned(lifetimeEarnedBefore);
  const pointsEarned = calculateAccruedPoints(amountPkr, tierBefore);
  const lifetimeEarnedAfter = lifetimeEarnedBefore + pointsEarned;

  return {
    pointsEarned,
    tierBefore,
    lifetimeEarnedBefore,
    lifetimeEarnedAfter,
    tierAfter: getTierForLifetimeEarned(lifetimeEarnedAfter),
  };
}

export type RedemptionResult = {
  isValid: boolean;
  remainingBalance: number;
};

export function canRedeemPoints(redeemableBalance: number, pointsCost: number): boolean {
  return pointsCost >= 0 && redeemableBalance >= 0 && pointsCost <= redeemableBalance;
}

export function applyRedemption(redeemableBalance: number, pointsCost: number): RedemptionResult {
  if (!canRedeemPoints(redeemableBalance, pointsCost)) {
    return {
      isValid: false,
      remainingBalance: redeemableBalance,
    };
  }

  return {
    isValid: true,
    remainingBalance: redeemableBalance - pointsCost,
  };
}
