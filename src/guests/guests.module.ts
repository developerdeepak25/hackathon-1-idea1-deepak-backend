import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { GuestController } from './guest.controller.js';
import { Guest, GuestSchema } from './guest.schema.js';
import { GuestService } from './guest.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Guest.name, schema: GuestSchema }]),
    AuthModule,
  ],
  controllers: [GuestController],
  providers: [GuestService],
  exports: [MongooseModule],
})
export class GuestsModule {}
