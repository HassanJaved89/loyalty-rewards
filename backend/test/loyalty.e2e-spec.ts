import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const pool = new Pool({
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  database: process.env.DATABASE_NAME ?? 'loyalty_rewards',
  user: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? '',
});

describe('LoyaltyController (e2e)', () => {
  let app: INestApplication;
  const createdCustomerIds: string[] = [];
  const createdRewardIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
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

    createdCustomerIds.length = 0;
    createdRewardIds.length = 0;
  });

  afterAll(async () => {
    await app.close();
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

  it('POST /purchases succeeds and returns expected response', async () => {
    const customerId = await createCustomer(0, 0);

    const response = await request(app.getHttpServer())
      .post('/purchases')
      .send({ customerId, amountPkr: 1000 })
      .expect(201);

    expect(response.body).toMatchObject({
      purchaseId: expect.any(String),
      customerId,
      amountPkr: 1000,
      pointsEarned: 10,
      redeemableBalance: 10,
      lifetimeEarned: 10,
      tier: 'SILVER',
    });
  });

  it('GET /customers/:id/balance returns correct balance and tier', async () => {
    const customerId = await createCustomer(50, 5000);

    const response = await request(app.getHttpServer())
      .get(`/customers/${customerId}/balance`)
      .expect(200);

    expect(response.body).toMatchObject({
      customerId,
      redeemableBalance: 50,
      lifetimeEarned: 5000,
      tier: 'GOLD',
    });
  });

  it('POST /redemptions succeeds', async () => {
    const customerId = await createCustomer(100, 0);
    const rewardId = await createReward(100);

    const response = await request(app.getHttpServer())
      .post('/redemptions')
      .send({ customerId, rewardId })
      .expect(201);

    expect(response.body).toMatchObject({
      redemptionId: expect.any(String),
      customerId,
      rewardId,
      pointsSpent: 100,
      redeemableBalance: 0,
    });
  });

  it('POST /redemptions returns 409 for insufficient balance', async () => {
    const customerId = await createCustomer(100, 0);
    const rewardId = await createReward(200);

    const response = await request(app.getHttpServer())
      .post('/redemptions')
      .send({ customerId, rewardId })
      .expect(409);

    expect(response.body).toEqual({ error: 'INSUFFICIENT_BALANCE' });
  });

  it('GET /customers/:id/history returns ledger entries', async () => {
    const customerId = await createCustomer(0, 0);

    await request(app.getHttpServer())
      .post('/purchases')
      .send({ customerId, amountPkr: 1000 })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/customers/${customerId}/history`)
      .expect(200);

    expect(response.body.customerId).toBe(customerId);
    expect(response.body.entries).toHaveLength(1);
    expect(response.body.entries[0]).toMatchObject({
      entryType: 'EARN',
      pointsDelta: 10,
      balanceAfter: 10,
      purchaseId: expect.any(String),
      redemptionId: null,
    });
  });

  it('invalid UUID returns 400', async () => {
    const response = await request(app.getHttpServer())
      .get('/customers/not-a-uuid/balance')
      .expect(400);

    expect(response.body.error).toBe('INVALID_REQUEST');
    expect(response.body.message).toContain('UUID');
  });

  it('invalid purchase amount returns 400', async () => {
    const customerId = await createCustomer(0, 0);

    const response = await request(app.getHttpServer())
      .post('/purchases')
      .send({ customerId, amountPkr: 0 })
      .expect(400);

    expect(response.body.error).toBe('INVALID_REQUEST');
  });

  it('missing customer returns 404', async () => {
    const missingCustomerId = randomUUID();

    const response = await request(app.getHttpServer())
      .get(`/customers/${missingCustomerId}/balance`)
      .expect(404);

    expect(response.body).toEqual({ error: 'CUSTOMER_NOT_FOUND' });
  });

  it('missing reward returns 404', async () => {
    const customerId = await createCustomer(100, 0);
    const missingRewardId = randomUUID();

    const response = await request(app.getHttpServer())
      .post('/redemptions')
      .send({ customerId, rewardId: missingRewardId })
      .expect(404);

    expect(response.body).toEqual({ error: 'REWARD_NOT_FOUND' });
  });
});
