export const CANADA_TIMEZONE = 'America/Toronto';
export const IST_TIMEZONE = 'Asia/Kolkata';
export const GMT_TIMEZONE = 'Etc/GMT';

export function formatInTimeZone(
  iso: string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
) {
  const date = new Date(iso);

  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  }).format(date);
}

export function slotLabelTriple(startIso: string, endIso: string) {
  return {
    canada: `${formatInTimeZone(startIso, CANADA_TIMEZONE)} - ${formatInTimeZone(endIso, CANADA_TIMEZONE, { hour: 'numeric', minute: '2-digit' })}`,
    ist: `${formatInTimeZone(startIso, IST_TIMEZONE)} - ${formatInTimeZone(endIso, IST_TIMEZONE, { hour: 'numeric', minute: '2-digit' })}`,
    gmt: `${formatInTimeZone(startIso, GMT_TIMEZONE)} - ${formatInTimeZone(endIso, GMT_TIMEZONE, { hour: 'numeric', minute: '2-digit' })}`,
  };
}

export function toYMDInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(p => p.type === 'year')?.value ?? '';
  const month = parts.find(p => p.type === 'month')?.value ?? '';
  const day = parts.find(p => p.type === 'day')?.value ?? '';

  return `${year}-${month}-${day}`;
}