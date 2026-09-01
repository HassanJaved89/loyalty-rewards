import { type FormEvent, useCallback, useEffect, useState } from 'react';
import './App.css';
import {
  ApiError,
  createPurchase,
  createRedemption,
  getCustomerBalance,
  getCustomerHistory,
  type BalanceResponse,
  type HistoryEntry,
} from './api/loyaltyApi';

const CUSTOMERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Customer One',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Customer Two',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Customer Three',
  },
] as const;

const REWARDS = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Silver Reward', pointsCost: 150 },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Gold Reward', pointsCost: 300 },
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Free Coffee', pointsCost: 75 },
] as const;

function App() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(CUSTOMERS[0].id);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [selectedRewardId, setSelectedRewardId] = useState<string>(REWARDS[0].id);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const loadCustomerData = useCallback(async () => {
    setIsLoadingBalance(true);
    setIsLoadingHistory(true);
    setBalance(null);
    setHistory([]);

    try {
      const [balanceResponse, historyResponse] = await Promise.all([
        getCustomerBalance(selectedCustomerId),
        getCustomerHistory(selectedCustomerId),
      ]);

      setBalance(balanceResponse);
      setHistory(historyResponse.entries);
    } catch {
      setStatus({ type: 'error', message: 'Unable to load customer data.' });
    } finally {
      setIsLoadingBalance(false);
      setIsLoadingHistory(false);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    void loadCustomerData();
  }, [loadCustomerData]);

  function handleCustomerChange(customerId: string) {
    setSelectedCustomerId(customerId);
    setStatus(null);
    setBalance(null);
    setHistory([]);
  }

  async function handlePurchaseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = Number(purchaseAmount);
    if (!purchaseAmount.trim() || !Number.isInteger(value) || value < 1) {
      setStatus({
        type: 'error',
        message: 'Enter a valid PKR amount greater than 0.',
      });
      return;
    }

    setIsPurchasing(true);
    setStatus(null);

    try {
      const result = await createPurchase({
        customerId: selectedCustomerId,
        amountPkr: value,
      });

      setStatus({
        type: 'success',
        message: `Purchase successful. Earned ${result.pointsEarned} points.`,
      });
      setPurchaseAmount('');
      await loadCustomerData();
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 400
          ? 'Please enter a valid purchase amount.'
          : 'Unable to process purchase.';
      setStatus({ type: 'error', message });
    } finally {
      setIsPurchasing(false);
    }
  }

  async function handleRedemptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsRedeeming(true);
    setStatus(null);

    try {
      const result = await createRedemption({
        customerId: selectedCustomerId,
        rewardId: selectedRewardId,
      });

      setStatus({
        type: 'success',
        message: `Reward redeemed successfully. ${result.pointsSpent} points used.`,
      });
      await loadCustomerData();
    } catch (error) {
      if (error instanceof ApiError && error.errorCode === 'INSUFFICIENT_BALANCE') {
        setStatus({
          type: 'error',
          message: 'Not enough points to redeem this reward.',
        });
      } else {
        setStatus({
          type: 'error',
          message: 'Unable to redeem reward.',
        });
      }
    } finally {
      setIsRedeeming(false);
    }
  }

  const currentReward = REWARDS.find((reward) => reward.id === selectedRewardId) ?? REWARDS[0];

  return (
    <div className="page-shell">
      <header className="topbar">
        <h1>Loyalty Rewards</h1>
      </header>

      <main className="dashboard">
        <section className="panel customer-panel">
          <label className="field-label" htmlFor="customer-select">
            Customer
          </label>
          <select
            id="customer-select"
            value={selectedCustomerId}
            onChange={(event) => handleCustomerChange(event.target.value)}
            aria-label="Select a customer"
          >
            {CUSTOMERS.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </section>

        <section className="stats-grid" aria-live="polite">
          <article className="stat-card">
            <span className="stat-label">Balance</span>
            <strong>{isLoadingBalance ? 'Loading...' : `${balance?.redeemableBalance ?? 0} points`}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Lifetime Earned</span>
            <strong>{isLoadingBalance ? 'Loading...' : `${balance?.lifetimeEarned ?? 0} points`}</strong>
          </article>
          <article className="stat-card muted-card">
            <span className="stat-label">Tier</span>
            <strong>
              {isLoadingBalance ? 'Loading...' : (
                <span className={`tier-badge ${balance?.tier?.toLowerCase() ?? 'silver'}`}>
                  {balance?.tier ?? 'SILVER'}
                </span>
              )}
            </strong>
          </article>
        </section>

        <section className="panel-grid">
          <section className="panel action-panel">
            <h2>Make a Purchase</h2>
            <form onSubmit={handlePurchaseSubmit} className="stack-form">
              <label className="field-label" htmlFor="purchase-amount">
                Amount (PKR)
              </label>
              <input
                id="purchase-amount"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="1000"
                value={purchaseAmount}
                onChange={(event) => setPurchaseAmount(event.target.value)}
                disabled={isPurchasing}
              />
              <button type="submit" disabled={isPurchasing}>
                {isPurchasing ? 'Processing purchase...' : 'Earn Points'}
              </button>
            </form>
          </section>

          <section className="panel action-panel">
            <h2>Redeem Reward</h2>
            <form onSubmit={handleRedemptionSubmit} className="stack-form">
              <label className="field-label" htmlFor="reward-select">
                Reward
              </label>
              <select
                id="reward-select"
                value={selectedRewardId}
                onChange={(event) => setSelectedRewardId(event.target.value)}
                disabled={isRedeeming}
              >
                {REWARDS.map((reward) => (
                  <option key={reward.id} value={reward.id}>
                    {reward.name} — {reward.pointsCost} points
                  </option>
                ))}
              </select>
              <div className="reward-hint">Selected: {currentReward.name} · {currentReward.pointsCost} points</div>
              <button type="submit" disabled={isRedeeming}>
                {isRedeeming ? 'Redeeming...' : 'Redeem'}
              </button>
            </form>
          </section>
        </section>

        {status && (
          <div className={`status-banner ${status.type}`} role="status" aria-live="polite">
            {status.message}
          </div>
        )}

        <section className="panel history-panel">
          <h2>Point History</h2>

          {isLoadingHistory ? (
            <p className="muted-text">Loading history...</p>
          ) : history.length === 0 ? (
            <p className="muted-text">No history available.</p>
          ) : (
            <div className="history-list">
              {history.map((entry) => (
                <div key={entry.id} className="history-row">
                  <div className="history-main">
                    <span className={`history-type ${entry.entryType.toLowerCase()}`}>
                      {entry.entryType}
                    </span>
                    <span className={entry.pointsDelta >= 0 ? 'points-positive' : 'points-negative'}>
                      {entry.pointsDelta >= 0 ? '+' : ''}
                      {entry.pointsDelta}
                    </span>
                  </div>
                  <div className="history-meta">
                    <span>Balance {entry.balanceAfter}</span>
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
