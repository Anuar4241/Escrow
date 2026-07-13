import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles } from '../../auth/roles.decorator';
import { IdempotencyInterceptor } from '../../infrastructure/idempotency/idempotency.interceptor';
import {
  ConfirmShipmentDto,
  CreateEscrowDto,
  OpenDisputeDto,
  ResolveDisputeDto,
  TransitionEscrowDto,
} from './dto/escrow.dto';
import { EscrowService } from './escrow.service';
@ApiTags('Escrows')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-idempotency-key',
  required: false,
  description: 'Required for mutating requests',
})
@UseInterceptors(IdempotencyInterceptor)
@Controller('escrows')
export class EscrowController {
  constructor(private readonly service: EscrowService) {}
  @Get() list(@CurrentUser() actor: AuthUser) {
    return this.service.listDeals(actor);
  }
  @Post() @Roles('BUYER', 'ADMIN') create(
    @Body() body: CreateEscrowDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.createEscrow(body, actor);
  }
  @Get(':id') get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.getDeal(id, actor);
  }
  @Get(':id/timeline') timeline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.getTimeline(id, actor);
  }
  @Post(':id/confirm-shipment')
  @Roles('SELLER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  confirmShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfirmShipmentDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.confirmShipment(id, body, actor);
  }
  @Post(':id/mark-delivered')
  @Roles('BUYER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  markDelivered(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionEscrowDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.markDelivered(id, body.expectedVersion, actor);
  }
  @Post(':id/release')
  @Roles('BUYER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionEscrowDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.releaseFunds(id, body.expectedVersion, actor);
  }
  @Post(':id/cancel') @Roles('BUYER', 'ADMIN') @HttpCode(HttpStatus.OK) cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionEscrowDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.cancel(id, body.expectedVersion, actor);
  }
  @Post(':id/open-dispute')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  openDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: OpenDisputeDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.openDispute(id, body, actor);
  }
  @Post(':id/resolve-dispute')
  @Roles('MODERATOR', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResolveDisputeDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.resolveDispute(id, body, actor);
  }
}
