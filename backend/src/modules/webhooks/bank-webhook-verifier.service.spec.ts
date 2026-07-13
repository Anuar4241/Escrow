import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { BankWebhookVerifier } from './bank-webhook-verifier.service';
describe('BankWebhookVerifier', () => {
  const secret = 'bank-webhook-secret-with-at-least-32-characters';
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'BANK_WEBHOOK_SECRET' ? secret : 300,
    ),
  } as unknown as ConfigService;
  const verifier = new BankWebhookVerifier(config);
  const body = Buffer.from('{"eventId":"bank-event-1"}');
  it('accepts valid signatures', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret)
      .update(Buffer.concat([Buffer.from(`${timestamp}.`), body]))
      .digest('hex');
    expect(() =>
      verifier.verify(body, signature, `${timestamp}`),
    ).not.toThrow();
  });
  it('rejects stale events', () =>
    expect(() =>
      verifier.verify(
        body,
        'a'.repeat(64),
        `${Math.floor(Date.now() / 1000) - 301}`,
      ),
    ).toThrow('outside tolerance'));
  it('hashes exact bytes', () =>
    expect(verifier.payloadHash(body)).toHaveLength(64));
});
