import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GuestGuard } from './guest.guard.js';
import { OwnerGuard } from './owner.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, OwnerGuard, GuestGuard],
  exports: [AuthService, OwnerGuard, GuestGuard],
})
export class AuthModule {}
