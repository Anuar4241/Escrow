import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
@Injectable()
export class BankWebhookVerifier {
  constructor(private readonly config: ConfigService) {}
  verify(
    rawBody: Buffer,
    signatureHeader: string,
    timestampHeader: string,
  ): void {
    if (!rawBody.length || !signatureHeader || !timestampHeader)
      throw new UnauthorizedException('Missing bank webhook signature');
    const timestamp = Number(timestampHeader);
    const tolerance = this.config.getOrThrow<number>(
      'BANK_WEBHOOK_TOLERANCE_SECONDS',
    );
    if (
      !Number.isInteger(timestamp) ||
      Math.abs(Math.floor(Date.now() / 1000) - timestamp) > tolerance
    )
      throw new UnauthorizedException(
        'Bank webhook timestamp is outside tolerance',
      );
    const receivedHex = signatureHeader.replace(/^sha256=/, '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(receivedHex))
      throw new UnauthorizedException('Malformed bank webhook signature');
    const expected = createHmac(
      'sha256',
      this.config.getOrThrow<string>('BANK_WEBHOOK_SECRET'),
    )
      .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody]))
      .digest();
    const received = Buffer.from(receivedHex, 'hex');
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw new UnauthorizedException('Invalid bank webhook signature');
  }
  payloadHash(rawBody: Buffer): string {
    return createHash('sha256').update(rawBody).digest('hex');
  }
}
