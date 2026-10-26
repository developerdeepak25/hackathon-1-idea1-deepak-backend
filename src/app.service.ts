import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

@Injectable()
export class AppService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  getHello(): string {
    return 'Hello World!';
  }

  getHealth() {
    return {
      status: 'ok' as const,
      service: 'api',
      database: this.connection.readyState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
