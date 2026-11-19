import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { NewSession, PendingSession } from "./types";

const logFilename = /^raycast-x-(\d{4}-\d{2}-\d{2}) (\d{2})\.(\d{2})\.(\d{2})([+-]\d{4})\.log$/;
const recordHeader = /^\[\w+ (\d{2}:\d{2}:\d{2}\.\d{3})\] (.*)$/;
const day = 24 * 60 * 60 * 1000;

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

async function* readRecords(path: string, midnight: number, timeOfDay: string) {
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let record: FocusRecord | undefined;
  try {
    for await (const line of lines) {
      const header = line.match(recordHeader);
      if (header) {
        if (record) yield record;
        const [, clock, message] = header;
        if (Number(timeOfDay.slice(0, 2)) - Number(clock.slice(0, 2)) > 12) midnight += day;
        timeOfDay = clock;
        const type = recordType(message);
        const [hours, minutes, seconds] = clock.split(":").map(Number);
        const at = new Date(midnight + (hours * 3600 + minutes * 60 + seconds) * 1000);
        record = type ? { type, at } : undefined;
      } else if (record) {
        const title = line.match(/^\s+Title: *(.*)$/)?.[1];
        if (title !== undefined) record.goal = title.trim();
        const id = line.match(/^\s+id: "([^"]+)",?\s*$/)?.[1];
        if (id !== undefined) record.id = id;
        const duration = line.match(/^\s+duration: (\d+(?:\.\d+)?),?\s*$/)?.[1];
        if (duration !== undefined) record.seconds = Number(duration);
      }
    }
    if (record) yield record;
  } finally {
    lines.close();
    stream.destroy();
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
    const time = `${hours}:${minutes}:${seconds}`;
    return [
      {
        name,
        time,
        midnight: Date.parse(`${date}T00:00:00${offset}`),
        startedAt: Date.parse(`${date}T${time}${offset}`),
      },
    ];
  });
  files.sort((first, second) => first.startedAt - second.startedAt);

  for (const file of files) {
    try {
      for await (const record of readRecords(join(directory, file.name), file.midnight, file.time)) {
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
              sessions.push({ start: pending.start, goal: pending.goal, duration: Math.floor(duration / 60) });
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
