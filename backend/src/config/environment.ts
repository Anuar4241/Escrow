type Environment = Record<string, string | undefined>;
function integer(
  environment: Environment,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(environment[key] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(
      `${key} must be an integer between ${minimum} and ${maximum}`,
    );
  return value;
}
function secret(
  environment: Environment,
  key: string,
  production: boolean,
  fallback: string,
): string {
  const value = environment[key] ?? (production ? undefined : fallback);
  if (!value || value.length < 32)
    throw new Error(`${key} must contain at least 32 characters`);
  return value;
}
function boolean(
  environment: Environment,
  key: string,
  fallback: boolean,
): boolean {
  const value = (environment[key] ?? String(fallback)).toLowerCase();
  if (value !== 'true' && value !== 'false')
    throw new Error(`${key} must be either true or false`);
  return value === 'true';
}
export function validateEnvironment(environment: Environment) {
  const nodeEnv = environment.NODE_ENV ?? 'development';
  const production = nodeEnv === 'production';
  const databaseUrl =
    environment.DATABASE_URL ??
    (production
      ? undefined
      : 'postgresql://revorus:revorus_dev@localhost:5432/revorus_escrow?schema=public');
  if (!databaseUrl) throw new Error('DATABASE_URL is required in production');
  const outboxPublisherEnabled = boolean(
    environment,
    'OUTBOX_PUBLISHER_ENABLED',
    false,
  );
  if (
    production &&
    (!environment.REDIS_PASSWORD || environment.REDIS_PASSWORD.length < 16)
  )
    throw new Error(
      'REDIS_PASSWORD must contain at least 16 characters in production',
    );
  if (outboxPublisherEnabled && !environment.RABBITMQ_URL)
    throw new Error(
      'RABBITMQ_URL is required when OUTBOX_PUBLISHER_ENABLED is true',
    );
  return {
    ...environment,
    NODE_ENV: nodeEnv,
    PORT: integer(environment, 'PORT', 3000, 1, 65535),
    DATABASE_URL: databaseUrl,
    JWT_SECRET: secret(
      environment,
      'JWT_SECRET',
      production,
      'development-jwt-secret-change-before-production',
    ),
    JWT_ISSUER: environment.JWT_ISSUER ?? 'revorus-identity',
    JWT_AUDIENCE: environment.JWT_AUDIENCE ?? 'revorus-escrow',
    BANK_WEBHOOK_SECRET: secret(
      environment,
      'BANK_WEBHOOK_SECRET',
      production,
      'development-bank-secret-change-before-production',
    ),
    BANK_WEBHOOK_TOLERANCE_SECONDS: integer(
      environment,
      'BANK_WEBHOOK_TOLERANCE_SECONDS',
      300,
      30,
      3600,
    ),
    ESCROW_FEE_BPS: integer(environment, 'ESCROW_FEE_BPS', 150, 0, 2000),
    REDIS_HOST: environment.REDIS_HOST ?? 'localhost',
    REDIS_PORT: integer(environment, 'REDIS_PORT', 6379, 1, 65535),
    REDIS_PASSWORD: environment.REDIS_PASSWORD,
    RABBITMQ_URL: environment.RABBITMQ_URL,
    RABBITMQ_PUBLISH_TIMEOUT_MS: integer(
      environment,
      'RABBITMQ_PUBLISH_TIMEOUT_MS',
      5000,
      1000,
      60000,
    ),
    FRONTEND_URLS: environment.FRONTEND_URLS ?? 'http://localhost:3000',
    OUTBOX_PUBLISHER_ENABLED: outboxPublisherEnabled,
    OUTBOX_POLL_INTERVAL_MS: integer(
      environment,
      'OUTBOX_POLL_INTERVAL_MS',
      1000,
      250,
      60000,
    ),
  };
}
