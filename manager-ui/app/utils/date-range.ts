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
