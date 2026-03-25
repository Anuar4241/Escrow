import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { DisputeResolutionAgent } from './dispute-resolution.agent';
import { RiskAnalysisAgent } from './risk-analysis.agent';
import { SupportAgent } from './support.agent';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Module({
  controllers: [AgentsController],
  providers: [
    AgentsService,
    DisputeResolutionAgent,
    RiskAnalysisAgent,
    SupportAgent,
    PrismaService,
  ],
  exports: [AgentsService],
})
export class AgentsModule {}
