import type { Session } from "./types";
import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useSyncedSessions } from "./use-synced-sessions";
import { JSX, useState } from "react";
import { DateDropdown } from "./components/date-dropdown";
import { displayDate, durationString, formatTime, sessionString, totalDuration } from "./utils";
import { InitWrapper } from "./components/init/init-wrapper";

export default function Command() {
  const [date, setDate] = useState<Date | null>(null);
  return (
    <InitWrapper
      children={(initialized) => {
        const { isLoading, data: sessions = [], revalidate } = useSyncedSessions(initialized);

        return (
          <List
            isLoading={!initialized || isLoading}
            isShowingDetail={date !== null}
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
            searchBarAccessory={<DateDropdown onDateChange={setDate} />}
          >
            <List.EmptyView title="No Focus sessions" />
            {date === null ? <AllDates sessions={sessions} /> : <SingleDate date={date} sessions={sessions} />}
          </List>
        );
      }}
    />
  );
}

/** Groups items by key, keeping the order in which keys and items first appear. */
function groupBy<Item>(items: Item[], keyOf: (item: Item) => string): [string, Item[]][] {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const group = groups.get(keyOf(item)) ?? [];
    group.push(item);
    groups.set(keyOf(item), group);
  }
  return [...groups.entries()];
}

/** Lists every session, newest first, under a heading for each date. */
function AllDates({ sessions }: { sessions: Session[] }): JSX.Element {
  return (
    <>
      {groupBy(sessions, (session) => displayDate(session.start)).map(([date, sessions]) => (
        <List.Section
          key={date}
          title={date}
          subtitle={`${durationString(totalDuration(sessions))}, ${sessionString(sessions.length)}`}
        >
          {sessions.map((session) => (
            <List.Item
              key={session.id}
              title={session.goal}
              accessories={[
                { tag: { value: durationString(session.duration), color: Color.Green } },
                { text: formatTime(session.start) },
              ]}
            />
          ))}
        </List.Section>
      ))}
    </>
  );
}

/** Summarizes one date's sessions, with a breakdown by goal. */
function SingleDate({ date, sessions: allSessions }: { date: Date; sessions: Session[] }): JSX.Element {
  const sessions = allSessions.filter((session) => session.start.toDateString() === date.toDateString()).reverse();
  const entries = groupBy(sessions, (session) => session.goal).sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      {sessions.length > 0 && <SummaryListItem title={"Summary"} sessions={sessions} displayGoal={true} />}

      <List.Section title="Breakdown">
        {entries.map(([goal, sessions]) => (
          <SummaryListItem key={goal} title={goal} sessions={sessions} />
        ))}
      </List.Section>
    </>
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
              <List.Item.Detail.Metadata.Label title="Total" text={durationString(totalDuration(sessions))} />

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
