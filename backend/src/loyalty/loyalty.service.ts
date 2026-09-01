import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DATABASE_POOL } from '../database/postgres.pool';
import { calculateAccruedPoints, getTierForLifetimeEarned } from './loyalty-rules';
import {
  CustomerNotFound,
  InsufficientBalance,
  RewardNotFound,
} from './loyalty.errors';
import { LoyaltyRepository } from './loyalty.repository';

export type PurchaseResult = {
  purchaseId: string;
  customerId: string;
  amountPkr: number;
  pointsEarned: number;
  redeemableBalance: number;
  lifetimeEarned: number;
  tier: 'SILVER' | 'GOLD';
};

export type CustomerBalanceResult = {
  customerId: string;
  redeemableBalance: number;
  lifetimeEarned: number;
  tier: 'SILVER' | 'GOLD';
};

export type RedemptionResult = {
  redemptionId: string;
  customerId: string;
  rewardId: string;
  pointsSpent: number;
  redeemableBalance: number;
  remainingBalance: number;
};

@Injectable()
export class LoyaltyService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly repository: LoyaltyRepository,
  ) {}

  async recordPurchase(customerId: string, amountPkr: number): Promise<PurchaseResult> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const customer = await this.repository.lockCustomerForUpdate(client, customerId);
      if (!customer) {
        throw new CustomerNotFound(customerId);
      }

      const tierBefore = getTierForLifetimeEarned(customer.lifetime_earned);
      const pointsEarned = calculateAccruedPoints(amountPkr, tierBefore);
      const purchase = await this.repository.insertPurchase(
        client,
        customerId,
        amountPkr,
        pointsEarned,
      );

      const newRedeemableBalance = customer.redeemable_balance + pointsEarned;
      const newLifetimeEarned = customer.lifetime_earned + pointsEarned;

      await this.repository.insertLedgerEntry(client, {
        customerId,
        entryType: 'EARN',
        pointsDelta: pointsEarned,
        balanceAfter: newRedeemableBalance,
        purchaseId: purchase.id,
        redemptionId: null,
      });

      await this.repository.updateCustomerBalances(
        client,
        customerId,
        newRedeemableBalance,
        newLifetimeEarned,
      );

      await client.query('COMMIT');

      return {
        purchaseId: purchase.id,
        customerId,
        amountPkr,
        pointsEarned,
        redeemableBalance: newRedeemableBalance,
        lifetimeEarned: newLifetimeEarned,
        tier: getTierForLifetimeEarned(newLifetimeEarned),
      };
    } catch (error) {
      await this.rollbackTransaction(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async getCustomerBalance(customerId: string): Promise<CustomerBalanceResult> {
    const customer = await this.repository.findCustomer(customerId);
    if (!customer) {
      throw new CustomerNotFound(customerId);
    }

    return {
      customerId: customer.id,
      redeemableBalance: customer.redeemable_balance,
      lifetimeEarned: customer.lifetime_earned,
      tier: getTierForLifetimeEarned(customer.lifetime_earned),
    };
  }

  async redeemReward(customerId: string, rewardId: string): Promise<RedemptionResult> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const customer = await this.repository.lockCustomerForUpdate(client, customerId);
      if (!customer) {
        throw new CustomerNotFound(customerId);
      }

      const reward = await this.repository.findReward(rewardId, client);
      if (!reward) {
        throw new RewardNotFound(rewardId);
      }

      if (customer.redeemable_balance < reward.points_cost) {
        throw new InsufficientBalance(
          customerId,
          reward.points_cost,
          customer.redeemable_balance,
        );
      }

      const redemption = await this.repository.insertRedemption(
        client,
        customerId,
        rewardId,
        reward.points_cost,
      );

      const remainingBalance = customer.redeemable_balance - reward.points_cost;

      await this.repository.insertLedgerEntry(client, {
        customerId,
        entryType: 'REDEEM',
        pointsDelta: -reward.points_cost,
        balanceAfter: remainingBalance,
        purchaseId: null,
        redemptionId: redemption.id,
      });

      await this.repository.updateCustomerBalances(
        client,
        customerId,
        remainingBalance,
        customer.lifetime_earned,
      );

      await client.query('COMMIT');

      return {
        redemptionId: redemption.id,
        customerId,
        rewardId,
        pointsSpent: reward.points_cost,
        redeemableBalance: remainingBalance,
        remainingBalance,
      };
    } catch (error) {
      await this.rollbackTransaction(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async getCustomerHistory(customerId: string) {
    const customer = await this.repository.findCustomer(customerId);
    if (!customer) {
      throw new CustomerNotFound(customerId);
    }

    return this.repository.getCustomerLedger(customerId);
  }

  private async rollbackTransaction(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors when no transaction is active.
    }
  }
}
