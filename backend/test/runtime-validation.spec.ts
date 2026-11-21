import { validateRuntimeConfiguration } from '../src/config/runtime-validation';

describe('production runtime configuration validation', () => {
  const valid: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    FRONTEND_URL: 'https://mailday.example.com',
  };

  it('accepts valid production configuration', () => {
    expect(() => validateRuntimeConfiguration(valid)).not.toThrow();
  });

  it('does not enforce production-only settings outside production', () => {
    expect(() => validateRuntimeConfiguration({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('requires sufficiently long JWT secrets', () => {
    expect(() => validateRuntimeConfiguration({ ...valid, JWT_SECRET: 'short' })).toThrow('JWT_SECRET must be set');
  });

  it('requires distinct JWT secrets', () => {
    expect(() => validateRuntimeConfiguration({ ...valid, JWT_REFRESH_SECRET: valid.JWT_SECRET })).toThrow('must be different');
  });

  it('requires a frontend origin', () => {
    expect(() => validateRuntimeConfiguration({ ...valid, FRONTEND_URL: '' })).toThrow('FRONTEND_URL must contain');
  });

  it('rejects non-HTTPS frontend origins in production', () => {
    expect(() => validateRuntimeConfiguration({ ...valid, FRONTEND_URL: 'http://mailday.example.com' })).toThrow('must contain HTTPS');
  });

  it('requires paired SMTP credentials', () => {
    expect(() => validateRuntimeConfiguration({ ...valid, SMTP_USER: 'mailer' })).toThrow('SMTP_PASS is required');
    expect(() => validateRuntimeConfiguration({ ...valid, SMTP_PASS: 'secret' })).toThrow('SMTP_USER is required');
  });
});
