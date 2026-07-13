import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
@Injectable()
export class JsonLogger extends ConsoleLogger {
  protected printMessages(
    messages: unknown[],
    context?: string,
    logLevel: LogLevel = 'log',
    writeStreamType?: 'stdout' | 'stderr',
  ): void {
    const stream =
      writeStreamType === 'stderr' ? process.stderr : process.stdout;
    for (const message of messages) {
      const normalized =
        typeof message === 'string' ? message : JSON.stringify(message);
      stream.write(
        `${JSON.stringify({ timestamp: new Date().toISOString(), level: logLevel, context, message: normalized })}\n`,
      );
    }
  }
}
