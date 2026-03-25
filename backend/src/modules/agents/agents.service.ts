import { Injectable } from '@nestjs/common';
import { DisputeResolutionAgent, DisputeResolutionResult } from './dispute-resolution.agent';
import { RiskAnalysisAgent, RiskAnalysisResult } from './risk-analysis.agent';
import { SupportAgent, SupportResponse } from './support.agent';

@Injectable()
export class AgentsService {
  constructor(
    private readonly disputeAgent: DisputeResolutionAgent,
    private readonly riskAgent: RiskAnalysisAgent,
    private readonly supportAgent: SupportAgent,
  ) {}

  async resolveDispute(escrowId: string): Promise<DisputeResolutionResult> {
    return this.disputeAgent.analyzeDispute(escrowId);
  }

  async analyzeRisk(escrowId: string): Promise<RiskAnalysisResult> {
    return this.riskAgent.analyzeRisk(escrowId);
  }

  async handleSupportQuery(escrowId: string, question: string, userId: string): Promise<SupportResponse> {
    return this.supportAgent.handleQuery(escrowId, question, userId);
  }
}
