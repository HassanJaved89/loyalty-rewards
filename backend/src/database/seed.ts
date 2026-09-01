import * as fs from 'node:fs';
import * as path from 'node:path';
import { Pool } from 'pg';

const CUSTOMER_SEED = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Customer One',
    redeemable_balance: 0,
    lifetime_earned: 0,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Customer Two',
    redeemable_balance: 0,
    lifetime_earned: 4990,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Customer Three',
    redeemable_balance: 0,
    lifetime_earned: 5000,
  },
] as const;

const REWARD_SEED = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Silver Reward', points_cost: 150 },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Gold Reward', points_cost: 300 },
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Free Coffee', points_cost: 75 },
] as const;

async function main(): Promise<void> {
  loadEnvFile(path.join(process.cwd(), '.env'));

  const pool = new Pool({
    host: requiredEnv('DATABASE_HOST'),
    port: Number(requiredEnv('DATABASE_PORT')),
    database: requiredEnv('DATABASE_NAME'),
    user: requiredEnv('DATABASE_USER'),
    password: process.env.DATABASE_PASSWORD ?? '',
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const customer of CUSTOMER_SEED) {
      await client.query(
        `
          INSERT INTO customers (id, name, redeemable_balance, lifetime_earned, created_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (id) DO NOTHING
        `,
        [customer.id, customer.name, customer.redeemable_balance, customer.lifetime_earned],
      );
    }

    for (const reward of REWARD_SEED) {
      await client.query(
        `
          INSERT INTO rewards (id, name, points_cost)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO NOTHING
        `,
        [reward.id, reward.name, reward.points_cost],
      );
    }

    await client.query('COMMIT');
    console.log('Seed data applied');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${key}`);
  }
  return value;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
