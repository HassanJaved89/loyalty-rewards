import type {
  CustomerBalance,
  HistoryResponse,
  PurchaseResponse,
  RedemptionResponse,
} from '../types/loyalty';

function buildUrl(serverUrl: string, path: string): string {
  const base = serverUrl.trim().replace(/\/+$/, '');
  const relativePath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${relativePath}`;
}

async function requestJson<T>(serverUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(serverUrl, path), {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message?: string }).message)
        : 'Request failed';

    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return payload as T;
}

export async function getCustomerBalance(
  serverUrl: string,
  customerId: string,
): Promise<CustomerBalance> {
  return requestJson<CustomerBalance>(serverUrl, `/customers/${customerId}/balance`);
}

export async function getCustomerHistory(
  serverUrl: string,
  customerId: string,
): Promise<HistoryResponse> {
  return requestJson<HistoryResponse>(serverUrl, `/customers/${customerId}/history`);
}

export async function createPurchase(
  serverUrl: string,
  customerId: string,
  amountPkr: number,
): Promise<PurchaseResponse> {
  return requestJson<PurchaseResponse>(serverUrl, '/purchases', {
    method: 'POST',
    body: JSON.stringify({ customerId, amountPkr }),
  });
}

export async function createRedemption(
  serverUrl: string,
  customerId: string,
  rewardId: string,
): Promise<RedemptionResponse> {
  return requestJson<RedemptionResponse>(serverUrl, '/redemptions', {
    method: 'POST',
    body: JSON.stringify({ customerId, rewardId }),
  });
}
