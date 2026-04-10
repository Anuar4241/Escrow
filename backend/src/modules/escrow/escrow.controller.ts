import { Controller, Post, Get, Param, Body, UseInterceptors, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { EscrowService } from './escrow.service';
import { IdempotencyInterceptor } from '../../infrastructure/idempotency/idempotency.interceptor';
import { CreateEscrowDto, TransitionEscrowDto, FundEscrowDto, OpenDisputeDto } from './dto/escrow.dto';

@ApiTags('Escrows')
@Controller('escrows')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new escrow deal (awaiting payment)' })
  @ApiResponse({ status: 201, description: 'Escrow deal initiated' })
  async createEscrow(@Body() body: CreateEscrowDto) {
    return this.escrowService.createEscrow(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get current state of an escrow deal' })
  @ApiResponse({ status: 200, description: 'Escrow deal record' })
  async getDeal(@Param('id') id: string) {
    return this.escrowService.getDeal(id);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get full immutable audit timeline for a specific escrow' })
  async getTimeline(@Param('id') id: string) {
    return this.escrowService.getTimeline(id);
  }

  @Post(':id/fund')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'PSP webhook: mark escrow as funded (AWAITING_PAYMENT → FUNDED)' })
  @ApiHeader({ name: 'x-idempotency-key', required: true, description: 'Unique hash to prevent double funding' })
  async fundEscrow(@Param('id') id: string, @Body() body: FundEscrowDto) {
    return this.escrowService.fundEscrow(id, body.expectedVersion, body.providerTxId);
  }

  @Post(':id/notify-seller')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Notify seller that payment is confirmed and shipment is required (FUNDED → AWAITING_SELLER_ACTION)' })
  @ApiHeader({ name: 'x-idempotency-key', required: true })
  async notifySeller(@Param('id') id: string, @Body() body: TransitionEscrowDto) {
    return this.escrowService.notifySeller(id, body.expectedVersion);
  }

  @Post(':id/confirm-shipment')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Seller confirms shipment or handover (AWAITING_SELLER_ACTION → SHIPPED)' })
  @ApiHeader({ name: 'x-idempotency-key', required: true })
  async confirmShipment(@Param('id') id: string, @Body() body: TransitionEscrowDto) {
    return this.escrowService.confirmShipment(id, body.expectedVersion);
  }

  @Post(':id/mark-delivered')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Mark item as delivered to buyer, awaiting buyer confirmation (SHIPPED → AWAITING_BUYER_CONFIRMATION)' })
  @ApiHeader({ name: 'x-idempotency-key', required: true })
  async markDelivered(@Param('id') id: string, @Body() body: TransitionEscrowDto) {
    return this.escrowService.markDelivered(id, body.expectedVersion);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Buyer confirms receipt and releases funds to seller (AWAITING_BUYER_CONFIRMATION → COMPLETED)' })
  @ApiHeader({ name: 'x-idempotency-key', required: true })
  async releaseFunds(@Param('id') id: string, @Body() body: TransitionEscrowDto) {
    return this.escrowService.releaseFunds(id, body.expectedVersion);
  }

  @Post(':id/open-dispute')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Open a dispute against an active escrow' })
  @ApiHeader({ name: 'x-idempotency-key', required: true })
  async openDispute(@Param('id') id: string, @Body() body: OpenDisputeDto) {
    return this.escrowService.openDispute(id, body.expectedVersion, body.reason, body.openedById);
  }
}

