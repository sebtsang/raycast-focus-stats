import { Toast, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { getSessions } from "./sessions";
import { syncSessions } from "./sync";

export function useSyncedSessions(initialized: boolean) {
  return usePromise(
    async () => {
      try {
        await syncSessions();
      } catch {
        await showToast({ style: Toast.Style.Failure, title: "Could not refresh Focus sessions" });
      }
      return getSessions();
    },
    [],
    { execute: initialized },
  );
}
