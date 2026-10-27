import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { seedTables, Table, TableDoc } from './table.schema.js';

// Owns the table collection. There are no table routes: the booking service
// reads it directly when picking the smallest table that fits.
@Injectable()
export class TablesService implements OnModuleInit {
  constructor(@InjectModel(Table.name) private readonly model: Model<TableDoc>) {}

  // Seed the eight tables once when the collection is empty. Safe on every
  // restart because it only writes when there is nothing there.
  async onModuleInit() {
    try {
      const count = await this.model.countDocuments().exec();
      if (count > 0) return;
      const created = await this.model.insertMany(
        seedTables.map((table) => ({ ...table, active: true })),
      );
      console.info('[iturrieta] tables seeded', created.length);
    } catch (error) {
      console.info('[iturrieta] tables seed failed', (error as Error).message);
    }
  }

  // Every table that can still be assigned. Ordered by seat count so the
  // smallest fit is the first match when scanning.
  async allActive() {
    return this.model.find({ active: true }).sort({ seats: 1, name: 1 }).exec();
  }
}
