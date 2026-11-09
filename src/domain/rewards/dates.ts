import type { LocalDate } from './types';

const toUtc = (d: LocalDate) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));

export const addDays = (d: LocalDate, n: number): LocalDate =>
  new Date(toUtc(d) + n * 86_400_000).toISOString().slice(0, 10);

export const daysBetween = (from: LocalDate, to: LocalDate): number => Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
