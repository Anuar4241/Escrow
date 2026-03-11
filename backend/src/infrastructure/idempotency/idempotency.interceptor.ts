import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import Redis from 'ioredis';

// Simulated Redis idempotency store, usually injected globally
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['x-idempotency-key'];

    if (!idempotencyKey) {
      // For safely strictly mutating APIs
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
         throw new HttpException('x-idempotency-key header is required', HttpStatus.BAD_REQUEST);
      }
      return next.handle();
    }

    const cachedResponse = await redisClient.get(`idempo:res:${idempotencyKey}`);
    if (cachedResponse) {
      // Safely return identical response if key was already processed
      return of(JSON.parse(cachedResponse));
    }

    const locked = await redisClient.set(`idempo:lock:${idempotencyKey}`, 'LOCKED', 'EX', 10, 'NX');
    if (!locked) {
      throw new HttpException('Request already in-flight for this Idempotency Key', HttpStatus.CONFLICT);
    }

    return next.handle().pipe(
      tap(async (response) => {
        // Save terminal response to cache for 24 hours
        await redisClient.set(`idempo:res:${idempotencyKey}`, JSON.stringify(response), 'EX', 86400);
        await redisClient.del(`idempo:lock:${idempotencyKey}`);
      })
    );
  }
}
