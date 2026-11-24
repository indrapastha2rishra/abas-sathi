const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MONTH_INDEX_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatParts(year: number, monthIndex: number, day: number): string {
  return `${pad2(day)}-${MONTHS[monthIndex]}-${year}`;
}

function isValidCalendarDate(year: number, monthIndex: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) return false;
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return false;
  const check = new Date(year, monthIndex, day);
  return (
    check.getFullYear() === year &&
    check.getMonth() === monthIndex &&
    check.getDate() === day
  );
}

/**
 * Formats any supported date input into strict `dd-mmm-yyyy` (e.g. `01-Apr-2026`, `15-Sep-2026`).
 * Preserves timezone-neutral date-only values (`YYYY-MM-DD`, `DD/MM/YYYY`, `YYYY-MM-DD HH:mm:ss`)
 * and converts UTC ISO timestamps (`...T...Z` / `±HH:MM`) to local calendar date.
 */
export function formatDateDisplay(value: unknown, fallback = ''): string {
  if (value === null || value === undefined || value === '') return fallback;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback;
    return formatParts(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const raw = String(value).trim();
  if (!raw) return fallback;

  // 1. YYYY-MM-DD or YYYY/MM/DD (with optional local time, NO timezone suffix)
  const ymd = raw.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/
  );
  if (ymd) {
    const year = Number(ymd[1]);
    const monthIndex = Number(ymd[2]) - 1;
    const day = Number(ymd[3]);
    if (isValidCalendarDate(year, monthIndex, day)) {
      return formatParts(year, monthIndex, day);
    }
    return raw;
  }

  // 2. DD-MM-YYYY or DD/MM/YYYY (with optional local time, NO timezone suffix)
  const dmy = raw.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/
  );
  if (dmy) {
    const day = Number(dmy[1]);
    const monthIndex = Number(dmy[2]) - 1;
    const year = Number(dmy[3]);
    if (isValidCalendarDate(year, monthIndex, day)) {
      return formatParts(year, monthIndex, day);
    }
    return raw;
  }

  // 3. DD-MMM-YYYY or DD MMM YYYY (normalizes Sept -> Sep and pads day)
  const dMonY = raw.match(
    /^(\d{1,2})[-\s]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[-\s]+(\d{4})(?:[\s,T].*)?$/i
  );
  if (dMonY) {
    const day = Number(dMonY[1]);
    const monthIndex = MONTH_INDEX_MAP[dMonY[2].toLowerCase()];
    const year = Number(dMonY[3]);
    if (monthIndex !== undefined && isValidCalendarDate(year, monthIndex, day)) {
      return formatParts(year, monthIndex, day);
    }
    return raw;
  }

  // 4. Full ISO timestamps with Z or timezone offset, or JS Date strings
  const hasIsoTimezone = /[T ].*(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(raw);
  if (hasIsoTimezone || /\b(?:GMT|UTC)\b/i.test(raw) || /^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return formatParts(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  return raw;
}

/**
 * Formats timestamp values so the date part is strictly `dd-mmm-yyyy`
 * followed by `HH:mm:ss` when a time component is present.
 */
export function formatDateTimeDisplay(value: unknown, fallback = ''): string {
  if (value === null || value === undefined || value === '') return fallback;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback;
    return `${formatParts(value.getFullYear(), value.getMonth(), value.getDate())} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
  }

  const raw = String(value).trim();
  if (!raw) return fallback;

  // Local YYYY-MM-DD HH:mm(:ss) without timezone
  const localYmdTime = raw.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?$/
  );
  if (localYmdTime) {
    const datePart = formatDateDisplay(`${localYmdTime[1]}-${localYmdTime[2]}-${localYmdTime[3]}`, fallback);
    return `${datePart} ${localYmdTime[4]}`;
  }

  // Full ISO timestamp with timezone
  if (/[T ].*(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `${formatParts(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())} ${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}:${pad2(parsed.getSeconds())}`;
    }
  }

  return formatDateDisplay(raw, fallback);
}

/**
 * Formats a `YYYY-MM` month key into `Mmm-YYYY` (e.g. `2026-04` -> `Apr-2026`).
 */
export function formatMonthYearDisplay(yearMonth: string, fallback = ''): string {
  const match = String(yearMonth || '').trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return String(yearMonth || fallback);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return String(yearMonth || fallback);
  return `${MONTHS[monthIndex]}-${year}`;
}

export function getMonthShortName(monthIndex: number): string {
  return MONTHS[((monthIndex % 12) + 12) % 12];
}
