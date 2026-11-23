import assert from "node:assert/strict";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readAppLogSessions } from "../src/app-log.ts";

/** Writes a log whose last line was logged at `lastWritten`, in local time like Raycast's own clocks. */
async function writeLog(path, contents, lastWritten) {
  await writeFile(path, contents);
  await utimes(path, lastWritten, lastWritten);
}

test("pairs a real start and completion across midnight and log rotation", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "focus-stats-logs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeLog(
    join(directory, "raycast-x-2026-11-19 23.58.00-0500.log"),
    `[info 23:59:00.092] 💻 macos-app Starting Focus session
  Title: Reading
[info 23:59:00.108] 🔌 macos-node [handler::focus] Focus session started {
  id: "reading",
}
`,
    new Date(2026, 10, 19, 23, 59, 0, 108),
  );
  await writeLog(
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
    new Date(2026, 10, 20, 1, 5, 0, 0),
  );
  const expected = {
    recognized: true,
    sessions: [{ goal: "Reading", duration: 44, start: new Date(2026, 10, 19, 23, 59, 0, 108) }],
  };
  assert.deepEqual(await readAppLogSessions(directory), expected);
  assert.deepEqual(await readAppLogSessions(directory), expected);
});

test("keeps a session that starts before midnight in a log still open after midnight", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "focus-stats-midnight-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeLog(
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
    new Date(2026, 10, 20, 0, 2, 0, 200),
  );
  assert.deepEqual((await readAppLogSessions(directory)).sessions, [
    { goal: "Focus session", duration: 2, start: new Date(2026, 10, 20, 0, 0, 0, 100) },
  ]);
});

const session = (id, start, end) => `[info ${start}] 💻 macos-app Starting Focus session
  Title: Writing
[info ${start}] 🔌 macos-node [handler::focus] Focus session started {
  id: "${id}",
}
[info ${end}] 🔌 macos-node [handler::focus] Focus session activity summary tracked {
  duration: 1800.098,
}
[info ${end}] 🔌 macos-node [handler::focus] Focus session completed {
  id: "${id}",
}
`;

test("dates sessions correctly after Raycast trims earlier days from the top of a log", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "focus-stats-trimmed-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "raycast-x-2026-11-19 13.58.33-0500.log");
  const today = session("today", "11:03:27.778", "11:33:27.880");
  const lastWritten = new Date(2026, 10, 23, 11, 39, 2, 657);
  const expected = [{ goal: "Writing", duration: 30, start: new Date(2026, 10, 23, 11, 3, 27, 778) }];
  // Two midnights are left in the log, then one, then none. The date must not move.
  for (const remaining of [
    "[info 19:12:07.935] a\n[info 23:52:29.000] b\n[info 00:05:32.000] c\n[info 23:40:22.000] d\n[info 00:05:59.000] e\n",
    "[info 23:40:22.000] d\n[info 00:05:59.000] e\n",
    "",
  ]) {
    await writeLog(path, remaining + today, lastWritten);
    assert.deepEqual((await readAppLogSessions(directory)).sessions, expected);
  }
});

test("counts a midnight that passes while the log is quiet", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "focus-stats-quiet-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeLog(
    join(directory, "raycast-x-2026-11-19 13.58.33-0500.log"),
    `${session("evening", "17:30:00.000", "18:00:00.000")}[info 09:00:00.000] next morning\n`,
    new Date(2026, 10, 20, 9, 0, 0, 0),
  );
  assert.deepEqual((await readAppLogSessions(directory)).sessions, [
    { goal: "Writing", duration: 30, start: new Date(2026, 10, 19, 17, 30, 0, 0) },
  ]);
});

test("does not count out-of-order lines or the end of daylight saving as a midnight", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "focus-stats-backward-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeLog(
    join(directory, "raycast-x-2026-11-01 00.30.00-0400.log"),
    `${session("early", "00:40:00.000", "01:10:00.000")}[info 01:59:59.900] a\n[info 01:00:00.100] b\n[info 01:00:00.050] c\n`,
    new Date(2026, 10, 1, 9, 0, 0, 0),
  );
  assert.deepEqual((await readAppLogSessions(directory)).sessions, [
    { goal: "Writing", duration: 30, start: new Date(2026, 10, 1, 0, 40, 0, 0) },
  ]);
});

test("leaves the legacy log reader available when there is no Raycast v2 log", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "focus-stats-no-logs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  assert.deepEqual(await readAppLogSessions(join(directory, "missing")), { recognized: false, sessions: [] });
});
