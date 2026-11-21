import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { Logger, InternalServerErrorException } from '@nestjs/common';

describe('AllExceptionsFilter operational logging safety', () => {
  let filter: AllExceptionsFilter;
  const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    loggerSpy.mockClear();
  });

  afterAll(() => loggerSpy.mockRestore());

  function makeContext(url: string, path: string, requestId = 'req-test-123') {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      method: 'POST',
      url,
      path,
      get: jest.fn((header: string) => header === 'X-Request-ID' ? requestId : undefined),
    };
    const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) } as any;
    return { host, response, request };
  }

  it('logs structured metadata without query strings or exception messages/stacks', () => {
    const secret = 'secret-token-in-query';
    const { host, response } = makeContext('/api/send?token=' + secret, '/api/send');
    const error = new Error('provider leaked ' + secret);
    error.stack = 'stack contains ' + secret;

    filter.catch(error, host);

    expect(loggerSpy).toHaveBeenCalledTimes(1);
    const log = loggerSpy.mock.calls[0][0] as string;
    expect(log).toContain('req-test-123');
    expect(log).toContain('/api/send');
    expect(log).not.toContain(secret);
    expect(log).not.toContain('provider leaked');
    expect(log).not.toContain('stack contains');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ path: '/api/send' }));
  });

  it('does not log client errors', () => {
    const { host } = makeContext('/api/login?email=user@example.com', '/api/login');
    filter.catch(new InternalServerErrorException('test'), host);
    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it('uses a stable generic message for unknown server exceptions', () => {
    const { host, response } = makeContext('/api/unknown?secret=x', '/api/unknown');
    filter.catch({ secret: 'x' }, host);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 500,
      path: '/api/unknown',
      message: 'Internal server error',
    }));
  });
});
