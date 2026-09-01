export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export type Tier = 'SILVER' | 'GOLD';

export type BalanceResponse = {
  customerId: string;
  redeemableBalance: number;
  lifetimeEarned: number;
  tier: Tier;
};

export type HistoryEntry = {
  id: string;
  entryType: 'EARN' | 'REDEEM';
  pointsDelta: number;
  balanceAfter: number;
  purchaseId: string | null;
  redemptionId: string | null;
  createdAt: string;
};

export type HistoryResponse = {
  customerId: string;
  entries: HistoryEntry[];
};

export type PurchaseRequest = {
  customerId: string;
  amountPkr: number;
};

export type PurchaseResponse = {
  purchaseId: string;
  customerId: string;
  amountPkr: number;
  pointsEarned: number;
  redeemableBalance: number;
  lifetimeEarned: number;
  tier: Tier;
};

export type RedemptionRequest = {
  customerId: string;
  rewardId: string;
};

export type RedemptionResponse = {
  redemptionId: string;
  customerId: string;
  rewardId: string;
  pointsSpent: number;
  redeemableBalance: number;
};

export class ApiError extends Error {
  status: number;
  errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const errorCode = payload?.error ?? undefined;
    throw new ApiError(payload?.message ?? 'Request failed', response.status, errorCode);
  }

  return payload as T;
}

export async function getCustomerBalance(customerId: string): Promise<BalanceResponse> {
  return requestJson<BalanceResponse>(`/customers/${customerId}/balance`);
}

export async function getCustomerHistory(customerId: string): Promise<HistoryResponse> {
  return requestJson<HistoryResponse>(`/customers/${customerId}/history`);
}

export async function createPurchase(input: PurchaseRequest): Promise<PurchaseResponse> {
  return requestJson<PurchaseResponse>('/purchases', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createRedemption(input: RedemptionRequest): Promise<RedemptionResponse> {
  return requestJson<RedemptionResponse>('/redemptions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
