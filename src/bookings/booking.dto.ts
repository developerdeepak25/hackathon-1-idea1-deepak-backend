import { IsInt, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

// What the booking page sends when the guest confirms. Whitelist mode strips
// anything else, so the API only ever sees the fields below. The page
// validates too; the API never trusts it.
export class CreateBookingDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'time must be HH:MM' })
  time!: string;

  @IsString()
  @Length(2, 80, { message: 'name needs at least 2 characters' })
  name!: string;

  // At least six digits, spaces and dashes allowed around them.
  @IsString()
  @Matches(/(?:\D*\d){6,}/, { message: 'phone needs at least 6 digits' })
  phone!: string;

  @IsUUID()
  requestId!: string;

  // Both count as seats. adults is allowed to be 0 at validation level so the
  // service can answer with the friendlier need-adult reason.
  @IsInt()
  @Min(0)
  adults!: number;

  @IsInt()
  @Min(0)
  children!: number;
}

// The ?date of the owner bookings list.
export class QueryDayDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;
}

// The ?from.. ?to range for the owner bookings list.
export class QueryRangeDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' })
  from!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' })
  to!: string;
}
