CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  redeemable_balance INTEGER NOT NULL DEFAULT 0 CHECK (redeemable_balance >= 0),
  lifetime_earned INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers (id),
  amount_pkr INTEGER NOT NULL CHECK (amount_pkr > 0),
  points_earned INTEGER NOT NULL CHECK (points_earned >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0)
);

CREATE TABLE redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers (id),
  reward_id UUID NOT NULL REFERENCES rewards (id),
  points_spent INTEGER NOT NULL CHECK (points_spent > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE point_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers (id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('EARN', 'REDEEM')),
  points_delta INTEGER NOT NULL CHECK (points_delta <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  purchase_id UUID REFERENCES purchases (id),
  redemption_id UUID REFERENCES redemptions (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (
      entry_type = 'EARN'
      AND points_delta > 0
      AND purchase_id IS NOT NULL
      AND redemption_id IS NULL
    )
    OR
    (
      entry_type = 'REDEEM'
      AND points_delta < 0
      AND redemption_id IS NOT NULL
      AND purchase_id IS NULL
    )
  )
);

CREATE INDEX point_ledger_customer_created_idx
  ON point_ledger (customer_id, created_at DESC);
