import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { CustomerNotFound, InsufficientBalance, RewardNotFound } from './loyalty.errors';
import { LoyaltyRepository } from './loyalty.repository';
import { LoyaltyService } from './loyalty.service';

const pool = new Pool({
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  database: process.env.DATABASE_NAME ?? 'loyalty_rewards',
  user: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? '',
});

describe('LoyaltyService integration', () => {
  const createdCustomerIds: string[] = [];
  const createdRewardIds: string[] = [];

  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  afterEach(async () => {
    for (const customerId of createdCustomerIds) {
      await pool.query('DELETE FROM point_ledger WHERE customer_id = $1', [customerId]);
      await pool.query('DELETE FROM redemptions WHERE customer_id = $1', [customerId]);
      await pool.query('DELETE FROM purchases WHERE customer_id = $1', [customerId]);
      await pool.query('DELETE FROM customers WHERE id = $1', [customerId]);
    }

    for (const rewardId of createdRewardIds) {
      await pool.query('DELETE FROM redemptions WHERE reward_id = $1', [rewardId]);
      await pool.query('DELETE FROM rewards WHERE id = $1', [rewardId]);
    }

    createdRewardIds.length = 0;
    createdCustomerIds.length = 0;
  });

  afterAll(async () => {
    await pool.end();
  });

  async function createCustomer(balance = 0, lifetimeEarned = 0): Promise<string> {
    const customerId = randomUUID();
    await pool.query(
      `
        INSERT INTO customers (id, name, redeemable_balance, lifetime_earned)
        VALUES ($1, $2, $3, $4)
      `,
      [customerId, `Customer ${customerId}`, balance, lifetimeEarned],
    );
    createdCustomerIds.push(customerId);
    return customerId;
  }

  async function createReward(pointsCost: number): Promise<string> {
    const rewardId = randomUUID();
    await pool.query(
      `
        INSERT INTO rewards (id, name, points_cost)
        VALUES ($1, $2, $3)
      `,
      [rewardId, `Reward ${rewardId}`, pointsCost],
    );
    createdRewardIds.push(rewardId);
    return rewardId;
  }

  function createService(): LoyaltyService {
    return new LoyaltyService(pool, new LoyaltyRepository(pool));
  }

  it('records a purchase and updates customer state and ledger', async () => {
    const customerId = await createCustomer(0, 4990);
    const service = createService();

    const result = await service.recordPurchase(customerId, 1000);

    expect(result.pointsEarned).toBe(10);
    expect(result.redeemableBalance).toBe(10);
    expect(result.lifetimeEarned).toBe(5000);
    expect(result.tier).toBe('GOLD');

    const customerRow = await pool.query(
      'SELECT redeemable_balance, lifetime_earned FROM customers WHERE id = $1',
      [customerId],
    );
    expect(customerRow.rows[0]).toMatchObject({
      redeemable_balance: 10,
      lifetime_earned: 5000,
    });

    const purchaseRow = await pool.query(
      'SELECT customer_id, amount_pkr, points_earned FROM purchases WHERE id = $1',
      [result.purchaseId],
    );
    expect(purchaseRow.rows[0]).toMatchObject({
      customer_id: customerId,
      amount_pkr: 1000,
      points_earned: 10,
    });

    const ledgerRows = await pool.query(
      'SELECT entry_type, points_delta, balance_after, purchase_id, redemption_id FROM point_ledger WHERE customer_id = $1',
      [customerId],
    );
    expect(ledgerRows.rows).toHaveLength(1);
    expect(ledgerRows.rows[0]).toMatchObject({
      entry_type: 'EARN',
      points_delta: 10,
      balance_after: 10,
      purchase_id: result.purchaseId,
      redemption_id: null,
    });
  });

  it('redeems successfully when balance is sufficient', async () => {
    const customerId = await createCustomer(100, 0);
    const rewardId = await createReward(100);
    const service = createService();

    const result = await service.redeemReward(customerId, rewardId);

    expect(result.pointsSpent).toBe(100);
    expect(result.remainingBalance).toBe(0);

    const customerRow = await pool.query(
      'SELECT redeemable_balance FROM customers WHERE id = $1',
      [customerId],
    );
    expect(customerRow.rows[0].redeemable_balance).toBe(0);

    const redemptionRows = await pool.query(
      'SELECT customer_id, reward_id, points_spent FROM redemptions WHERE customer_id = $1',
      [customerId],
    );
    expect(redemptionRows.rows).toHaveLength(1);

    const ledgerRows = await pool.query(
      'SELECT entry_type, points_delta, balance_after, redemption_id FROM point_ledger WHERE customer_id = $1',
      [customerId],
    );
    expect(ledgerRows.rows).toHaveLength(1);
    expect(ledgerRows.rows[0]).toMatchObject({
      entry_type: 'REDEEM',
      points_delta: -100,
      balance_after: 0,
      redemption_id: result.redemptionId,
    });
  });

  it('rejects redemption when balance is insufficient and keeps the balance unchanged', async () => {
    const customerId = await createCustomer(100, 0);
    const rewardId = await createReward(200);
    const service = createService();

    await expect(service.redeemReward(customerId, rewardId)).rejects.toBeInstanceOf(
      InsufficientBalance,
    );

    const customerRow = await pool.query(
      'SELECT redeemable_balance FROM customers WHERE id = $1',
      [customerId],
    );
    expect(customerRow.rows[0].redeemable_balance).toBe(100);

    const redemptionRows = await pool.query(
      'SELECT COUNT(*)::int AS count FROM redemptions WHERE customer_id = $1',
      [customerId],
    );
    expect(redemptionRows.rows[0].count).toBe(0);

    const ledgerRows = await pool.query(
      'SELECT COUNT(*)::int AS count FROM point_ledger WHERE customer_id = $1',
      [customerId],
    );
    expect(ledgerRows.rows[0].count).toBe(0);
  });

  it('throws CustomerNotFound and RewardNotFound for missing records', async () => {
    const service = createService();
    const missingCustomerId = randomUUID();
    const missingRewardId = randomUUID();

    await expect(service.recordPurchase(missingCustomerId, 1000)).rejects.toBeInstanceOf(
      CustomerNotFound,
    );
    await expect(service.getCustomerBalance(missingCustomerId)).rejects.toBeInstanceOf(
      CustomerNotFound,
    );

    const realCustomerId = await createCustomer(100, 0);
    await expect(service.redeemReward(realCustomerId, missingRewardId)).rejects.toBeInstanceOf(
      RewardNotFound,
    );
  });

  it('serializes concurrent redemptions and prevents overspend', async () => {
    const customerId = await createCustomer(100, 0);
    const rewardId = await createReward(100);
    const service = createService();

    const results = await Promise.allSettled([
      service.redeemReward(customerId, rewardId),
      service.redeemReward(customerId, rewardId),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].status).toBe('rejected');
    if (rejected[0].status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(InsufficientBalance);
    }

    const customerRow = await pool.query(
      'SELECT redeemable_balance FROM customers WHERE id = $1',
      [customerId],
    );
    expect(customerRow.rows[0].redeemable_balance).toBe(0);

    const redemptionRows = await pool.query(
      'SELECT COUNT(*)::int AS count FROM redemptions WHERE customer_id = $1',
      [customerId],
    );
    expect(redemptionRows.rows[0].count).toBe(1);

    const ledgerRows = await pool.query(
      'SELECT COUNT(*)::int AS count FROM point_ledger WHERE customer_id = $1 AND entry_type = $2',
      [customerId, 'REDEEM'],
    );
    expect(ledgerRows.rows[0].count).toBe(1);
  });
});
