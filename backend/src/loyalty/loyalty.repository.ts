import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DATABASE_POOL } from '../database/postgres.pool';

export type CustomerRow = {
  id: string;
  name: string;
  redeemable_balance: number;
  lifetime_earned: number;
  created_at: Date | string;
};

export type RewardRow = {
  id: string;
  name: string;
  points_cost: number;
};

export type PurchaseInsertResult = {
  id: string;
};

export type LedgerEntryInput = {
  customerId: string;
  entryType: 'EARN' | 'REDEEM';
  pointsDelta: number;
  balanceAfter: number;
  purchaseId?: string | null;
  redemptionId?: string | null;
};

export type LedgerEntryRow = {
  id: string;
  customer_id: string;
  entry_type: 'EARN' | 'REDEEM';
  points_delta: number;
  balance_after: number;
  purchase_id: string | null;
  redemption_id: string | null;
  created_at: Date | string;
};

@Injectable()
export class LoyaltyRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findCustomer(
    customerId: string,
    client: PoolClient | Pool = this.pool,
  ): Promise<CustomerRow | null> {
    const result = await client.query<CustomerRow>(
      `
        SELECT id, name, redeemable_balance, lifetime_earned, created_at
        FROM customers
        WHERE id = $1
      `,
      [customerId],
    );

    return result.rows[0] ?? null;
  }

  async lockCustomerForUpdate(
    client: PoolClient,
    customerId: string,
  ): Promise<CustomerRow | null> {
    const result = await client.query<CustomerRow>(
      `
        SELECT id, name, redeemable_balance, lifetime_earned, created_at
        FROM customers
        WHERE id = $1
        FOR UPDATE
      `,
      [customerId],
    );

    return result.rows[0] ?? null;
  }

  async findReward(
    rewardId: string,
    client: PoolClient | Pool = this.pool,
  ): Promise<RewardRow | null> {
    const result = await client.query<RewardRow>(
      `
        SELECT id, name, points_cost
        FROM rewards
        WHERE id = $1
      `,
      [rewardId],
    );

    return result.rows[0] ?? null;
  }

  async insertPurchase(
    client: PoolClient,
    customerId: string,
    amountPkr: number,
    pointsEarned: number,
  ): Promise<PurchaseInsertResult> {
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO purchases (customer_id, amount_pkr, points_earned)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [customerId, amountPkr, pointsEarned],
    );

    return { id: result.rows[0].id };
  }

  async insertRedemption(
    client: PoolClient,
    customerId: string,
    rewardId: string,
    pointsSpent: number,
  ): Promise<{ id: string }> {
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO redemptions (customer_id, reward_id, points_spent)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [customerId, rewardId, pointsSpent],
    );

    return { id: result.rows[0].id };
  }

  async insertLedgerEntry(
    client: PoolClient,
    entry: LedgerEntryInput,
  ): Promise<{ id: string }> {
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO point_ledger (
          customer_id,
          entry_type,
          points_delta,
          balance_after,
          purchase_id,
          redemption_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [
        entry.customerId,
        entry.entryType,
        entry.pointsDelta,
        entry.balanceAfter,
        entry.purchaseId ?? null,
        entry.redemptionId ?? null,
      ],
    );

    return { id: result.rows[0].id };
  }

  async updateCustomerBalances(
    client: PoolClient,
    customerId: string,
    redeemableBalance: number,
    lifetimeEarned: number,
  ): Promise<void> {
    await client.query(
      `
        UPDATE customers
        SET redeemable_balance = $2,
            lifetime_earned = $3
        WHERE id = $1
      `,
      [customerId, redeemableBalance, lifetimeEarned],
    );
  }

  async getCustomerLedger(
    customerId: string,
    client: PoolClient | Pool = this.pool,
  ): Promise<LedgerEntryRow[]> {
    const result = await client.query<LedgerEntryRow>(
      `
        SELECT id, customer_id, entry_type, points_delta, balance_after, purchase_id, redemption_id, created_at
        FROM point_ledger
        WHERE customer_id = $1
        ORDER BY created_at DESC, id DESC
      `,
      [customerId],
    );

    return result.rows;
  }
}
