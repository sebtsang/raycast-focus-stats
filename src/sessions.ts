import { Cache } from "@raycast/api";
import type { PendingSession, Session, NewSession } from "./types";
import { getDatabase } from "./lib/db";
import { sessionsTable } from "./lib/schema";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
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

/** How far apart two log sources can timestamp the same start, in milliseconds. */
const timestampTolerance = 1000;

/** Inserts a session unless it is already saved. Returns whether a new session was saved. */
export function saveSession(session: NewSession): boolean {
  const database = getDatabase();
  const timestamp = session.start.getTime();
  const { raycastId } = session;

  if (raycastId !== undefined) {
    const saved = database
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(eq(sessionsTable.raycastId, raycastId))
      .get();
    // The first save happened closest to the session, so its date is the most reliable one.
    if (saved) return false;

    // Adopt a session saved before Raycast's ID was recorded, possibly from the system log.
    const adopted = database
      .update(sessionsTable)
      .set({ raycastId })
      .where(
        and(
          isNull(sessionsTable.raycastId),
          eq(sessionsTable.goal, session.goal),
          gte(sessionsTable.timestamp, timestamp - timestampTolerance),
          lte(sessionsTable.timestamp, timestamp + timestampTolerance),
        ),
      )
      .run();
    if (Number(adopted.changes) > 0) return false;
  }

  const result = database
    .insert(sessionsTable)
    .values({ goal: session.goal, duration: session.duration, timestamp, raycastId })
    .onConflictDoNothing()
    .run();
  return Number(result.changes) > 0;
}

/** Retrieves all sessions, newest first. */
export function getSessions(): Session[] {
  return getDatabase()
    .select()
    .from(sessionsTable)
    .orderBy(desc(sessionsTable.timestamp))
    .all()
    .map((row) => ({ id: row.id, goal: row.goal, duration: row.duration, start: new Date(row.timestamp) }));
}
