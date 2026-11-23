import { int, text, uniqueIndex, sqliteTable } from "drizzle-orm/sqlite-core";

export const sessionsTable = sqliteTable(
  "sessions",
  {
    id: int().primaryKey({ autoIncrement: true }).notNull(),
    goal: text().notNull(),
    /** Duration in minutes */
    duration: int().notNull(),
    timestamp: int().notNull(),
    /** Raycast's own session ID. Null for sessions saved before it was recorded or read from the system log. */
    raycastId: text("raycast_id"),
  },
  (table) => [
    uniqueIndex("sessions_timestamp_unique").on(table.timestamp),
    // Prevent duplicate sessions for the same goal and timestamp.
    uniqueIndex("sessions_goal_timestamp_unique").on(table.goal, table.timestamp),
    uniqueIndex("sessions_raycast_id_unique").on(table.raycastId),
  ],
);
