import { spawn } from "node:child_process";

export function redactLogText(text: string) {
  return text
    .replace(
      /(\b(?:password|passwd|secret|token|api[_-]?key|authorization|cookie)\b["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi,
      "$1[redacted]",
    )
    .replace(
      /\b([a-z][a-z0-9+.-]{0,31}:\/\/)[^\s/:@]+:[^\s/@]+@/gi,
      "$1[redacted]@",
    );
}

// A snapshot stream is deliberately bounded in Docker, on the server, and in the browser.
export function readServiceLogs(
  id: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error("Invalid container");
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      ["logs", "--timestamps", "--tail", "300", "--since", "30m", id],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let text = "";
    const stop = () => child.kill();
    const timeout = setTimeout(stop, 7000);
    signal?.addEventListener("abort", stop, { once: true });
    const append = (chunk: Buffer) => {
      text = (text + chunk.toString()).slice(-128 * 1024);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", stop);
      if (code === 0) resolve(redactLogText(text));
      else reject(new Error("Logs unavailable"));
    });
  });
}
