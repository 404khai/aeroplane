import { useEffect, useState } from "react";

export function ServiceLogsPanel({ id }: { id: string }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Connecting…");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) {
      setStatus("Paused");
      return;
    }
    const events = new EventSource(
      `/api/system/inspection/services/${encodeURIComponent(id)}/logs`,
    );
    events.addEventListener("logs", (event) => {
      setText(JSON.parse((event as MessageEvent).data).text);
      setStatus("Live · 3 second snapshots");
    });
    events.addEventListener("unavailable", () =>
      setStatus("Logs unavailable; retrying"),
    );
    events.onerror = () =>
      setStatus("Disconnected · reconnecting automatically");
    return () => events.close();
  }, [id, paused]);
  const lines = text
    .split("\n")
    .filter(
      (line) =>
        line.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" ||
          (filter === "errors"
            ? /error|fatal|exception/i.test(line)
            : /warn/i.test(line))),
    );
  return (
    <section className="space-y-3">
      <p className="text-xs text-zinc-500">
        {status}. Latest 300 lines / 30 minutes / 128 KiB. Streams reconnect
        every five minutes. Common credential patterns are redacted; application
        logs may still contain sensitive data.
      </p>
      <div className="flex flex-wrap gap-3">
        <input
          aria-label="Search logs"
          placeholder="Search logs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-zinc-800 bg-black px-3 py-2 text-sm"
        />
        <select
          aria-label="Log severity filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-zinc-800 bg-black p-2 text-sm"
        >
          <option value="all">All lines</option>
          <option value="errors">Errors (text match)</option>
          <option value="warnings">Warnings (text match)</option>
        </select>
        <button
          onClick={() => setPaused(!paused)}
          className="text-xs text-zinc-300 underline"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      <pre
        aria-label="Service logs"
        className="max-h-96 min-h-32 overflow-auto whitespace-pre-wrap break-all border border-zinc-800 bg-black p-4 font-mono text-xs text-zinc-300"
      >
        {lines.join("\n") || "No matching log lines."}
      </pre>
    </section>
  );
}
