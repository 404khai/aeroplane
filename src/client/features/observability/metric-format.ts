export function bytes(value: number | null): string {
  if (value === null) return "Unavailable";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const power = Math.min(
    4,
    Math.max(0, Math.floor(Math.log2(Math.max(1, value)) / 10)),
  );
  return `${(value / 1024 ** power).toFixed(power ? 1 : 0)} ${units[power]}`;
}
export function duration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}
export function percent(value: number | null): string {
  return value === null ? "Unavailable" : `${value.toFixed(1)}%`;
}
