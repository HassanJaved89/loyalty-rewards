INSERT INTO customers (id, name, redeemable_balance, lifetime_earned)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'Customer One', 0, 0),
  ('22222222-2222-4222-8222-222222222222', 'Customer Two', 0, 4990),
  ('33333333-3333-4333-8333-333333333333', 'Customer Three', 0, 5000);

INSERT INTO rewards (id, name, points_cost)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Silver Reward', 150),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Gold Reward', 300),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Free Coffee', 75);
