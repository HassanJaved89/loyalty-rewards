import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const DATABASE_POOL = Symbol('DATABASE_POOL');

@Injectable()
export class PostgresPool implements OnModuleDestroy {
  readonly pool: Pool;

  constructor(config: ConfigService) {
    this.pool = new Pool({
      host: required(config, 'DATABASE_HOST'),
      port: Number(required(config, 'DATABASE_PORT')),
      database: required(config, 'DATABASE_NAME'),
      user: required(config, 'DATABASE_USER'),
      password: config.get<string>('DATABASE_PASSWORD') ?? '',
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

function required(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${key}`);
  }
  return value;
}
