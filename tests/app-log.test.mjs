import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readAppLogSessions } from "../src/app-log.ts";

test("pairs a real start and completion across midnight and log rotation", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "focus-stats-logs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    join(directory, "raycast-x-2026-11-19 23.58.00-0500.log"),
    `[info 23:59:00.092] 💻 macos-app Starting Focus session
  Title: Reading
[info 23:59:00.108] 🔌 macos-node [handler::focus] Focus session started {
  id: "reading",
}
`,
  );
  await writeFile(
    join(directory, "raycast-x-2026-11-20 00.00.00-0500.log"),
    `[info 00:43:07.123] 🔌 macos-node [handler::focus] Focus session activity summary tracked {
  duration: 2647.062,
}
[info 00:43:07.123] 🔌 macos-node [handler::focus] Focus session completed {
  id: "reading",
}
[info 01:00:00.000] 💻 macos-app Starting Focus session
  Title: Cancelled task
[info 01:00:00.010] 🔌 macos-node [handler::focus] Focus session started {
  id: "cancelled",
}
[info 01:00:10.000] 🔌 macos-node [handler::focus] Focus session activity summary tracked {
  duration: 10.000,
}
[info 01:00:10.001] 🔌 macos-node [handler::focus] Focus session cancelled {
  id: "cancelled"
}
[info 01:05:00.000] 🔌 macos-node [handler::focus] Focus session completed {
  id: "missing-start",
}
`,
  );
  const expected = {
    recognized: true,
    sessions: [{ goal: "Reading", duration: 44, start: new Date("2026-11-20T04:59:00.108Z") }],
  };
  assert.deepEqual(await readAppLogSessions(directory), expected);
  assert.deepEqual(await readAppLogSessions(directory), expected);
});

test("keeps a session that starts before midnight in a log still open after midnight", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "focus-stats-midnight-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    join(directory, "raycast-x-2026-11-19 23.59.00-0500.log"),
    `[info 23:59:59.900] 💻 macos-app Starting Focus session
  Title:
[info 00:00:00.100] 🔌 macos-node [handler::focus] Focus session started {
  id: "midnight",
}
[info 00:02:00.200] 🔌 macos-node [handler::focus] Focus session activity summary tracked {
  duration: 120.100,
}
[info 00:02:00.200] 🔌 macos-node [handler::focus] Focus session completed {
  id: "midnight",
}
`,
  );
  assert.deepEqual((await readAppLogSessions(directory)).sessions, [
    { goal: "Focus session", duration: 2, start: new Date("2026-11-20T05:00:00.100Z") },
  ]);
});

test("leaves the legacy log reader available when there is no Raycast v2 log", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "focus-stats-no-logs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  assert.deepEqual(await readAppLogSessions(join(directory, "missing")), { recognized: false, sessions: [] });
});
