function asUtcDate(value: string): Date | null {
  const source = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  const date = new Date(source);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function formatScoutDateUtc(value: string): string {
  const date = asUtcDate(value);
  return date ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(date) : value;
}

export function formatScoutDateWindowUtc(from: string, to: string): string {
  const start = asUtcDate(from);
  const end = asUtcDate(to);
  if (!start || !end) return `${from} – ${to}`;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${formatScoutDateUtc(from)} – ${formatScoutDateUtc(to)}`;
  }
  return `${formatter.format(start)} – ${formatter.format(end)}, ${end.getUTCFullYear()}`;
}
