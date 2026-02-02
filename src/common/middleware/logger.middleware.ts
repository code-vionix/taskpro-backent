import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');
      const color = statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';

      console.log(
        `${color}[HTTP] ${method} ${originalUrl} ${statusCode}\x1b[0m ${contentLength || 0} - ${userAgent} ${ip}`,
      );
    });


    next();
  }
}
