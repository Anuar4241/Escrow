import { LoggerService, Injectable } from '@nestjs/common';

@Injectable()
export class JsonLogger implements LoggerService {
  log(message: any, context?: string) {
    this.printLog('info', message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.printLog('error', message, context, trace);
  }

  warn(message: any, context?: string) {
    this.printLog('warn', message, context);
  }

  debug?(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      this.printLog('debug', message, context);
    }
  }

  verbose?(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      this.printLog('verbose', message, context);
    }
  }

  private printLog(level: string, message: any, context?: string, trace?: string) {
    const logObj = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      trace,
    };
    
    // In production, everything outputs to process.stdout as a single JSON line
    // Datadog/ElasticSearch fluentd parsers will pick this up instantly.
    console.log(JSON.stringify(logObj));
  }
}
