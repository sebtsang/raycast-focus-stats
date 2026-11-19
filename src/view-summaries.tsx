import type { Session } from "./types";
import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useSyncedSessions } from "./use-synced-sessions";
import { formatTime } from "./utils";
import { JSX, useState } from "react";
import { DateDropdown } from "./components/date-dropdown";
import { durationString, sessionString } from "./utils";
import { InitWrapper } from "./components/init/init-wrapper";

export default function Command() {
  const [date, setDate] = useState<Date>(new Date());
  // When date changes, update the date on the component's state, causing a
  // re-render and the recalculation of the `sessions` and `entries` variable.
  const onDateChange = (date: Date) => setDate(date);

  return (
    <InitWrapper
      children={(initialized) => {
        const { isLoading, data: sessions = [], revalidate } = useSyncedSessions(date, initialized);
        const summary = new Map<string, Session[]>();
        for (const session of sessions) {
          const group = summary.get(session.goal) ?? [];
          group.push(session);
          summary.set(session.goal, group);
        }
        const entries = [...summary.entries()].sort(([a], [b]) => a.localeCompare(b));

        return (
          <List
            isLoading={!initialized || isLoading}
            isShowingDetail
            actions={
              <ActionPanel>
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  onAction={async () => {
                    await revalidate();
                  }}
                />
              </ActionPanel>
            }
            searchBarAccessory={<DateDropdown onDateChange={onDateChange} />}
          >
            <List.EmptyView title="No Focus sessions" />
            {sessions.length > 0 && <SummaryListItem title={"Summary"} sessions={sessions} displayGoal={true} />}

            <List.Section title="Breakdown">
              {entries.map(([goal, sessions]) => (
                <SummaryListItem key={goal} title={goal} sessions={sessions} />
              ))}
            </List.Section>
          </List>
        );
      }}
    />
  );
}

/**
 * Props for the SessionSummaryListItem component.
 *
 * @property {string} title - The title to display for the session summary item.
 * @property {Session[]} sessions - An array of Session objects to summarize.
 * @property {boolean} [displayGoal=false] - Whether to display the session's goal for
 * session in the "Session Breakdown" section. Defaults to false.
 */
type SummaryListItemProps = {
  title: string;
  sessions: Session[];
  displayGoal?: boolean;
};

/**
 * Renders a summary list item for a group of sessions.
 *
 * Displays the total duration of all sessions, the number of sessions, and a
 * breakdown of each session.
 * Optionally displays the goal for each session if `displayGoal` is true.
 *
 * @param {SummaryListItemProps} props - The props for the component.
 * @returns {JSX.Element} The rendered list item component.
 */
function SummaryListItem(props: SummaryListItemProps): JSX.Element {
  const { title, sessions, displayGoal = false } = props;
  const totalDuration = sessions.reduce((acc, session) => acc + (session.duration ?? 0), 0);

  const tagListTitle = (session: Session) => {
    return displayGoal ? `${session.goal}  ${formatTime(session.start)}` : formatTime(session.start);
  };

  return (
    <List.Item
      key={title}
      title={title}
      accessories={[{ tag: sessions.length.toString(), tooltip: `${sessionString(sessions.length)}` }]}
      detail={
        <List.Item.Detail
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label title="Total" text={durationString(totalDuration)} />

              <List.Item.Detail.Metadata.Label title="" />

              <List.Item.Detail.Metadata.Label title="Session Breakdown" />
              <List.Item.Detail.Metadata.Separator />
              {sessions.map((session) => (
                <List.Item.Detail.Metadata.TagList key={session.start.toISOString()} title={tagListTitle(session)}>
                  <List.Item.Detail.Metadata.TagList.Item
                    text={durationString(session.duration || 0)}
                    key={`taglistitemduration-${session.goal}`}
                    color={Color.Green}
                  />
                </List.Item.Detail.Metadata.TagList>
              ))}
            </List.Item.Detail.Metadata>
          }
        />
      }
    />
  );
}
