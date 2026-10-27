import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { buildSlots } from './lunch-time.js';
import { Schedule, ScheduleDoc } from './schedule.schema.js';
import type { UpdateScheduleDto } from './schedule.dto.js';

@Injectable()
export class ScheduleService implements OnModuleInit {
  constructor(
    @InjectModel(Schedule.name) private readonly model: Model<ScheduleDoc>,
  ) {}

  // On boot, make sure the one schedule row exists. A seed failure is logged
  // and does not take the API down, so the health endpoint keeps working.
  async onModuleInit() {
    try {
      await this.ensure();
    } catch (error) {
      console.info('[iturrieta] schedule seed failed', (error as Error).message);
    }
  }

  // The schedule the public site and the admin both read.
  async get() {
    return this.view(await this.ensure());
  }

  // Owner edit. Only the fields the DTO carried are touched; the doc keeps
  // everything else exactly as it was.
  async update(patch: UpdateScheduleDto) {
    const doc = await this.ensure();
    if (patch.openDays) doc.openDays = [...patch.openDays];
    if (patch.lastArrival) doc.lastArrival = patch.lastArrival;
    if (patch.closedDates) doc.closedDates = uniqueSorted(patch.closedDates);
    if (patch.maxParty !== undefined) doc.maxParty = patch.maxParty;
    await doc.save();
    console.info('[iturrieta] schedule updated', doc.id);
    return this.view(doc);
  }

  // Find the single schedule row, or seed it exactly once when missing. Every
  // read and write goes through here, so a wiped collection heals by itself.
  private async ensure(): Promise<ScheduleDoc> {
    const existing = await this.model.findOne().exec();
    if (existing) return existing;
    const created = await this.model.create({});
    console.info('[iturrieta] schedule seeded', created.id);
    return created;
  }

  // The clean shape the API answers with. The slot list is derived from the
  // lunch window, so moving the last arrival moves the chips too.
  private view(doc: ScheduleDoc) {
    return {
      openDays: [...doc.openDays],
      closedDates: [...doc.closedDates].sort(),
      lunchStart: doc.lunchStart,
      lunchEnd: doc.lunchEnd,
      lastArrival: doc.lastArrival,
      slots: buildSlots(doc.lunchStart, doc.lastArrival, doc.slotMinutes),
      slotMinutes: doc.slotMinutes,
      maxParty: doc.maxParty,
      adultPrice: doc.adultPrice,
      childPrice: doc.childPrice,
    };
  }
}

// Deduplicate shut dates and keep them in date order, so the list cannot
// drift no matter how the admin page orders them.
function uniqueSorted(dates: string[]) {
  return [...new Set(dates)].sort();
}
