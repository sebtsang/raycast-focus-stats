import { LaunchProps, LaunchType, showHUD } from "@raycast/api";
import { getInitializationReason, needsInitialization } from "./lib/init/tracking";
import { syncSessions } from "./sync";

/** Saves finished sessions in the background, before Raycast trims them from its logs. */
export default async function Command({ launchType }: LaunchProps) {
  const isUserInitiated = launchType === LaunchType.UserInitiated;

  // View Focus Stats creates and migrates the database.
  if (needsInitialization()) {
    if (isUserInitiated) await showHUD(getInitializationReason());
    return;
  }

  const saved = await syncSessions();
  if (isUserInitiated) await showHUD(`Saved ${saved} new Focus ${saved === 1 ? "session" : "sessions"}`);
}
