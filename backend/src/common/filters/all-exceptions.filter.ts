import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status >= 500) {
      // Never log query strings, raw exception messages, or stack traces here:
      // they can contain credentials, email content, provider payloads, or tokens.
      const requestId = request.get('X-Request-ID') || 'unknown';
      const exceptionType =
        exception instanceof Error ? exception.name : 'UnknownException';
      this.logger.error(JSON.stringify({
        type: 'http_exception',
        requestId,
        method: request.method,
        path: request.path,
        statusCode: status,
        exceptionType,
      }));
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      message:
        typeof message === 'string'
          ? message
          : (message as Record<string, unknown>)?.['message'] ?? message,
    });
  }
}
