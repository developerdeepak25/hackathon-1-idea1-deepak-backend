import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth() {
    return {
      status: 'ok' as const,
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }
}
