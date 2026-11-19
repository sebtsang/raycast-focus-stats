import { Cache } from "@raycast/api";
import type { PendingSession, Session, NewSession } from "./types";
import { getDatabase } from "./lib/db";
import { sessionsTable } from "./lib/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { showToast, Toast } from "@raycast/api";

const cache = new Cache();

export function createSession(start: Date, goal: string): PendingSession {
  return { start, goal };
}

/**
 * Retrieves the current session from cache
 *
 * @returns {PendingSession | null} The current session or null if no current session exists
 */
export function getCurrentSession(): PendingSession | null {
  const currentSessionString = cache.get("currentSession");

  if (!currentSessionString) {
    return null;
  }

  try {
    const { start, goal } = JSON.parse(currentSessionString);
    return { start: new Date(start), goal };
  } catch {
    // If this code fails to parse the existing cached session, simply inform the user but ignore
    // the error, seeing as, as far as we know, there's no way to recover from it.
    showToast({ style: Toast.Style.Failure, title: "Failed to parse cached session. Discarding." });
    return null;
  }
}

/**
 * Saves the current session to cache
 *
 * @param {PendingSession} session - The session to save
 */
export function setCurrentSession(session: PendingSession): void {
  cache.set("currentSession", JSON.stringify(session));
}

/**
 * Removes the current session from cache, regardless of whether it exists or not.
 */
export function removeCurrentSession() {
  cache.remove("currentSession");
}

/** Inserts a session. Older log sources can timestamp the same start slightly differently. */
export function saveSession(session: NewSession, timestampTolerance = 0): boolean {
  const timestamp = session.start.getTime();
  const database = getDatabase();
  if (timestampTolerance > 0) {
    const existing = database
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.goal, session.goal),
          gte(sessionsTable.timestamp, timestamp - timestampTolerance),
          lte(sessionsTable.timestamp, timestamp + timestampTolerance),
        ),
      )
      .get();
    if (existing) return false;
  }

  const result = database
    .insert(sessionsTable)
    .values({ goal: session.goal, duration: session.duration, timestamp })
    .onConflictDoNothing()
    .run();
  return Number(result.changes) > 0;
}

/**
 * Retrieves all sessions for a specific date.
 *
 * @param {Date} date - The date for which to retrieve sessions
 * @returns {Session[]} An array of Session objects for the specified date
 */
export function getSessionsByDate(date: Date): Session[] {
  // Build the dates for the start and end of the user's day, so we can then access the timestamp
  // date to build the file's names.
  const startOfDay = new Date(date);
  const endOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  endOfDay.setHours(23, 59, 59, 999);

  const database = getDatabase();
  const rows = database
    .select()
    .from(sessionsTable)
    .where(and(gte(sessionsTable.timestamp, startOfDay.getTime()), lte(sessionsTable.timestamp, endOfDay.getTime())))
    .orderBy(sessionsTable.timestamp)
    .all();

  return rows.map((row: { id: number; goal: string; duration: number; timestamp: number }) => ({
    id: row.id,
    goal: row.goal,
    duration: row.duration,
    start: new Date(row.timestamp),
  }));
}
