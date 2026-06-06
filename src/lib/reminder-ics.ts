// Build a simple .ics calendar file for a reminder. The user's calendar app
// (Google Calendar, Apple Calendar, Outlook) sends the notification/email.
export interface ReminderInput {
  title: string;
  description?: string;
  email: string;
  daysFromNow: number;
  hour?: number; // 24h, default 9
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toIcsDate(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    "00Z"
  );
}

function escapeIcs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildReminderIcs(input: ReminderInput): string {
  const start = new Date();
  start.setDate(start.getDate() + input.daysFromNow);
  start.setHours(input.hour ?? 9, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@ai-workplace`;
  const desc = escapeIcs(input.description ?? "");
  const summary = escapeIcs(input.title);
  const email = input.email.trim();

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI Workplace//Task Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    `ORGANIZER;CN=AI Task Planner:mailto:${email}`,
    `ATTENDEE;CN=${email};RSVP=TRUE:mailto:${email}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${summary}`,
    "TRIGGER:-PT0M",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:EMAIL",
    `ATTENDEE:mailto:${email}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    "TRIGGER:-PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadReminderIcs(input: ReminderInput): void {
  const ics = buildReminderIcs(input);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reminder-${input.daysFromNow}d.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
