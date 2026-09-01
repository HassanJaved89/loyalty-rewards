export type Tier = 'SILVER' | 'GOLD';

export interface CustomerBalance {
  customerId: string;
  redeemableBalance: number;
  lifetimeEarned: number;
  tier: Tier;
}

export interface HistoryEntry {
  id: string;
  entryType: 'EARN' | 'REDEEM';
  pointsDelta: number;
  balanceAfter: number;
  purchaseId: string | null;
  redemptionId: string | null;
  createdAt: string;
}

export interface HistoryResponse {
  customerId: string;
  entries: HistoryEntry[];
}

export interface PurchaseResponse {
  purchaseId: string;
  customerId: string;
  amountPkr: number;
  pointsEarned: number;
  redeemableBalance: number;
  lifetimeEarned: number;
  tier: Tier;
}

export interface RedemptionResponse {
  redemptionId: string;
  customerId: string;
  rewardId: string;
  pointsSpent: number;
  redeemableBalance: number;
}
