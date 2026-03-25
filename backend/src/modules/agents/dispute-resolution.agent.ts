import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface DisputeResolutionResult {
  recommendation: 'PAYOUT_SELLER' | 'REFUND_BUYER';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  keyFactors: string[];
}

@Injectable()
export class DisputeResolutionAgent {
  private readonly logger = new Logger(DisputeResolutionAgent.name);
  private readonly client: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.client = new Anthropic();
  }

  async analyzeDispute(escrowId: string): Promise<DisputeResolutionResult> {
    this.logger.log(`Starting dispute analysis for escrow ${escrowId}`);

    const tools: Anthropic.Tool[] = [
      {
        name: 'get_escrow_details',
        description: 'Retrieves full details of an escrow deal including buyer, seller, amounts and current status',
        input_schema: {
          type: 'object',
          properties: {
            escrow_id: { type: 'string', description: 'The escrow deal UUID' },
          },
          required: ['escrow_id'],
        },
      },
      {
        name: 'get_dispute_details',
        description: 'Retrieves the dispute case details including the reason filed and current resolution status',
        input_schema: {
          type: 'object',
          properties: {
            escrow_id: { type: 'string', description: 'The escrow deal UUID' },
          },
          required: ['escrow_id'],
        },
      },
      {
        name: 'get_status_timeline',
        description: 'Retrieves the full chronological audit trail of all status transitions for the escrow deal',
        input_schema: {
          type: 'object',
          properties: {
            escrow_id: { type: 'string', description: 'The escrow deal UUID' },
          },
          required: ['escrow_id'],
        },
      },
      {
        name: 'get_payment_transactions',
        description: 'Retrieves all payment transactions (charges, refunds, payouts) linked to the escrow deal',
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
        content: `You are a neutral escrow dispute arbitrator. Analyze the dispute for escrow deal ID: ${escrowId}.

Use all available tools to gather complete information, then provide your resolution recommendation.

Your final response MUST be a valid JSON object in exactly this format:
{
  "recommendation": "PAYOUT_SELLER" or "REFUND_BUYER",
  "confidence": "HIGH", "MEDIUM", or "LOW",
  "reasoning": "Detailed explanation of your decision",
  "keyFactors": ["Factor 1", "Factor 2", "Factor 3"]
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
        return this.parseResolutionJson(textBlock.text);
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
    const escrowId = input.escrow_id;
    try {
      switch (name) {
        case 'get_escrow_details': {
          const deal = await this.prisma.escrowDeal.findUnique({ where: { id: escrowId } });
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
        case 'get_dispute_details': {
          const dispute = await this.prisma.disputeCase.findUnique({ where: { escrowId } });
          if (!dispute) return JSON.stringify({ error: 'No dispute found for this escrow' });
          return JSON.stringify({
            id: dispute.id,
            openedById: dispute.openedById,
            reason: dispute.reason,
            status: dispute.status,
            resolutionNotes: dispute.resolutionNotes,
            createdAt: dispute.createdAt.toISOString(),
            resolvedAt: dispute.resolvedAt?.toISOString(),
          });
        }
        case 'get_status_timeline': {
          const history = await this.prisma.escrowStatusHistory.findMany({
            where: { escrowId },
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
        case 'get_payment_transactions': {
          const txs = await this.prisma.paymentTransaction.findMany({ where: { escrowId } });
          return JSON.stringify(
            txs.map((t) => ({
              intentType: t.intentType,
              status: t.status,
              amount: t.amount.toString(),
              providerTxId: t.providerTxId,
              createdAt: t.createdAt.toISOString(),
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

  private parseResolutionJson(text: string): DisputeResolutionResult {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Agent response did not contain a JSON resolution block');
    const parsed = JSON.parse(match[0]);
    if (!parsed.recommendation || !parsed.confidence || !parsed.reasoning) {
      throw new Error('Agent response JSON is missing required fields');
    }
    return parsed as DisputeResolutionResult;
  }
}
