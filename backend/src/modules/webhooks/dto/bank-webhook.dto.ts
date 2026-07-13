import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
export const BANK_EVENT_TYPES = [
  'HOLD_SUCCEEDED',
  'HOLD_FAILED',
  'PAYOUT_SUCCEEDED',
  'PAYOUT_FAILED',
  'REFUND_SUCCEEDED',
  'REFUND_FAILED',
] as const;
export type BankEventType = (typeof BANK_EVENT_TYPES)[number];
export class BankWebhookDto {
  @ApiProperty() @IsString() @Length(8, 160) eventId: string;
  @ApiProperty({ enum: BANK_EVENT_TYPES })
  @IsIn(BANK_EVENT_TYPES)
  type: BankEventType;
  @ApiProperty() @IsUUID() escrowId: string;
  @ApiProperty({ example: '100000.00' })
  @IsString()
  @Matches(/^\d{1,16}(\.\d{1,2})?$/)
  amount: string;
  @ApiProperty({ example: 'KZT' }) @IsIn(['KZT']) currency: 'KZT';
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  providerTransactionId: string;
}
