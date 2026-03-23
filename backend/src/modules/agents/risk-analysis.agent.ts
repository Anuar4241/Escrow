import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface RiskAnalysisResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number; // 0–100
  flags: string[];
  reasoning: string;
  recommendedAction: string;
}

@Injectable()
export class RiskAnalysisAgent {
  private readonly logger = new Logger(RiskAnalysisAgent.name);
  private readonly client: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.client = new Anthropic();
  }

  async analyzeRisk(escrowId: string): Promise<RiskAnalysisResult> {
    this.logger.log(`Starting risk analysis for escrow ${escrowId}`);

    const tools: Anthropic.Tool[] = [
      {
        name: 'get_escrow_details',
        description: 'Retrieves the escrow deal details including amounts, currency, status, buyer and seller IDs',
        input_schema: {
          type: 'object',
          properties: {
            escrow_id: { type: 'string', description: 'The escrow deal UUID' },
          },
          required: ['escrow_id'],
        },
      },
      {
        name: 'get_buyer_deal_history',
        description: 'Returns a summary of all past escrow deals involving this buyer — statuses, dispute count, total volume',
        input_schema: {
          type: 'object',
          properties: {
            buyer_id: { type: 'string', description: 'The buyer user UUID' },
          },
          required: ['buyer_id'],
        },
      },
      {
        name: 'get_seller_deal_history',
        description: 'Returns a summary of all past escrow deals involving this seller — statuses, dispute count, total volume',
        input_schema: {
          type: 'object',
          properties: {
            seller_id: { type: 'string', description: 'The seller user UUID' },
          },
          required: ['seller_id'],
        },
      },
      {
        name: 'get_status_timeline',
        description: 'Returns the chronological status transition history for the escrow deal',
        input_schema: {
          type: 'object',
          properties: {
            escrow_id: { type: 'string', description: 'The escrow deal UUID' },
          },
          required: ['escrow_id'],
        },
      },
    ];

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `You are a financial risk analyst specializing in escrow fraud detection. Analyze the risk profile of escrow deal: ${escrowId}.

Use all available tools to collect full data on the deal, the buyer, and the seller. Look for:
- Unusually large transaction amounts
- Accounts with high dispute rates
- Suspicious timing patterns in status transitions
- First-time large transactions from new accounts
- Mismatched amounts or unusual fee ratios

Your final response MUST be a valid JSON object in exactly this format:
{
  "riskLevel": "LOW", "MEDIUM", "HIGH", or "CRITICAL",
  "riskScore": integer from 0 to 100,
  "flags": ["Flag 1", "Flag 2"],
  "reasoning": "Detailed risk assessment",
  "recommendedAction": "What the platform should do (e.g. proceed normally, flag for review, freeze and investigate)"
}`,
      },
    ];

    while (true) {
      const response = await this.client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        tools,
        messages,
      });

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b) => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('Agent did not return a text response');
        }
        return this.parseRiskJson(textBlock.text);
      }

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const result = await this.executeTool(block.name, block.input as Record<string, string>);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }

  private async executeTool(name: string, input: Record<string, string>): Promise<string> {
    try {
      switch (name) {
        case 'get_escrow_details': {
          const deal = await this.prisma.escrowDeal.findUnique({
            where: { id: input.escrow_id },
          });
          if (!deal) return JSON.stringify({ error: 'Escrow not found' });
          return JSON.stringify({
            id: deal.id,
            status: deal.status,
            amount: deal.amount.toString(),
            applicationFee: deal.applicationFee.toString(),
            totalEscrowed: deal.totalEscrowed.toString(),
            currency: deal.currency,
            buyerId: deal.buyerId,
            sellerId: deal.sellerId,
            createdAt: deal.createdAt.toISOString(),
            expiresAt: deal.expiresAt?.toISOString(),
          });
        }
        case 'get_buyer_deal_history': {
          const deals = await this.prisma.escrowDeal.findMany({
            where: { buyerId: input.buyer_id },
            include: { dispute: true },
          });
          return JSON.stringify(this.summarizeDeals(deals));
        }
        case 'get_seller_deal_history': {
          const deals = await this.prisma.escrowDeal.findMany({
            where: { sellerId: input.seller_id },
            include: { dispute: true },
          });
          return JSON.stringify(this.summarizeDeals(deals));
        }
        case 'get_status_timeline': {
          const history = await this.prisma.escrowStatusHistory.findMany({
            where: { escrowId: input.escrow_id },
            orderBy: { changedAt: 'asc' },
          });
          return JSON.stringify(
            history.map((h) => ({
              previousStatus: h.previousStatus,
              newStatus: h.newStatus,
              triggerEvent: h.triggerEvent,
              changedAt: h.changedAt.toISOString(),
            })),
          );
        }
        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    } catch (err) {
      this.logger.error(`Tool ${name} failed: ${err.message}`);
      return JSON.stringify({ error: err.message });
    }
  }

  private summarizeDeals(deals: any[]): object {
    const total = deals.length;
    const completed = deals.filter((d) => d.status === 'completed').length;
    const disputed = deals.filter((d) => d.dispute !== null).length;
    const cancelled = deals.filter((d) => d.status === 'cancelled' || d.status === 'refunded').length;
    const totalVolume = deals.reduce((sum, d) => sum + parseFloat(d.totalEscrowed.toString()), 0);

    return {
      totalDeals: total,
      completedDeals: completed,
      disputedDeals: disputed,
      cancelledOrRefundedDeals: cancelled,
      disputeRate: total > 0 ? ((disputed / total) * 100).toFixed(1) + '%' : '0%',
      totalVolume: totalVolume.toFixed(2),
      recentStatuses: deals.slice(-5).map((d) => d.status),
    };
  }

  private parseRiskJson(text: string): RiskAnalysisResult {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Agent response did not contain a JSON risk assessment block');
    const parsed = JSON.parse(match[0]);
    if (!parsed.riskLevel || parsed.riskScore === undefined) {
      throw new Error('Agent response JSON is missing required fields');
    }
    return parsed as RiskAnalysisResult;
  }
}
