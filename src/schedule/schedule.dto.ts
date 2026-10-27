import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, Matches, Max, Min } from 'class-validator';
import { lastArrivalChoices, weekdayNames } from './lunch-time.js';

// What the owner may change on the schedule from the admin Lunch section.
// Every field is optional on its own, but at least one must be present
// (an empty body is rejected by the validation pipe).
export class UpdateScheduleDto {
  // The full set of open weekdays, lowercase, from the weekdayNames list.
  // The page always sends the complete list, so there is no add/remove here.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(weekdayNames.length)
  @IsIn(weekdayNames, { each: true })
  openDays?: string[];

  // Restricted to the four chips the plan allows, so the grid can never end
  // up empty or broken.
  @IsOptional()
  @IsIn(lastArrivalChoices)
  lastArrival?: string;

  // The full shut-date list as "YYYY-MM-DD" strings. The page sends the
  // complete list after each add or remove, so one write is one truth.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true, message: 'closedDates must be YYYY-MM-DD' })
  closedDates?: string[];

  // Biggest party accepted online. Lower it and big parties become above-max.
  @IsOptional()
  @Min(2)
  @Max(12)
  maxParty?: number;
}
