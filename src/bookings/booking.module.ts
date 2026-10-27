import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { ScheduleModule } from '../schedule/schedule.module.js';
import { Booking, BookingSchema } from './booking.schema.js';
import {
  BookingController,
  GuestBookingsController,
} from './booking.controller.js';
import { BookingService } from './booking.service.js';

// Bookings read the schedule and the tables through the services the
// schedule module exports, and keep their own collection.
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Booking.name, schema: BookingSchema }]),
    ScheduleModule,
    AuthModule,
  ],
  controllers: [BookingController, GuestBookingsController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
