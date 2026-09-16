import { getLocalTimeZone, parseDate } from "@internationalized/date";
import { today, type DateValue } from "@internationalized/date";

export interface DateRangeValue {
  start: string | null;
  end: string | null;
}

export function isDateRangeReversed(range: DateRangeValue) {
  return !!range.start && !!range.end && range.end.slice(0, 10) < range.start.slice(0, 10);
}

export function dayToDateValue(day: string | null | undefined) {
  if (!day) return undefined;
  try {
    return parseDate(day.slice(0, 10));
  } catch {
    return undefined;
  }
}

export function dateValueToDay(value: DateValue | null | undefined) {
  return value ? value.toString().slice(0, 10) : null;
}

export function todayDay() {
  return today(getLocalTimeZone()).toString();
}

export const UNBOUNDED_START_DAY = "1970-01-01";

export function windowStartDay(day: string | null | undefined) {
  const value = day?.slice(0, 10);
  return !value || value <= UNBOUNDED_START_DAY ? null : value;
}

export function windowEndDay(day: string | null | undefined) {
  return day ? day.slice(0, 10) : null;
}

export function isWindowOpenToday(start: string | null | undefined, end: string | null | undefined) {
  const today = todayDay();
  const from = windowStartDay(start);
  const until = windowEndDay(end);
  return (!from || from <= today) && (!until || until >= today);
}
