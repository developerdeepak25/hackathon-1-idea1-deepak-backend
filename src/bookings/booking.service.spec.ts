// Booking service tests against a dedicated Mongo database
// ("hackathon-test"), so the hackathon data stays untouched. The checks in
// here follow PLAN.md edge cases one by one.

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import mongo, { Model, Types } from 'mongoose';
import { Booking, BookingSchema, BookingDoc } from './booking.schema.js';
import { BookingService } from './booking.service.js';
import { CreateBookingDto } from './booking.dto.js';
import { ScheduleService } from '../schedule/schedule.service.js';
import { Schedule, ScheduleDoc, ScheduleSchema } from '../schedule/schedule.schema.js';
import { TablesService } from '../schedule/tables.service.js';
import { Table, TableDoc, TableSchema } from '../schedule/table.schema.js';
import { madridToday, shiftDays, weekdayOf } from './madrid-day.js';

// A confirmed row, or the refusal reason in words, so the tests read like the
// plan: table "8", reason "full".
type Seat = { id: string; table: string };
type Refusal = { reason: string; maxParty?: number };
type PartyInput = Parameters<BookingService['create']>[0];

// The nearest date named `day` that is at least one day out, so tests never
// depend on what weekday today happens to be.
function nextWeekday(day: string, from = madridToday()) {
  for (let i = 1; i <= 7; i++) {
    const at = shiftDays(from, i);
    if (weekdayOf(at) === day) return at;
  }
  throw new Error(`no ${day} ahead of ${from}`);
}

// A valid guest line the party tests start from.
function party(over: Partial<PartyInput>): PartyInput {
  return {
    date: thursday1,
    time: '13:00',
    name: 'Itxaso Urigoitia',
    phone: '600 111 222',
    email: 'itxaso@example.com',
    adults: 1,
    children: 0,
    requestId: randomUUID(),
    ...over,
  };
}

// Book, or answer with the reason. Success asserts use `seat(x).table`,
// refusal asserts `refusal(x).reason`.
async function tryBook(input: PartyInput): Promise<Seat | Refusal> {
  try {
    return await service.create(input);
  } catch (error) {
    if (error instanceof ConflictException) return error.getResponse() as Refusal;
    throw error;
  }
}

function seat(result: Awaited<ReturnType<typeof tryBook>>) {
  return result as Seat;
}

function refusal(result: Awaited<ReturnType<typeof tryBook>>) {
  return result as Refusal;
}

// Rewrite the seed schedule for the next test, then the caller resets.
async function patchSchedule(patch: Partial<Schedule>) {
  await scheduleModel.updateOne({}, { $set: patch }).exec();
}

// A confirmed row written straight to Mongo, for testing bookings that
// already exist when the rules change around them.
async function oldRow(date: string, time: string, tableId: string) {
  return bookingModel.create({
    date,
    time,
    name: 'Old Arrival',
    phone: '600 000 111',
    email: 'old@example.com',
    adults: 2,
    children: 0,
    seats: 2,
    tableId,
    status: 'confirmed',
  });
}

let scheduleModel: Model<ScheduleDoc>;
let tableModel: Model<TableDoc>;
let bookingModel: Model<BookingDoc>;
let service: BookingService;
let table1: TableDoc;
let thursday1: string;
let friday1: string;
let saturday1: string;
let sunday1: string;

beforeAll(async () => {
  // The live URI from api/.env, never committed.
  const env = readFileSync('.env', 'utf8');
  const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
  if (!uri) throw new Error('MONGODB_URI missing in api/.env');
  await mongo.connect(uri, {
    dbName: 'hackathon-test',
    serverSelectionTimeoutMS: 10000,
  });

  // mongoose throws if the models are registered again, so cast to unwind the
  // generic plumbing between the mongoose and @nestjs/mongoose typings.
  scheduleModel = mongo.model(Schedule.name, ScheduleSchema) as unknown as Model<ScheduleDoc>;
  tableModel = mongo.model(Table.name, TableSchema) as unknown as Model<TableDoc>;
  bookingModel = mongo.model(Booking.name, BookingSchema) as unknown as Model<BookingDoc>;

  await bookingModel.syncIndexes();

  // Start each run from a clean slate. dropDatabase is not allowed on the
  // Atlas user, so the collections are emptied one by one instead.
  await Promise.all([
    scheduleModel.deleteMany({}).exec(),
    tableModel.deleteMany({}).exec(),
    bookingModel.deleteMany({}).exec(),
  ]);

  const tables = new TablesService(tableModel);
  const schedule = new ScheduleService(scheduleModel);
  await tables.onModuleInit();
  await schedule.onModuleInit();
  service = new BookingService(bookingModel, schedule, tables);

  const seeded = await tableModel.findOne().sort({ seats: 1 }).exec();
  table1 = seeded!;
  const today = madridToday();
  thursday1 = nextWeekday('thursday', today);
  friday1 = nextWeekday('friday', thursday1);
  saturday1 = nextWeekday('saturday', friday1);
  sunday1 = nextWeekday('sunday', saturday1);
});

afterAll(async () => {
  await mongo.disconnect();
});

describe('BookingService', () => {
  it('holds table 1 all day: the second party the same day takes table 2', async () => {
    const first = await tryBook(party({ time: '13:00' }));
    expect(seat(first).table).toBe('1');
    const second = await tryBook(party({ time: '13:30', name: 'Aitor Eguren' }));
    expect(seat(second).table).toBe('2');
  });

  it('a second click by the same guest can still take another table', async () => {
    const another = await tryBook(party({ time: '14:00', adults: 2, children: 0 }));
    expect(seat(another).table).toBe('3');
  });

  it('table 1 is free again on the next open day', async () => {
    const next = await tryBook(party({ date: friday1, time: '13:00' }));
    expect(seat(next).table).toBe('1');
  });

  it('a party of 10 gets table 8, and no smaller table is joined', async () => {
    const big = await tryBook(party({ time: '14:30', adults: 10, children: 0 }));
    expect(seat(big).table).toBe('8');
    const again = await tryBook(
      party({
        time: '13:00',
        adults: 10,
        children: 0,
        name: 'Ten Again',
        email: 'tenagain@example.com',
        phone: '600 141 141',
      }),
    );
    expect(refusal(again).reason).toBe('full');
  });

  it('two parallel requests by two guests for the same slot take different tables', async () => {
    const [left, right] = (await Promise.all([
      tryBook(party({
        date: saturday1,
        name: 'Parallel left',
        email: 'left@example.com',
        phone: '600 121 121',
      })),
      tryBook(party({
        date: saturday1,
        name: 'Parallel right',
        email: 'right@example.com',
        phone: '600 131 131',
      })),
    ])) as Array<Awaited<ReturnType<typeof tryBook>>>;
    expect(seat(left).table).not.toBe(seat(right).table);
    expect(seat(left).id).not.toBe(seat(right).id);
  });

  it('replays a request with the same idempotency key instead of booking a second table', async () => {
    const request = party({
      date: sunday1,
      name: 'Replay Guest',
      email: 'replay@example.com',
      phone: '600 141 414',
      requestId: randomUUID(),
    });
    const [first, replay] = await Promise.all([tryBook(request), tryBook(request)]);
    expect(seat(first).id).toBe(seat(replay).id);
    expect(seat(first).table).toBe(seat(replay).table);
  });

  it('allows a separate booking by the same guest with a new request key', async () => {
    const first = await tryBook(party({ date: sunday1, name: 'Repeat Guest' }));
    const second = await tryBook(party({ date: sunday1, name: 'Repeat Guest' }));
    expect(seat(second).table).not.toBe(seat(first).table);
  });

  it('rejects reusing a request key for different booking details', async () => {
    const request = party({ date: sunday1, name: 'Key Owner' });
    const first = await tryBook(request);
    const changed = await tryBook({ ...request, name: 'Different Party' });
    expect(seat(first).id).toBeTruthy();
    expect(refusal(changed).reason).toBe('request-conflict');
  });

  it('lists only a guest’s bookings and cancellation frees the held table', async () => {
    const guestId = new Types.ObjectId().toString();
    const otherGuestId = new Types.ObjectId().toString();
    const date = shiftDays(sunday1, 14);
    const original = await service.create(
      party({
        date,
        guestId,
        name: 'Account Guest',
        email: 'account@example.com',
        phone: '600 330 111',
      }),
    );
    expect((await service.listForGuest(guestId)).map((row) => row.id)).toEqual([
      original.id,
    ]);
    expect(await service.listForGuest(otherGuestId)).toEqual([]);

    const cancelled = await service.cancelForGuest(original.id, guestId);
    expect(cancelled.status).toBe('cancelled');
    expect((await service.cancelForGuest(original.id, guestId)).status).toBe('cancelled');
    await expect(service.cancelForGuest(original.id, otherGuestId)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const replacement = await service.create(
      party({
        date,
        guestId: otherGuestId,
        name: 'Replacement Guest',
        email: 'replacement@example.com',
        phone: '600 330 222',
      }),
    );
    expect(replacement.table).toBe(original.table);
  });

  it('does not exceed eight tables when ten different guests race for the same slot', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        tryBook(party({
          date: shiftDays(sunday1, 7),
          time: '13:00',
          name: `Concurrent guest ${index}`,
          email: `concurrent${index}@example.com`,
          phone: `600 220 ${String(index).padStart(3, '0')}`,
        })),
      ),
    );
    const successes = results.filter((result) => 'table' in result);
    const refusals = results.filter((result) => 'reason' in result);
    expect(successes).toHaveLength(8);
    expect(new Set(successes.map((result) => seat(result).table)).size).toBe(8);
    expect(refusals).toHaveLength(2);
    expect(refusals.every((result) => refusal(result).reason === 'full')).toBe(true);
  });

  it('refuses a shut weekday with shut', async () => {
    const monday = nextWeekday('monday');
    const refused = await tryBook(party({ date: monday }));
    expect(refusal(refused).reason).toBe('shut');
  });

  it('refuses a date the owner closed with closed', async () => {
    await patchSchedule({ closedDates: [thursday1] });
    const refused = await tryBook(party({ date: thursday1, time: '13:30' }));
    await patchSchedule({ closedDates: [] });
    expect(refusal(refused).reason).toBe('closed');
  });

  it('refuses yesterday with past and far ahead with window', async () => {
    const yesterday = shiftDays(madridToday(), -1);
    const tooEarly = await tryBook(party({ date: yesterday }));
    expect(refusal(tooEarly).reason).toBe('past');
    const tooLate = await tryBook(party({ date: shiftDays(madridToday(), 40) }));
    expect(refusal(tooLate).reason).toBe('window');
  });

  it('refuses 15:00, 16:00, 12:30 and 13:15 with late', async () => {
    for (const time of ['15:00', '16:00', '12:30', '13:15']) {
      const refused = await tryBook(party({ time, name: `Grid ${time}` }));
      expect(refusal(refused).reason, time).toBe('late');
    }
  });

  it('after the owner moves last arrival to 13:30, 14:00 is refused but old rows stay', async () => {
    const anotherTable = await tableModel.findOne({ _id: { $ne: table1._id } }).exec();
    if (!anotherTable) throw new Error('No spare table in the seed set');
    const date = shiftDays(sunday1, 14);
    const unlucky = await oldRow(date, '14:00', String(anotherTable._id));
    await patchSchedule({ lastArrival: '13:30' });
    const refused = await tryBook(party({ date, time: '14:00', name: 'Late demo' }));
    const list = await service.listForDay(date);
    await patchSchedule({ lastArrival: '14:30' });
    expect(refusal(refused).reason).toBe('late');
    expect(list.map((row) => row.time)).toContain('14:00');
    await bookingModel.deleteOne({ _id: unlucky._id }).exec();
  });

  it('allows today when the weekday is open and the slot is on the grid', async () => {
    // Today can be Monday to Wednesday, so the test schedule opens all week.
    await patchSchedule({
      openDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    });
    const booked = await tryBook(party({ date: madridToday(), name: 'Same-day Fred' }));
    await patchSchedule({ openDays: ['thursday', 'friday', 'saturday', 'sunday'] });
    expect(seat(booked).table).toBeTruthy();
  });

  it('refuses a party of children only with need-adult', async () => {
    const refused = await tryBook(party({ adults: 0, children: 2, name: 'Kids only' }));
    expect(refusal(refused).reason).toBe('need-adult');
  });

  it('adds adults and children: 2 plus 2 needs 4 seats', async () => {
    // Tables 1-3 are already held that whole day, so the smallest free fit
    // for 4 seats is table 4.
    const booked = await tryBook(
      party({
        adults: 2,
        children: 2,
        name: 'Four seats',
        email: 'fourseats@example.com',
        phone: '600 151 151',
      }),
    );
    expect(seat(booked).table).toBe('4');
  });

  it('11 and 12 guests are no-table, 13 are above-max', async () => {
    for (const adults of [11, 12]) {
      const refused = await tryBook(
        party({
          adults,
          name: `Party ${adults}`,
          email: `party${adults}@example.com`,
          phone: `600 150 1${adults}`,
        }),
      );
      expect(refusal(refused).reason, `${adults} guests`).toBe('no-table');
    }
    const refused = await tryBook(
      party({ adults: 13, name: 'Party 13', email: 'party13@example.com', phone: '600 150 113' }),
    );
    expect(refusal(refused).reason).toBe('above-max');
  });

  it('a lowered maximum makes a table that fits still answer above-max', async () => {
    await patchSchedule({ maxParty: 6 });
    const refused = await tryBook(party({ date: sunday1, time: '13:00', adults: 7, name: 'Above lowered' }));
    await patchSchedule({ maxParty: 12 });
    expect(refusal(refused).reason).toBe('above-max');
    expect(refusal(refused).maxParty).toBe(6);
  });

  it('the owner list shows the day sorted by arrival with the table name', async () => {
    const list = await service.listForDay(thursday1);
    const times = list.map((row) => row.time);
    expect(times).toEqual([...times].sort());
    expect(times[0]).toBe('13:00');
    expect(list[0].table).toBe('1');
  });

  it('the API DTO refuses a bad guest even when the page did not', async () => {
    const bad = plainToInstance(CreateBookingDto, {
      date: thursday1,
      time: '13:00',
      name: 'A',
      phone: '12',
      adults: 2,
      children: 0,
      requestId: randomUUID(),
    });
    const errors = await validate(bad);
    const props = new Set(errors.map((error) => error.property));
    expect(props.has('name')).toBe(true);
    expect(props.has('phone')).toBe(true);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
