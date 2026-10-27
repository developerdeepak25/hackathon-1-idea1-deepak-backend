import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OwnerGuard } from '../auth/owner.guard.js';
import { GuestGuard } from '../auth/guest.guard.js';
import { BookingService } from './booking.service.js';
import { CreateBookingDto, QueryDayDto, QueryRangeDto } from './booking.dto.js';

// Availability is public; guest confirmation and the owner list are protected.
@ApiTags('bookings')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  // The Continue step on the party screen asks this, and the confirm POST
  // asks the same service the same question again.
  @Get('availability')
  @ApiOperation({ summary: 'Which table a party gets, or why none' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        table: {
          type: 'object',
          nullable: true,
          properties: { name: { type: 'string' }, seats: { type: 'number' } },
        },
        reason: { type: 'string', nullable: true },
        maxParty: { type: 'number', nullable: true },
      },
    },
  })
  availability(
    @Query('date') date: string,
    @Query('time') time: string,
    @Query('adults') adults: number,
    @Query('children') children: number,
  ) {
    return this.verdict(date, time, adults, children);
  }

  // Confirm. On a race the answer is 409 with the reason, so the page can
  // say full in words instead of a crash.
  @Post()
  @UseGuards(GuestGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a booking, no payment' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        date: { type: 'string' },
        time: { type: 'string' },
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        adults: { type: 'number' },
        children: { type: 'number' },
        seats: { type: 'number' },
        table: { type: 'string' },
        status: { type: 'string' },
      },
    },
  })
  @ApiConflictResponse({
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: ['past', 'window', 'shut', 'closed', 'late', 'need-adult', 'above-max', 'no-table', 'full', 'request-conflict'],
        },
        maxParty: { type: 'number', description: 'Configured online party-size limit, included for above-max.' },
      },
    },
  })
  create(
    @Body() body: CreateBookingDto,
    @Req() request: { guest: { id: string; email: string } },
  ) {
    return this.bookings.create({
      date: body.date,
      time: body.time,
      name: body.name,
      phone: body.phone,
      adults: body.adults,
      children: body.children,
      requestId: body.requestId,
      email: request.guest.email,
      guestId: request.guest.id,
    });
  }

  @Post(':id/cancel')
  @UseGuards(GuestGuard)
  @ApiBearerAuth()
  @ApiConflictResponse({ description: 'The arrival has already started' })
  @ApiOperation({ summary: 'Cancel one of the guest’s future bookings' })
  cancel(
    @Param('id') id: string,
    @Req() request: { guest: { id: string } },
  ) {
    return this.bookings.cancelForGuest(id, request.guest.id);
  }

  // Owner only, one day at a time.
  @Get()
  @UseGuards(OwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'One day’s bookings, with arrival slots (owner)' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          date: { type: 'string' },
          time: { type: 'string' },
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          adults: { type: 'number' },
          children: { type: 'number' },
          seats: { type: 'number' },
          table: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  })
  listForDay(@Query() query: QueryDayDto) {
    return this.bookings.listForDay(query.date);
  }

  @Get('range')
  @UseGuards(OwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bookings across a date range (owner)' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          date: { type: 'string' },
          time: { type: 'string' },
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          adults: { type: 'number' },
          children: { type: 'number' },
          seats: { type: 'number' },
          table: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  })
  listForRange(@Query() query: QueryRangeDto) {
    return this.bookings.listForRange(query.from, query.to);
  }

  // Shared shape for the availability answer: table when there is one, else
  // the reason in words.
  private async verdict(date: string, time: string, adults: number, children: number) {
    const result = await this.bookings.evaluate({ date, time, adults, children });
    return result.table
      ? {
          table: { name: result.table.name, seats: result.table.seats },
          reason: null,
        }
      : {
          table: null,
          reason: result.reason,
          ...('maxParty' in result ? { maxParty: result.maxParty } : {}),
        };
  }
}

@ApiTags('guests')
@Controller('guests')
export class GuestBookingsController {
  constructor(private readonly bookings: BookingService) {}

  @Get('bookings')
  @UseGuards(GuestGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in guest’s bookings' })
  list(@Req() request: { guest: { id: string } }) {
    return this.bookings.listForGuest(request.guest.id);
  }
}
