import { Module } from '@nestjs/common';
import { DATABASE_POOL, PostgresPool } from './postgres.pool';

@Module({
  providers: [
    PostgresPool,
    {
      provide: DATABASE_POOL,
      useFactory: (postgresPool: PostgresPool) => postgresPool.pool,
      inject: [PostgresPool],
    },
  ],
  exports: [PostgresPool, DATABASE_POOL],
})
export class DatabaseModule {}
