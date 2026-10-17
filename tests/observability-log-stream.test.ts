import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readServiceLogs,
  redactLogText,
} from "../src/server/observability/service-logs.js";
test("Docker log execution uses fixed arguments, bounds output, redacts credentials and cancels its process", async () => {
  const directory = await mkdtemp(join(tmpdir(), "canvas-logs-"));
  const originalPath = process.env.PATH;
  try {
    const executable = join(directory, "docker");
    await writeFile(
      executable,
      `#!${process.execPath}\nconst args = process.argv.slice(2);\nif (args.join(' ') !== 'logs --timestamps --tail 300 --since 30m ${"a".repeat(64)}') process.exit(2);\nif (process.env.CANVAS_LOG_HOLD) setInterval(() => {}, 1000); else { process.stdout.write('x'.repeat(300000)); process.stdout.write('\\npassword=never-leak-this\\n'); }\n`,
    );
    await chmod(executable, 0o700);
    process.env.PATH = `${directory}:${originalPath}`;
    const output = await readServiceLogs("a".repeat(64));
    assert.ok(output.length <= 128 * 1024);
    assert.doesNotMatch(output, /never-leak-this/);
    assert.match(output, /password=\[redacted\]/);
    process.env.CANVAS_LOG_HOLD = "1";
    const controller = new AbortController();
    const pending = readServiceLogs("a".repeat(64), controller.signal);
    setTimeout(() => controller.abort(), 50);
    await assert.rejects(() => pending, /Logs unavailable/);
  } finally {
    process.env.PATH = originalPath;
    delete process.env.CANVAS_LOG_HOLD;
    await rm(directory, { recursive: true, force: true });
  }
});

test("redaction stays bounded on a long non-URL token", () => {
  const input = "x".repeat(128 * 1024);
  const started = performance.now();
  assert.equal(redactLogText(input), input);
  assert.ok(
    performance.now() - started < 1000,
    "long log lines must not block the event loop",
  );
});
