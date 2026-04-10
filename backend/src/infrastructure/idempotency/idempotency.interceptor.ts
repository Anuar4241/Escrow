import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import Redis from 'ioredis';

// Use REDIS_HOST/REDIS_PORT to match docker-compose and k8s environment variables
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
});

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['x-idempotency-key'];

    if (!idempotencyKey) {
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
         throw new HttpException('x-idempotency-key header is required', HttpStatus.BAD_REQUEST);
      }
      return next.handle();
    }

    const cachedResponse = await redisClient.get(`idempo:res:${idempotencyKey}`);
    if (cachedResponse) {
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
      }),
      catchError((error) => {
        // Always release the lock on failure so the client can retry immediately
        redisClient.del(`idempo:lock:${idempotencyKey}`).catch(() => {});
        return throwError(() => error);
      }),
    );
  }
}
