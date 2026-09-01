export class CustomerNotFound extends Error {
  constructor(customerId: string) {
    super(`Customer not found: ${customerId}`);
    this.name = 'CustomerNotFound';
  }
}

export class RewardNotFound extends Error {
  constructor(rewardId: string) {
    super(`Reward not found: ${rewardId}`);
    this.name = 'RewardNotFound';
  }
}

export class InsufficientBalance extends Error {
  constructor(customerId: string, required: number, available: number) {
    super(
      `Insufficient balance for customer ${customerId}: required ${required}, available ${available}`,
    );
    this.name = 'InsufficientBalance';
  }
}
