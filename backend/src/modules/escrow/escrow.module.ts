import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Module({
  controllers: [EscrowController],
  providers: [EscrowService, PrismaService],
  exports: [EscrowService],
})
export class EscrowModule {}
