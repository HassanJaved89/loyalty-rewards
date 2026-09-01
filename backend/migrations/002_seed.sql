INSERT INTO customers (id, name, redeemable_balance, lifetime_earned)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'Silver Customer', 0, 0),
  ('22222222-2222-4222-8222-222222222222', 'Gold Customer', 0, 0);

INSERT INTO rewards (id, name, points_cost)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Silver Reward', 150),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Gold Reward', 300),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Free Coffee', 75);
