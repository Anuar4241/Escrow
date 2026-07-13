import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Request } from 'express';
import {
  Observable,
  catchError,
  from,
  map,
  mergeMap,
  of,
  throwError,
} from 'rxjs';
import { AuthUser } from '../../auth/auth-user';
import { RedisService } from '../redis/redis.service';
interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  rawBody?: Buffer;
}
interface CachedEnvelope {
  fingerprint: string;
  response: unknown;
}
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  constructor(private readonly redis: RedisService) {}
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method))
      return next.handle();
    const providedKey = request.headers['x-idempotency-key'];
    if (
      typeof providedKey !== 'string' ||
      !/^[A-Za-z0-9._:-]{8,160}$/.test(providedKey)
    )
      throw new BadRequestException(
        'x-idempotency-key must contain 8-160 safe characters',
      );
    const scope = [
      request.user?.id ?? 'anonymous',
      request.method,
      request.originalUrl.split('?')[0],
      providedKey,
    ].join(':');
    const digest = createHash('sha256').update(scope).digest('hex');
    const responseKey = `idempotency:response:${digest}`;
    const lockKey = `idempotency:lock:${digest}`;
    const fingerprint = createHash('sha256')
      .update(
        request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? null)),
      )
      .digest('hex');
    const lockToken = randomUUID();
    const cached = await this.readCached(responseKey, fingerprint);
    if (cached) return of(cached.response);
    if (!(await this.redis.acquire(lockKey, lockToken, 300)))
      throw new ConflictException(
        'A request with this idempotency key is already in progress',
      );
    const cachedAfterLock = await this.readCached(responseKey, fingerprint);
    if (cachedAfterLock) {
      await this.redis.release(lockKey, lockToken);
      return of(cachedAfterLock.response);
    }
    return next.handle().pipe(
      mergeMap((response: unknown) =>
        from(
          this.cacheAndUnlock(
            responseKey,
            lockKey,
            lockToken,
            fingerprint,
            response,
          ),
        ).pipe(
          map(() => response),
          catchError((error: Error) => {
            this.logger.error(
              `Unable to cache idempotent response: ${error.message}`,
            );
            return of(response);
          }),
        ),
      ),
      catchError((error: unknown) =>
        from(
          this.redis.release(lockKey, lockToken).catch(() => undefined),
        ).pipe(mergeMap(() => throwError(() => error))),
      ),
    );
  }
  private async cacheAndUnlock(
    responseKey: string,
    lockKey: string,
    lockToken: string,
    fingerprint: string,
    response: unknown,
  ): Promise<void> {
    await this.redis.set(
      responseKey,
      JSON.stringify({ fingerprint, response: response ?? null }),
      86_400,
    );
    await this.redis.release(lockKey, lockToken);
  }
  private async readCached(
    responseKey: string,
    fingerprint: string,
  ): Promise<CachedEnvelope | null> {
    const cached = await this.redis.get(responseKey);
    if (!cached) return null;
    try {
      const envelope = JSON.parse(cached) as Partial<CachedEnvelope>;
      if (
        !envelope ||
        typeof envelope !== 'object' ||
        typeof envelope.fingerprint !== 'string' ||
        !Object.prototype.hasOwnProperty.call(envelope, 'response')
      )
        throw new Error('Invalid cache');
      if (envelope.fingerprint !== fingerprint)
        throw new ConflictException(
          'This idempotency key was already used with another request body',
        );
      return envelope as CachedEnvelope;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.warn(
        `Discarding corrupt idempotency response ${responseKey}`,
      );
      await this.redis.delete(responseKey);
      return null;
    }
  }
}
