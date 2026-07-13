import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';
export class CreateEscrowDto {
  @ApiProperty() @IsUUID() orderId: string;
  @ApiProperty() @IsUUID() sellerId: string;
  @ApiProperty({ example: '100000.00' })
  @IsString()
  @Matches(/^\d{1,16}(\.\d{1,2})?$/)
  amount: string;
  @ApiProperty({ example: 'KZT' }) @IsIn(['KZT']) currency: 'KZT';
  @ApiProperty() @IsObject() listingState: Record<string, unknown>;
  @ApiProperty() @IsObject() agreementFlags: Record<string, unknown>;
}
export class TransitionEscrowDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion: number;
}
export class ConfirmShipmentDto extends TransitionEscrowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 100)
  trackingNumber?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  carrier?: string;
}
export class OpenDisputeDto extends TransitionEscrowDto {
  @ApiProperty() @IsString() @IsNotEmpty() @Length(10, 2000) reason: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() evidence?: Record<
    string,
    unknown
  >;
}
export const DISPUTE_OUTCOMES = ['PAYOUT_SELLER', 'REFUND_BUYER'] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];
export class ResolveDisputeDto extends TransitionEscrowDto {
  @ApiProperty({ enum: DISPUTE_OUTCOMES })
  @IsIn(DISPUTE_OUTCOMES)
  outcome: DisputeOutcome;
  @ApiProperty() @IsString() @Length(10, 4000) resolutionNotes: string;
}
