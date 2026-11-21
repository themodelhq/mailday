import { applySecurityHeaders } from '../src/common/security-headers';

describe('security response headers', () => {
  const response = () => ({ setHeader: jest.fn() } as any);

  it('sets baseline headers for all environments', () => {
    const res = response();
    applySecurityHeaders(res, false);
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(res.setHeader).toHaveBeenCalledWith('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    expect(res.setHeader).toHaveBeenCalledWith('Cross-Origin-Resource-Policy', 'same-site');
    expect(res.setHeader).not.toHaveBeenCalledWith('Strict-Transport-Security', expect.anything());
  });

  it('enables HSTS in production', () => {
    const res = response();
    applySecurityHeaders(res, true);
    expect(res.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  });
});
