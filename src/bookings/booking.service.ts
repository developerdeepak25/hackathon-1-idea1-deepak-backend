import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { TableDoc } from '../schedule/table.schema.js';
import { ScheduleService } from '../schedule/schedule.service.js';
import { TablesService } from '../schedule/tables.service.js';
import { Booking, BookingDoc } from './booking.schema.js';
import { bookingWindow, madridToday, shiftDays, weekdayOf } from './madrid-day.js';

// Why the party cannot be seated, in the order the checks run.
export type BookingReason =
  | 'past' // a date before today in Europe/Madrid
  | 'window' // a date beyond the 28-day window (kept out of the plan list on purpose)
  | 'shut' // Monday to Wednesday
  | 'closed' // a day the owner shut
  | 'late' // not a real chip: 15:00, 16:00, 12:30, 13:15, or past the last arrival
  | 'need-adult' // a party of children only
  | 'above-max' // bigger than the online maximum, even if a table could fit
  | 'no-table' // 11 or 12 guests: no table holds them and tables are never joined
  | 'full'; // every table that fits is already held that day

// What a party check answers: either a free table, or no table and why.
export type Verdict =
  | { table: TableDoc; fitting: TableDoc[] }
  | { table: null; reason: BookingReason; maxParty?: number };

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name) private readonly model: Model<BookingDoc>,
    private readonly schedule: ScheduleService,
    private readonly tables: TablesService,
  ) {}

  // One check function for both the page's Continue step and the confirm
  // POST. The POST one is the one that counts, because another guest may have
  // taken the table in between.
  async evaluate(party: {
    date: string;
    time: string;
    adults: number;
    children: number;
    email?: string;
    phone?: string;
  }): Promise<Verdict> {
    const schedule = await this.schedule.get();
    const today = madridToday();

    // The day must be inside the calendar window, an open weekday, and not a
    // day the owner shut.
    if (party.date < today) return { table: null, reason: 'past' };
    if (party.date > shiftDays(today, bookingWindow - 1)) {
      return { table: null, reason: 'window' };
    }
    if (!schedule.openDays.includes(weekdayOf(party.date))) {
      return { table: null, reason: 'shut' };
    }
    if (schedule.closedDates.includes(party.date)) {
      return { table: null, reason: 'closed' };
    }

    // The arrival must be a real chip: on the 30-minute grid, not after the
    // last arrival. Moved-away chips simply stop being on the grid.
    if (!schedule.slots.includes(party.time)) {
      return { table: null, reason: 'late' };
    }

    // The party: an adult must be there, and the size must fit the rules
    // before any table is touched.
    if (party.adults < 1) return { table: null, reason: 'need-adult' };
    const seats = party.adults + party.children;
    if (seats > schedule.maxParty) {
      return { table: null, reason: 'above-max', maxParty: schedule.maxParty };
    }

    // The table: smallest seat count that fits, among active tables with no
    // confirmed booking this day. Tables are never joined, so a party of 10
    // needs table 8 even when smaller tables are empty.
    const active = await this.tables.allActive(); // ordered by seats, then name
    const fitting = active.filter((table) => table.seats >= seats);
    if (fitting.length === 0) return { table: null, reason: 'no-table' };

    const busy = await this.model.distinct('tableId', {
      date: party.date,
      status: 'confirmed',
    });
    const busyIds = new Set(busy.map((id) => String(id)));
    const table = fitting.find((candidate) => !busyIds.has(String(candidate._id)));
    return table ? { table, fitting } : { table: null, reason: 'full' };
  }

  // Confirm a party. Re-runs the same check and inserts; a duplicate-key hit
  // on the unique index means the table was taken mid-flight, so it falls
  // through to the next fitting table and only answers full when none remain.
  async create(party: {
    date: string;
    time: string;
    adults: number;
    children: number;
    name: string;
    phone: string;
    email: string;
    requestId: string;
  }) {
    const existing = await this.model.findOne({ requestId: party.requestId }).exec();
    if (existing) {
      console.info('[iturrieta] booking request replayed', existing.id);
      return this.returnIdempotent(existing, party);
    }

    const verdict = await this.evaluate(party);
    if (!verdict.table) {
      console.info('[iturrieta] booking refused', verdict.reason, party.date);
      throw new ConflictException({
        reason: verdict.reason,
        ...('maxParty' in verdict ? { maxParty: verdict.maxParty } : {}),
      });
    }
    const candidates = [verdict.table, ...verdict.fitting.filter((t) => t !== verdict.table)];
    const seats = party.adults + party.children;

    for (const table of candidates) {
      try {
        const created = await this.model.create({
          ...party,
          // Store normalized contact fields for consistent owner records.
          email: party.email.trim().toLowerCase(),
          phone: party.phone.trim(),
          seats,
          tableId: table._id,
          status: 'confirmed',
        });
        console.info('[iturrieta] booking confirmed', created.id, 'table', table.name);
        return await this.view(created);
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        const replay = await this.model.findOne({ requestId: party.requestId }).exec();
        if (replay) {
          console.info('[iturrieta] booking request replayed', replay.id);
          return this.returnIdempotent(replay, party);
        }
        if (!(await this.model.exists({ date: party.date, tableId: table._id, status: 'confirmed' }))) {
          throw error;
        }
        console.info('[iturrieta] table', table.name, 'taken mid-flight, trying next');
      }
    }
    console.info('[iturrieta] booking refused', 'full', party.date);
    throw new ConflictException({ reason: 'full' });
  }

  // One open day's rows for the owner, guests sorted by arrival and table.
  async listForDay(date: string) {
    const rows = await this.model
      .find({ date, status: 'confirmed' })
      .sort({ time: 1 })
      .exec();
    const views = await Promise.all(rows.map((row) => this.view(row)));
    return views.sort((a, b) => a.time.localeCompare(b.time) || a.table.localeCompare(b.table));
  }

  // A range of open days for the owner, sorted by date then arrival to keep the
  // admin list readable across a full week or month view.
  async listForRange(from: string, to: string) {
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    const rows = await this.model
      .find({
        date: { $gte: start, $lte: end },
        status: 'confirmed',
      })
      .sort({ date: 1, time: 1 })
      .exec();
    const views = await Promise.all(rows.map((row) => this.view(row)));
    return views.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.table.localeCompare(b.table));
  }

  // The clean row shape both the confirmation screen and the owner list use.
  // The table name comes from the referenced table document, never copied.
  private async view(row: BookingDoc) {
    await row.populate('tableId', 'name');
    return {
      id: row.id,
      date: row.date,
      time: row.time,
      name: row.name,
      phone: row.phone,
      email: row.email,
      adults: row.adults,
      children: row.children,
      seats: row.seats,
      table: (row.tableId as unknown as { name: string }).name,
      status: row.status,
    };
  }

  private async returnIdempotent(
    existing: BookingDoc,
    party: {
      date: string;
      time: string;
      name: string;
      phone: string;
      email: string;
      adults: number;
      children: number;
    },
  ) {
    const sameRequest =
      existing.date === party.date &&
      existing.time === party.time &&
      existing.name === party.name &&
      existing.phone === party.phone.trim() &&
      existing.email === party.email.trim().toLowerCase() &&
      existing.adults === party.adults &&
      existing.children === party.children;
    if (!sameRequest) {
      throw new ConflictException({ reason: 'request-conflict' });
    }
    return this.view(existing);
  }
}

// Mongoose answers a duplicate key with code 11000; anything else is a real
// failure and must surface.
function isDuplicateKey(error: unknown) {
  return (error as { code?: number }).code === 11000;
}
