import { IsUUID, IsInt, IsNumber, IsString, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEscrowDto {
  @ApiProperty({ description: 'The related Order or Listing UUID' })
  @IsUUID()
  orderId: string;

  @ApiProperty()
  @IsUUID()
  buyerId: string;

  @ApiProperty()
  @IsUUID()
  sellerId: string;

  @ApiProperty({ description: 'Original item price amount' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Platform application fee' })
  @IsNumber()
  @Min(0)
  txFee: number;
}

export class TransitionEscrowDto {
  @ApiProperty({ description: 'Optimistic concurrency version integer to prevent race conditions' })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class FundEscrowDto extends TransitionEscrowDto {
  @ApiProperty({ description: 'The ID from the payment provider transaction' })
  @IsString()
  @IsNotEmpty()
  providerTxId: string;
}

export class OpenDisputeDto extends TransitionEscrowDto {
  @ApiProperty({ description: 'Reason for opening the dispute' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ description: 'The UUID of the user opening the dispute' })
  @IsUUID()
  openedById: string;
}
