import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// One booking: a party, a date, an arrival chip, and the table it holds from
// its arrival until the end of lunch. Dates and times are plain strings, see
// lunch-time.ts for why. Only "confirmed" exists for now; cancelled rows stay
// out of the unique index through the partial filter.
@Schema()
export class Booking {
  // Lunch day, "YYYY-MM-DD".
  @Prop({ type: String, required: true })
  date!: string;

  // Arrival chip, "HH:MM".
  @Prop({ type: String, required: true })
  time!: string;

  // The guest, as typed on the booking page.
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  phone!: string;

  @Prop({ type: String, required: true })
  email!: string;

  @Prop({ type: String })
  requestId?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Guest' })
  guestId?: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  adults!: number;

  @Prop({ type: Number, required: true, min: 0 })
  children!: number;

  // adults + children, cached so the admin list can sort without a recompute.
  @Prop({ type: Number, required: true })
  seats!: number;

  // The held table.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Table', required: true })
  tableId!: Types.ObjectId;

  // Only confirmed rows exist today. The partial unique index filters on it,
  // so a future cancelled booking would free its table.
  @Prop({ type: String, default: 'confirmed' })
  status = 'confirmed';
}

export type BookingDoc = HydratedDocument<Booking>;
export const BookingSchema = SchemaFactory.createForClass(Booking);

// A table can only be assigned once per day. The request id also makes a
// retried POST return its original booking rather than reserving another table.
BookingSchema.index(
  { date: 1, tableId: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' } },
);

BookingSchema.index(
  { requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } },
);
