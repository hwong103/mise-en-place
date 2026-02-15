const pad = (value: number) => value.toString().padStart(2, "0");

export function toDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string) {
  const [year, month, day] = key.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
}

export function normalizeToUtcDate(date: Date) {
  return fromDateKey(toDateKey(date));
}

export function getUpcomingRange(referenceDate = new Date(), daysCount = 7) {
  const start = normalizeToUtcDate(referenceDate);
  const days = Array.from({ length: daysCount }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return day;
  });
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + (daysCount - 1));
  return { start, end, days };
}

export function getWeekRange(referenceDate = new Date(), weekStartsOn = 1) {
  const start = new Date(referenceDate);
  const dayOfWeek = start.getDay();
  const diff = (dayOfWeek - weekStartsOn + 7) % 7;

  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start, end, days };
}
