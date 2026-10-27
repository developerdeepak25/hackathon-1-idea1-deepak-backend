import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// A physical table. Seats only: the booking rule picks the smallest table
// that fits, and the floor board stays in the browser, so there are no
// coordinates here.
@Schema()
export class Table {
  // Human name shown on the confirmation and the admin board, for example "5".
  @Prop({ type: String, required: true, unique: true })
  name!: string;

  // How many guests fit. Parties bigger than the largest seat count never
  // reach this collection; the booking service refuses them earlier.
  @Prop({ type: Number, required: true, min: 1 })
  seats!: number;

  // False means the table is out of service and never assigned.
  @Prop({ type: Boolean, default: true })
  active = true;
}

export type TableDoc = HydratedDocument<Table>;
export const TableSchema = SchemaFactory.createForClass(Table);

// The eight tables of the seed, smallest first, matching the mock. The API
// seed uses names and seats only: no fake closed day and no busy Sunday.
export const seedTables = [
  { name: '1', seats: 2 },
  { name: '2', seats: 2 },
  { name: '3', seats: 4 },
  { name: '4', seats: 4 },
  { name: '5', seats: 6 },
  { name: '6', seats: 6 },
  { name: '7', seats: 8 },
  { name: '8', seats: 10 },
];
