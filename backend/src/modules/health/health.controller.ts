import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/public.decorator';
import { HealthService } from './health.service';
@Public()
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Get('live') live() {
    return { status: 'ok' };
  }
  @Get('ready') async ready() {
    const result = await this.health.readiness();
    if (result.status !== 'ok') throw new ServiceUnavailableException(result);
    return result;
  }
}
