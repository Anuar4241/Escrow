import { validateEnvironment } from './environment';
describe('validateEnvironment', () => {
  it('provides development defaults', () =>
    expect(validateEnvironment({ NODE_ENV: 'test' }).ESCROW_FEE_BPS).toBe(150));
  it('requires production configuration', () =>
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_URL',
    ));
  it('requires RabbitMQ for outbox publishing', () =>
    expect(() =>
      validateEnvironment({ OUTBOX_PUBLISHER_ENABLED: 'true' }),
    ).toThrow('RABBITMQ_URL'));
});
