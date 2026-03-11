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
  @ApiOperation({ summary: 'Create a new escrow deal (draft/awaiting payment)' })
  @ApiResponse({ status: 201, description: 'Escrow deal initiated' })
  async createEscrow(@Body() body: CreateEscrowDto) {
    return this.escrowService.createEscrow(body);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get full immutable audit timeline for a specific escrow' })
  async getTimeline(@Param('id') id: string) {
    return this.escrowService.getTimeline(id);
  }

  @Post(':id/fund')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Internal PSP webhook to fund an escrow' })
  @ApiHeader({ name: 'x-idempotency-key', required: true, description: 'Unique hash to prevent double funding' })
  async fundEscrow(@Param('id') id: string, @Body() body: FundEscrowDto) {
    return this.escrowService.fundEscrow(id, body.expectedVersion, body.providerTxId);
  }

  @Post(':id/confirm-shipment')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Seller confirms shipment or handover' })
  @ApiHeader({ name: 'x-idempotency-key', required: true })
  async confirmShipment(@Param('id') id: string, @Body() body: TransitionEscrowDto) {
    return this.escrowService.confirmShipment(id, body.expectedVersion);
  }

  @Post(':id/confirm-delivery')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Buyer confirms receipt of goods' })
  @ApiHeader({ name: 'x-idempotency-key', required: true })
  async confirmDelivery(@Param('id') id: string, @Body() body: TransitionEscrowDto) {
    return this.escrowService.confirmDelivery(id, body.expectedVersion);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Release funds from completed escrow towards seller payout' })
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

