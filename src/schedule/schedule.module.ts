import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { Schedule, ScheduleSchema } from './schedule.schema.js';
import { ScheduleController } from './schedule.controller.js';
import { ScheduleService } from './schedule.service.js';
import { Table, TableSchema } from './table.schema.js';
import { TablesService } from './tables.service.js';

// Holds the lunch rules and the eight tables, and seeds both when empty.
// AuthModule comes along so the controller can use the owner guard.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Table.name, schema: TableSchema },
    ]),
    AuthModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService, TablesService],
  exports: [ScheduleService, TablesService],
})
export class ScheduleModule {}
