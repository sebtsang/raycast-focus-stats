import { lock } from "proper-lockfile";
import { readAppLogSessions } from "./app-log";
import { getEvents } from "./events";
import { DatabasePath } from "./lib/db";
import { createSession, getCurrentSession, removeCurrentSession, saveSession, setCurrentSession } from "./sessions";

async function saveAvailableSessions(): Promise<number> {
  let saved = 0;
  const appLog = await readAppLogSessions();
  if (appLog.recognized) {
    for (const session of appLog.sessions) {
      if (saveSession(session, 1000)) saved++;
    }
    return saved;
  }

  const { events, markRefreshed } = getEvents();
  for (const event of events) {
    if (event.type === "start") {
      setCurrentSession(createSession(event.start, event.goal));
    } else {
      const pending = getCurrentSession();
      if (pending === null) continue;
      if (saveSession({ ...pending, duration: event.duration })) saved++;
      removeCurrentSession();
    }
  }
  markRefreshed();
  return saved;
}

export async function syncSessions(): Promise<number> {
  const release = await lock(DatabasePath, { retries: { retries: 4, minTimeout: 50, maxTimeout: 250 } });
  try {
    return await saveAvailableSessions();
  } finally {
    await release();
  }
}
