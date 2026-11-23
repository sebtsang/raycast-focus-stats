import { List } from "@raycast/api";
import { useMemo } from "react";
import { displayDate } from "../utils";

const allDates = "all";

/**
 * Custom List Dropdown Component that allows the user to select all dates, or any date within the past 7 days.
 * Initial value defaults to all dates.
 *
 * Note: The selected date value is not persisted between component renders.
 * The dropdown will always reset to all dates when the component is remounted.
 *
 * @param props.onDateChange - Callback function that is triggered when the selection changes. It receives the
 *                            newly selected Date object, or null for all dates.
 */
export function DateDropdown({ onDateChange }: { onDateChange: (newDate: Date | null) => void }) {
  const dates = useMemo(() => {
    const today = new Date();

    return [
      today,
      new Date(new Date(today).setDate(today.getDate() - 1)),
      new Date(new Date(today).setDate(today.getDate() - 2)),
      new Date(new Date(today).setDate(today.getDate() - 3)),
      new Date(new Date(today).setDate(today.getDate() - 4)),
      new Date(new Date(today).setDate(today.getDate() - 5)),
      new Date(new Date(today).setDate(today.getDate() - 6)),
    ];
  }, []);

  const onChange = (value: string) => onDateChange(value === allDates ? null : new Date(value));

  return (
    <List.Dropdown tooltip="Select Date" defaultValue={allDates} onChange={onChange}>
      <List.Dropdown.Item title="All dates" value={allDates} />
      {dates.map((date) => (
        <List.Dropdown.Item key={date.toISOString()} title={displayDate(date)} value={date.toISOString()} />
      ))}
    </List.Dropdown>
  );
}
