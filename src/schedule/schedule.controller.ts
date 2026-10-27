import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OwnerGuard } from '../auth/owner.guard.js';
import { UpdateScheduleDto } from './schedule.dto.js';
import { ScheduleService } from './schedule.service.js';

// Public schedule read on the left, owner edit on the right.
@ApiTags('schedule')
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  // No token needed: the booking page and the calendar read this.
  @Get()
  @ApiOperation({ summary: 'Lunch schedule: open days, slots, prices, shut dates' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        openDays: { type: 'array', items: { type: 'string' } },
        closedDates: { type: 'array', items: { type: 'string' } },
        lunchStart: { type: 'string' },
        lunchEnd: { type: 'string' },
        lastArrival: { type: 'string' },
        slots: { type: 'array', items: { type: 'string' } },
        maxParty: { type: 'number' },
        adultPrice: { type: 'number' },
        childPrice: { type: 'number' },
      },
    },
  })
  get() {
    return this.schedule.get();
  }

  // Owner only. The body carries only the Lunch fields that changed.
  @Patch()
  @UseGuards(OwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change lunch rules (owner)' })
  @ApiOkResponse({ summary: 'Same shape as the GET response' })
  update(@Body() body: UpdateScheduleDto) {
    return this.schedule.update(body);
  }
}
