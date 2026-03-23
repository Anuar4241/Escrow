import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface SupportResponse {
  message: string;
  suggestedNextSteps: string[];
  escalationRequired: boolean;
}

@Injectable()
export class SupportAgent {
  private readonly logger = new Logger(SupportAgent.name);
  private readonly client: Anthropic;

  private readonly FAQ = `
## Escrow Platform FAQ

**What is escrow?**
Escrow is a secure holding service where funds are held by a trusted third party until both buyer and seller fulfill their obligations.

**Status meanings:**
- awaiting_payment: Waiting for buyer to complete payment
- funded: Payment received and secured in escrow
- awaiting_seller_action: Seller needs to ship or hand over the item
- shipped: Item sent via courier, awaiting delivery confirmation
- handed_over: Item handed over in person, awaiting confirmation
- awaiting_buyer_confirmation: Item delivered, buyer needs to confirm receipt
- completed: Deal successful, funds released to seller
- dispute_opened: A dispute has been filed and is under review
- under_review: Moderators are actively reviewing the dispute
- payout_approved: Funds approved for release to seller
- refund_approved: Refund approved for buyer
- refunded: Buyer has been refunded
- cancelled: Deal cancelled before funding
- expired: Deal expired before completion

**How long does escrow take?**
Standard deals complete in 2-7 days depending on shipping. Payment must be made within 2 days of deal creation.

**What fees does the platform charge?**
The platform charges a 1.5% escrow service fee on the transaction amount.

**How do I open a dispute?**
If there is a problem with your transaction (item not received, item not as described, etc.), you can open a dispute. Disputes can be filed once the item is shipped or handed over.

**How are disputes resolved?**
Our moderation team reviews all evidence from both parties. Resolution typically takes 3-5 business days. The outcome is either a seller payout (seller wins) or buyer refund (buyer wins).

**When will I receive my funds?**
After a deal is marked COMPLETED or PAYOUT_APPROVED, funds are transferred to your account within 1-3 business days depending on your bank.
`;

  constructor(private readonly prisma: PrismaService) {
    this.client = new Anthropic();
  }

  async handleQuery(escrowId: string, userQuestion: string, userId: string): Promise<SupportResponse> {
    this.logger.log(`Support query for escrow ${escrowId} from user ${userId}`);

    const tools: Anthropic.Tool[] = [
      {
        name: 'get_escrow_status',
        description: 'Retrieves the current status and key details of an escrow deal',
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
        description: 'Retrieves the full history of status changes for the escrow deal to understand what has happened',
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
        content: `You are a helpful and empathetic customer support agent for an escrow platform.

PLATFORM FAQ:
${this.FAQ}

A user (ID: ${userId}) has a question about escrow deal: ${escrowId}

Their question: "${userQuestion}"

Use the available tools to check the current status and history of their escrow deal. Then provide a clear, helpful, and concise response.

Your final response MUST be a valid JSON object in exactly this format:
{
  "message": "Your helpful response to the user",
  "suggestedNextSteps": ["Step 1 the user should take", "Step 2"],
  "escalationRequired": true or false
}

Set escalationRequired to true only if the situation requires human moderator intervention (e.g., the user reports fraud, or has a complex dispute that cannot be resolved with standard guidance).`,
      },
    ];

    while (true) {
      const response = await this.client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 2048,
        tools,
        messages,
      });

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b) => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('Agent did not return a text response');
        }
        return this.parseSupportJson(textBlock.text);
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
        case 'get_escrow_status': {
          const deal = await this.prisma.escrowDeal.findUnique({
            where: { id: input.escrow_id },
          });
          if (!deal) return JSON.stringify({ error: 'Escrow deal not found' });
          return JSON.stringify({
            id: deal.id,
            status: deal.status,
            amount: deal.amount.toString(),
            currency: deal.currency,
            createdAt: deal.createdAt.toISOString(),
            expiresAt: deal.expiresAt?.toISOString(),
          });
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

  private parseSupportJson(text: string): SupportResponse {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Agent response did not contain a JSON support response block');
    const parsed = JSON.parse(match[0]);
    if (!parsed.message || !Array.isArray(parsed.suggestedNextSteps)) {
      throw new Error('Agent response JSON is missing required fields');
    }
    return parsed as SupportResponse;
  }
}
