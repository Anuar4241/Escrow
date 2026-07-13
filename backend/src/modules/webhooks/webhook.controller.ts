import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../auth/public.decorator';
import { EscrowService } from '../escrow/escrow.service';
import { BankWebhookVerifier } from './bank-webhook-verifier.service';
import { BankWebhookDto } from './dto/bank-webhook.dto';
@ApiTags('Bank webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly escrow: EscrowService,
    private readonly verifier: BankWebhookVerifier,
  ) {}
  @Public()
  @Post('bank')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive a signed event from the bank adapter' })
  @ApiHeader({ name: 'x-bank-timestamp', required: true })
  @ApiHeader({ name: 'x-bank-signature', required: true })
  handleBankWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-bank-signature') signature: string,
    @Headers('x-bank-timestamp') timestamp: string,
    @Body() payload: BankWebhookDto,
  ) {
    if (!request.rawBody)
      throw new BadRequestException('Raw request body is unavailable');
    this.verifier.verify(request.rawBody, signature, timestamp);
    return this.escrow.handleBankWebhook(
      payload,
      this.verifier.payloadHash(request.rawBody),
    );
  }
}
