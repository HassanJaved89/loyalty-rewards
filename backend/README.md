# Loyalty and Rewards

A small loyalty and rewards service built with NestJS, TypeScript, PostgreSQL, and React.

## How to run

### Backend

```bash
cd backend
npm install

Create a PostgreSQL database named loyalty_rewards, then configure backend/.env using .env.example.

Run migrations and seed data:

npm run migrate
npm run seed
npm run start:dev

The API runs on http://localhost:3000.

Frontend
cd frontend
npm install
npm run dev

The frontend runs on http://localhost:5173.


Decisions
PostgreSQL is the source of truth for customers, rewards, balances, and the point ledger.
Loyalty rules are isolated in a separate rules module.
Purchases and redemptions use PostgreSQL transactions.
Customer rows are locked with SELECT FOR UPDATE during balance-changing operations to prevent concurrent redemptions from making the balance negative.
Lifetime earned points are cumulative and are not reduced when points are redeemed.
Parameterized SQL with pg is used instead of an ORM to keep the implementation small and explicit.
Authentication was not implemented because it was outside the assessment scope.
With more time
Add authentication and authorization.
Add customer and reward listing endpoints instead of relying on seeded customer/reward IDs in the demo UI.
Add pagination and filtering to transaction history.
Add stronger request validation and more API-level test coverage.
Add production deployment, logging, monitoring, and observability.