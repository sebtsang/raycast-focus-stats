import { Toast, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { getSessionsByDate } from "./sessions";
import { syncSessions } from "./sync";

export function useSyncedSessions(date: Date, initialized: boolean) {
  return usePromise(
    async (selectedDate: Date) => {
      try {
        await syncSessions();
      } catch {
        await showToast({ style: Toast.Style.Failure, title: "Could not refresh Focus sessions" });
      }
      return getSessionsByDate(selectedDate);
    },
    [date],
    { execute: initialized },
  );
}
