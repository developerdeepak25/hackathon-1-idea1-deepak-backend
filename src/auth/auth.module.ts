import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OwnerGuard } from './owner.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, OwnerGuard],
  exports: [AuthService],
})
export class AuthModule {}
