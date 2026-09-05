import { WEEKDAYS_JP } from "../types";

export function weekdayJP(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return WEEKDAYS_JP[d.getDay()];
}

export function weekdayIndex(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

export function todayStr(): string {
  return toISODate(new Date());
}

export function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  return Math.round((db - da) / 86400000);
}

export function formatDateJP(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}/${m}/${d}(${weekdayJP(dateStr)})`;
}
