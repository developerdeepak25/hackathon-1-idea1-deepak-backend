import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './login.dto.js';
import { OwnerGuard } from './owner.guard.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Owner login' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        token: { type: 'string' },
      },
    },
  })
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(OwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in owner' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { email: { type: 'string' } },
    },
  })
  me(@Req() request: { owner: { email: string } }) {
    return request.owner;
  }
}
