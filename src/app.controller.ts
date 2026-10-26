import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Hello check' })
  @ApiOkResponse({
    description: 'Greeting',
    schema: { type: 'string', example: 'Hello World!' },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Service and database health' })
  @ApiOkResponse({
    description: 'Health payload',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'api' },
        database: { type: 'string', example: 'connected' },
        timestamp: { type: 'string', example: '2026-10-26T00:00:00.000Z' },
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
