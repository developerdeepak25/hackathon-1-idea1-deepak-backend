import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// The one schedule row for the whole house. The seed creates it once and the
// owner edits it from the admin Lunch section. Prices live here too, because
// they belong to the sitting, not to a table.
@Schema()
export class Schedule {
  // Weekdays that take bookings. Names come from the weekdayNames list.
  @Prop({ type: [String], default: ['thursday', 'friday', 'saturday', 'sunday'] })
  openDays: string[] = ['thursday', 'friday', 'saturday', 'sunday'];

  // Lunch window. The first chip and the end of the table hold.
  @Prop({ type: String, default: '13:00' })
  lunchStart = '13:00';

  @Prop({ type: String, default: '16:00' })
  lunchEnd = '16:00';

  // The last chip a guest can pick as arrival time.
  @Prop({ type: String, default: '14:30' })
  lastArrival = '14:30';

  // Minutes between arrival chips. 30 keeps the grid 13:00, 13:30, 14:00, 14:30.
  @Prop({ type: Number, default: 30 })
  slotMinutes = 30;

  // Biggest party accepted online. A party above this is above-max.
  @Prop({ type: Number, default: 12 })
  maxParty = 12;

  // Extra shut days the owner added, as "YYYY-MM-DD" strings.
  @Prop({ type: [String], default: [] })
  closedDates: string[] = [];

  // Shown to the guest, never charged.
  @Prop({ type: Number, default: 45 })
  adultPrice = 45;

  @Prop({ type: Number, default: 16 })
  childPrice = 16;
}

export type ScheduleDoc = HydratedDocument<Schedule>;
export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
