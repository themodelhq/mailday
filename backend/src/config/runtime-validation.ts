export function validateRuntimeConfiguration(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'production') return;

  const requiredSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;
  for (const key of requiredSecrets) {
    const value = env[key];
    if (!value || value.trim().length < 32) {
      throw new Error(`${key} must be set to a secret of at least 32 characters in production`);
    }
  }

  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different in production');
  }

  const frontendOrigins = (env.FRONTEND_URL ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (frontendOrigins.length === 0) {
    throw new Error('FRONTEND_URL must contain at least one frontend origin in production');
  }

  for (const origin of frontendOrigins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`FRONTEND_URL contains an invalid origin: ${origin}`);
    }
    if (parsed.origin !== origin.replace(/\/+$/, '') || (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost')) {
      throw new Error(`FRONTEND_URL must contain HTTPS origins (localhost is allowed for testing): ${origin}`);
    }
  }

  if (env.SMTP_USER && !env.SMTP_PASS) {
    throw new Error('SMTP_PASS is required when SMTP_USER is configured');
  }
  if (env.SMTP_PASS && !env.SMTP_USER) {
    throw new Error('SMTP_USER is required when SMTP_PASS is configured');
  }
}
