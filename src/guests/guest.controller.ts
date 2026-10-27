import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuestGuard } from '../auth/guest.guard.js';
import { LoginGuestDto, RegisterGuestDto } from './guest.dto.js';
import { GuestService } from './guest.service.js';

@ApiTags('guests')
@Controller('guests')
export class GuestController {
  constructor(
    private readonly guests: GuestService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a guest account' })
  @ApiConflictResponse({ description: 'Email is already registered' })
  register(@Body() body: RegisterGuestDto) {
    return this.guests.register(body);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Guest sign in' })
  login(@Body() body: LoginGuestDto) {
    return this.guests.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(GuestGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in guest' })
  me(@Req() request: { guest: { id: string; email: string } }) {
    return this.guests.me(request.guest);
  }
}
