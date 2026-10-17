export function parseCpuStat(text: string) {
  const line = text.split("\n").find((row) => row.startsWith("cpu "));
  const values = line?.trim().split(/\s+/).slice(1, 9).map(Number);
  if (
    !values ||
    values.length < 4 ||
    values.some((value) => !Number.isFinite(value))
  )
    throw new Error("Invalid CPU counters");
  return {
    total: values.reduce((a, b) => a + b, 0),
    idle: values[3] + (values[4] ?? 0),
    count: text.split("\n").filter((row) => /^cpu\d+\s/.test(row)).length,
  };
}

export function parseMemInfo(text: string) {
  const field = (name: string) => {
    const value = text.match(new RegExp(`^${name}:\\s+(\\d+) kB`, "m"));
    if (!value) throw new Error("Memory counters unavailable");
    return Number(value[1]) * 1024;
  };
  const total = field("MemTotal");
  return { total, used: Math.max(0, total - field("MemAvailable")) };
}

export function parseNetworkDev(text: string) {
  let receive = 0;
  let transmit = 0;
  let count = 0;
  for (const line of text.split("\n")) {
    const parts = line.split(":");
    if (parts.length !== 2 || parts[0].trim() === "lo") continue;
    // Exclude virtual bridges/veth to avoid counting container traffic twice.
    if (/^(veth|docker|br-|virbr)/.test(parts[0].trim())) continue;
    const values = parts[1].trim().split(/\s+/).map(Number);
    if (values.length < 16 || values.some((value) => !Number.isFinite(value)))
      throw new Error("Invalid network counters");
    receive += values[0];
    transmit += values[8];
    count++;
  }
  if (!count) throw new Error("Network interfaces unavailable");
  return { receive, transmit };
}

export function hasReadOnlyMount(mountInfo: string, path: string): boolean {
  return mountInfo.split("\n").some((line) => {
    const fields = line.split(" ");
    return fields[4] === path && fields[5]?.split(",").includes("ro");
  });
}
