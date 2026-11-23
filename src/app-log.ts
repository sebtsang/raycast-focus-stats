import { open, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { NewSession, PendingSession } from "./types";

const logFilename = /^raycast-x-(\d{4}-\d{2}-\d{2}) (\d{2})\.(\d{2})\.(\d{2})([+-]\d{4})\.log$/;
const recordHeader = /^\[\w+ (\d{2}):(\d{2}):(\d{2})\.(\d{3})\] (.*)$/;
/** A clock that goes back further than this passed midnight. Smaller steps are out-of-order lines or daylight saving. */
const hour = 60 * 60 * 1000;

function clockTime(hours: number, minutes: number, seconds: number, milliseconds: number): number {
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
}

type FocusRecord = {
  type: "request" | "started" | "summary" | "completed" | "cancelled";
  at: Date;
  goal?: string;
  id?: string;
  seconds?: number;
};

function recordType(message: string): FocusRecord["type"] | undefined {
  if (message.endsWith("macos-app Starting Focus session")) return "request";
  const headline = message.split("[handler::focus] ")[1];
  if (headline?.startsWith("Focus session started {")) return "started";
  if (headline?.startsWith("Focus session activity summary tracked {")) return "summary";
  if (headline?.startsWith("Focus session completed {")) return "completed";
  if (headline?.startsWith("Focus session cancelled {")) return "cancelled";
}

/**
 * Log lines carry a time but no date, and Raycast trims the oldest lines from logs that stay open for days. The only
 * fixed point is the last line, which was logged when the file was last modified, so days are counted back from there.
 * Raycast's own log collector dates these lines the same way.
 */
async function readRecords(path: string): Promise<FocusRecord[]> {
  const file = await open(path);
  try {
    const found: { record: Omit<FocusRecord, "at">; clock: number; midnights: number }[] = [];
    let record: Omit<FocusRecord, "at"> | undefined;
    let previous: number | undefined;
    let midnights = 0;
    for await (const line of file.readLines({ encoding: "utf8", autoClose: false })) {
      const header = line.match(recordHeader);
      if (header) {
        const [, hours, minutes, seconds, milliseconds, message] = header;
        const clock = clockTime(Number(hours), Number(minutes), Number(seconds), Number(milliseconds));
        if (previous !== undefined && previous > clock + hour) midnights++;
        previous = clock;
        const type = recordType(message);
        record = type && { type };
        if (record) found.push({ record, clock, midnights });
      } else if (record) {
        const title = line.match(/^\s+Title: *(.*)$/)?.[1];
        if (title !== undefined) record.goal = title.trim();
        const id = line.match(/^\s+id: "([^"]+)",?\s*$/)?.[1];
        if (id !== undefined) record.id = id;
        const duration = line.match(/^\s+duration: (\d+(?:\.\d+)?),?\s*$/)?.[1];
        if (duration !== undefined) record.seconds = Number(duration);
      }
    }

    // Read after the lines, so a line written while reading can't be newer than the modified time.
    const { mtime } = await file.stat();
    const modifiedClock = clockTime(mtime.getHours(), mtime.getMinutes(), mtime.getSeconds(), mtime.getMilliseconds());
    if (previous !== undefined && previous > modifiedClock + hour) midnights++;
    return found.map(({ record, clock, midnights: passed }) => ({
      ...record,
      at: new Date(mtime.getFullYear(), mtime.getMonth(), mtime.getDate() - (midnights - passed), 0, 0, 0, clock),
    }));
  } finally {
    await file.close();
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Replay Raycast v2's retained logs. The start's timestamp provides a stable SQLite key on every replay. */
export async function readAppLogSessions(
  directory = join(homedir(), "Library", "Logs", "com.raycast.macos"),
): Promise<{ recognized: boolean; sessions: NewSession[] }> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (isMissing(error)) return { recognized: false, sessions: [] };
    throw error;
  }

  let recognized = false;
  const sessions: NewSession[] = [];
  let request: FocusRecord | undefined;
  let pending: (PendingSession & { id: string }) | undefined;
  let duration: number | undefined;
  const files = names.flatMap((name) => {
    const match = name.match(logFilename);
    if (!match) return [];
    const [, date, hours, minutes, seconds, offset] = match;
    return [{ name, startedAt: Date.parse(`${date}T${hours}:${minutes}:${seconds}${offset}`) }];
  });
  files.sort((first, second) => first.startedAt - second.startedAt);

  for (const file of files) {
    try {
      for (const record of await readRecords(join(directory, file.name))) {
        recognized = true;
        switch (record.type) {
          case "request":
            request = record;
            break;
          case "started":
            pending = record.id
              ? { id: record.id, start: record.at, goal: request?.goal || "Focus session" }
              : undefined;
            request = undefined;
            duration = undefined;
            break;
          case "summary":
            duration = record.seconds;
            break;
          case "completed":
            if (pending && record.id === pending.id && duration !== undefined) {
              sessions.push({
                start: pending.start,
                goal: pending.goal,
                duration: Math.floor(duration / 60),
              });
            }
            pending = undefined;
            duration = undefined;
            break;
          case "cancelled":
            pending = undefined;
            duration = undefined;
            break;
        }
      }
    } catch (error) {
      // Raycast may remove a rotated file between listing the directory and opening it.
      if (!isMissing(error)) throw error;
    }
  }
  return { recognized, sessions };
}
