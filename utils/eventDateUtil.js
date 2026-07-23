/**
 * Date helpers for the event create/edit screen and the date & time sheet.
 *
 * Separate from dateFormatUtil.js on purpose: that file formats timestamps for
 * display across the hub and event screens, this one is picker mechanics
 * (rounding, parsing typed input, building calendar grids).
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

const HOUR_IN_MS = 60 * 60 * 1000;

// 5:18pm -> 5:30pm, 6:49pm -> 7:00pm, 5:30pm stays 5:30pm
function roundUpToHalfHour(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const minutes = d.getMinutes();

  if (minutes === 0 || minutes === 30) return d;

  if (minutes < 30) {
    d.setMinutes(30);
  } else {
    d.setMinutes(0);
    d.setHours(d.getHours() + 1);
  }

  return d;
}

function addDays(date, count) {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0);
  return d;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getUpcomingWeekend(from) {
  const today = new Date(from);
  const day = today.getDay(); // 0 Sun ... 6 Sat

  if (day === 0 || day === 6) return today;

  return addDays(today, 6 - day);
}

// Which preset pill the chosen date lands on. Derived from the date itself so
// picking a future date in the sheet lights up "Later"
function derivePreset(start) {
  if (!start) return null;

  const now = new Date();
  if (isSameDay(start, now)) return "today";
  if (isSameDay(start, addDays(now, 1))) return "tomorrow";
  if (isSameDay(start, getUpcomingWeekend(now))) return "weekend";

  return "later";
}

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

// no time zone so send local wall-clock time rather than toISOString()
// Sending UTC makes the hub read the value back shifted by the local offset
function toLocalTimestamp(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatRowDate(date) {
  const dayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];
  return `${dayNames[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

function formatShortDate(date) {
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

// "2 AM" on the hour or "2:30 AM" otherwise
function formatClock(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";
  let displayHour = hours % 12;
  if (displayHour === 0) displayHour = 12;

  if (minutes === 0) return `${displayHour} ${suffix}`;
  return `${displayHour}:${pad(minutes)} ${suffix}`;
}

function formatRangeSummary(start, end, isAllDay) {
  if (!start) return null;

  if (isAllDay) {
    if (end && !isSameDay(start, end)) {
      return `${formatShortDate(start)} – ${formatShortDate(end)} · All day`;
    }
    return `${formatShortDate(start)} · All day`;
  }

  if (end && !isSameDay(start, end)) {
    return `${formatShortDate(start)}, ${formatClock(start)} – ${formatShortDate(
      end
    )}, ${formatClock(end)}`;
  }

  if (end) {
    return `${formatShortDate(start)}, ${formatClock(start)} – ${formatClock(end)}`;
  }

  return `${formatShortDate(start)}, ${formatClock(start)}`;
}

// Accepts "7", "7pm", "7:30 pm", "19:30", "1930", "730"
// Without am/pm it stays in whichever half of the day the field is already in
// Returns a Date on the reference day or null when it can't be read
function parseTypedTime(text, reference) {
  const trimmed = String(text || "").trim().toLowerCase().replace(/\./g, "");
  if (!trimmed) return null;

  let body = trimmed;
  let meridiem = null;

  const meridiemMatch = body.match(/(am|pm|a|p)$/);
  if (meridiemMatch) {
    meridiem = meridiemMatch[1][0];
    body = body.slice(0, body.length - meridiemMatch[1].length).trim();
  }

  let hour = null;
  let minute = 0;

  const colon = body.match(/^(\d{1,2}):(\d{2})$/);
  const bare = body.match(/^(\d{1,2})$/);
  const compact = body.match(/^(\d{3,4})$/);

  if (colon) {
    hour = parseInt(colon[1], 10);
    minute = parseInt(colon[2], 10);
  } else if (bare) {
    hour = parseInt(bare[1], 10);
  } else if (compact) {
    const digits = compact[1];
    hour = parseInt(digits.slice(0, digits.length - 2), 10);
    minute = parseInt(digits.slice(-2), 10);
  } else {
    return null;
  }

  if (minute > 59) return null;

  if (meridiem === "a") {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
  } else if (meridiem === "p") {
    if (hour < 1 || hour > 12) return null;
    if (hour !== 12) hour += 12;
  } else if (hour > 23) {
    return null;
  } else if (hour <= 12) {
    // No am/pm typed, so keep the half of the day the field is already in
    const referenceIsPm = reference.getHours() >= 12;
    if (hour === 12) {
      hour = referenceIsPm ? 12 : 0;
    } else if (referenceIsPm) {
      hour += 12;
    }
  }

  const result = new Date(reference);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const leadingBlanks = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export {
  MONTH_NAMES,
  MONTH_SHORT,
  DAY_SHORT,
  WEEKDAY_INITIALS,
  HOUR_IN_MS,
  roundUpToHalfHour,
  addDays,
  startOfDay,
  endOfDay,
  isSameDay,
  getUpcomingWeekend,
  derivePreset,
  pad,
  toLocalTimestamp,
  formatRowDate,
  formatShortDate,
  formatClock,
  formatRangeSummary,
  parseTypedTime,
  buildMonthGrid,
};