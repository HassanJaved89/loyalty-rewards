import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { Response } from 'express';
import { CustomerNotFound, InsufficientBalance, RewardNotFound } from './loyalty.errors';
import { LoyaltyService } from './loyalty.service';

class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

@Catch()
export class LoyaltyExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof CustomerNotFound) {
      return response.status(404).json({ error: 'CUSTOMER_NOT_FOUND' });
    }

    if (exception instanceof RewardNotFound) {
      return response.status(404).json({ error: 'REWARD_NOT_FOUND' });
    }

    if (exception instanceof InsufficientBalance) {
      return response.status(409).json({ error: 'INSUFFICIENT_BALANCE' });
    }

    if (exception instanceof InvalidRequestError) {
      return response.status(400).json({
        error: 'INVALID_REQUEST',
        message: exception.message,
      });
    }

    return response.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

@Controller()
@UseFilters(LoyaltyExceptionFilter)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Post('purchases')
  async createPurchase(@Body() body: unknown) {
    const dto = this.validatePurchaseRequest(body);
    const result = await this.loyaltyService.recordPurchase(dto.customerId, dto.amountPkr);

    return {
      purchaseId: result.purchaseId,
      customerId: result.customerId,
      amountPkr: result.amountPkr,
      pointsEarned: result.pointsEarned,
      redeemableBalance: result.redeemableBalance,
      lifetimeEarned: result.lifetimeEarned,
      tier: result.tier,
    };
  }

  @Get('customers/:id/balance')
  async getCustomerBalance(@Param('id') customerId: string) {
    const id = this.assertUuid(customerId, 'customerId');
    const result = await this.loyaltyService.getCustomerBalance(id);

    return {
      customerId: result.customerId,
      redeemableBalance: result.redeemableBalance,
      lifetimeEarned: result.lifetimeEarned,
      tier: result.tier,
    };
  }

  @Post('redemptions')
  async createRedemption(@Body() body: unknown) {
    const dto = this.validateRedemptionRequest(body);
    const result = await this.loyaltyService.redeemReward(dto.customerId, dto.rewardId);

    return {
      redemptionId: result.redemptionId,
      customerId: result.customerId,
      rewardId: result.rewardId,
      pointsSpent: result.pointsSpent,
      redeemableBalance: result.redeemableBalance,
    };
  }

  @Get('customers/:id/history')
  async getCustomerHistory(@Param('id') customerId: string) {
    const id = this.assertUuid(customerId, 'customerId');
    const entries = await this.loyaltyService.getCustomerHistory(id);

    return {
      customerId: id,
      entries: entries.map((entry) => ({
        id: entry.id,
        entryType: entry.entry_type,
        pointsDelta: entry.points_delta,
        balanceAfter: entry.balance_after,
        purchaseId: entry.purchase_id,
        redemptionId: entry.redemption_id,
        createdAt: entry.created_at,
      })),
    };
  }

  private validatePurchaseRequest(body: unknown): {
    customerId: string;
    amountPkr: number;
  } {
    if (!body || typeof body !== 'object') {
      throw new InvalidRequestError('Request body must be an object.');
    }

    const payload = body as Record<string, unknown>;
    const customerId = this.assertUuid(payload.customerId, 'customerId');
    const amountPkr = this.assertPositiveInteger(payload.amountPkr, 'amountPkr');

    return { customerId, amountPkr };
  }

  private validateRedemptionRequest(body: unknown): {
    customerId: string;
    rewardId: string;
  } {
    if (!body || typeof body !== 'object') {
      throw new InvalidRequestError('Request body must be an object.');
    }

    const payload = body as Record<string, unknown>;
    const customerId = this.assertUuid(payload.customerId, 'customerId');
    const rewardId = this.assertUuid(payload.rewardId, 'rewardId');

    return { customerId, rewardId };
  }

  private assertUuid(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || !this.isUuid(value)) {
      throw new InvalidRequestError(`${fieldName} must be a valid UUID.`);
    }

    return value;
  }

  private assertPositiveInteger(value: unknown, fieldName: string): number {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      !Number.isInteger(value) ||
      value < 1
    ) {
      throw new InvalidRequestError(`${fieldName} must be a finite integer >= 1.`);
    }

    return value;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
      value,
    );
  }
}
