import { Controller, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { AgentsService } from './agents.service';

export class SupportQueryDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsNotEmpty()
  question: string;
}

@ApiTags('AI Agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('disputes/:escrowId/analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dispute Resolution Agent',
    description:
      'Runs the AI dispute resolution agent on an escrow deal under UNDER_REVIEW status. Returns a recommendation to either payout the seller or refund the buyer.',
  })
  @ApiParam({ name: 'escrowId', description: 'UUID of the escrow deal in dispute' })
  @ApiResponse({ status: 200, description: 'AI resolution recommendation returned' })
  async analyzeDispute(@Param('escrowId') escrowId: string) {
    return this.agentsService.resolveDispute(escrowId);
  }

  @Post('risk/:escrowId/analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Risk Analysis Agent',
    description:
      'Runs the AI risk analysis agent on an escrow deal. Returns a risk score, level, and recommended action for the platform.',
  })
  @ApiParam({ name: 'escrowId', description: 'UUID of the escrow deal to analyze' })
  @ApiResponse({ status: 200, description: 'AI risk assessment returned' })
  async analyzeRisk(@Param('escrowId') escrowId: string) {
    return this.agentsService.analyzeRisk(escrowId);
  }

  @Post('support/:escrowId/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Customer Support Agent',
    description:
      'Runs the AI customer support agent to answer a user question about their escrow deal. Returns a helpful response and suggested next steps.',
  })
  @ApiParam({ name: 'escrowId', description: 'UUID of the escrow deal the user is asking about' })
  @ApiBody({ type: SupportQueryDto })
  @ApiResponse({ status: 200, description: 'AI support response returned' })
  async handleSupportQuery(
    @Param('escrowId') escrowId: string,
    @Body() body: SupportQueryDto,
  ) {
    return this.agentsService.handleSupportQuery(escrowId, body.question, body.userId);
  }
}
