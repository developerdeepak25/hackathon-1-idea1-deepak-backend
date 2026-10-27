// Day helpers for booking rules. Today is always "today" in Europe/Madrid,
// because that is where the house is, no matter where the guest browses from.
// Every date is a "YYYY-MM-DD" string; no Date objects are stored.

import { weekdayNames } from '../schedule/lunch-time.js';

// Today in Europe/Madrid as "YYYY-MM-DD", for example "2026-10-27".
export function madridToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// The date n days after a "YYYY-MM-DD" string, still a plain string. The time
// is pinned to midday UTC so a date can never flip to the day before.
export function shiftDays(date: string, days: number) {
  const noon = Date.parse(`${date}T12:00:00Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(noon).toISOString().slice(0, 10);
}

// Which weekday a "YYYY-MM-DD" string falls on, as the lowercase name.
export function weekdayOf(date: string) {
  return weekdayNames[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

// How many days ahead a guest may book, today included.
export const bookingWindow = 28;
