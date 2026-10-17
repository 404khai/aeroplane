export function cpuPercent(
  previous: { total: number; idle: number } | undefined,
  current: { total: number; idle: number },
) {
  if (!previous) return null;
  const total = current.total - previous.total;
  const idle = current.idle - previous.idle;
  return total > 0 && idle >= 0 && idle <= total
    ? (1 - idle / total) * 100
    : null;
}

export function counterRate(
  previous: number | undefined,
  current: number,
  elapsedMs: number,
) {
  return previous !== undefined && current >= previous && elapsedMs > 0
    ? ((current - previous) * 1000) / elapsedMs
    : null;
}

export function appendHistory<T extends { timestamp: number }>(
  history: T[],
  sample: T,
  retentionMs: number,
  limit: number,
): T[] {
  return [
    ...history.filter(
      (entry) => entry.timestamp > sample.timestamp - retentionMs,
    ),
    sample,
  ].slice(-limit);
}

export function parseBytes(value: string): number | null {
  const match = value
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB|KiB|MiB|GiB|TiB)$/i);
  if (!match) return null;
  const unit = match[2].toLowerCase();
  const power = "bkmgt".indexOf(unit[0]);
  return (
    Number(match[1]) * (unit.includes("i") ? 1024 : 1000) ** Math.max(0, power)
  );
}
