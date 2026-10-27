// Small time and day helpers shared by the schedule and the booking modules.
// Times are always plain "HH:MM" strings and dates are "YYYY-MM-DD" strings.
// Strings (never Date objects) are what keep Mongo indexes and day math free
// of timezone drift between the API (Europe/Madrid) and the browser.

// Weekday names in the same order as getDay() on a JS date, so the number
// 0 is sunday and 4 is thursday. Store and compare the names, not numbers.
export const weekdayNames = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

// The only last-arrival values the owner can set. Each one keeps at least the
// 13:00 chip on the 30-minute grid.
export const lastArrivalChoices = ['13:00', '13:30', '14:00', '14:30'] as const;

// Minutes a "HH:MM" string sits after midnight, for example "14:30" is 870.
export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Turns minutes back into a "HH:MM" string, for example 870 into "14:30".
export function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

// The arrival chips: every 30 minutes from lunch start up to and including
// the last arrival, for example 13:00, 13:30, 14:00, 14:30.
export function buildSlots(lunchStart: string, lastArrival: string, slotMinutes: number) {
  const start = timeToMinutes(lunchStart);
  const last = timeToMinutes(lastArrival);
  const slots: string[] = [];
  for (let at = start; at <= last; at += slotMinutes) {
    slots.push(minutesToTime(at));
  }
  return slots;
}

// True only when the time sits exactly on a chip of the grid. "13:15" is
// off-grid and must be refused even if it falls inside the lunch window.
export function isOnSlotGrid(
  time: string,
  lunchStart: string,
  lastArrival: string,
  slotMinutes: number,
) {
  const start = timeToMinutes(lunchStart);
  const last = timeToMinutes(lastArrival);
  const at = timeToMinutes(time);
  return at >= start && at <= last && (at - start) % slotMinutes === 0;
}
