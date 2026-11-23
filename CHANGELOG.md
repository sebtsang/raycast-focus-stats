# Raycast Focus Stats Changelog

## [Fork: correct dates, background sync and all dates] - 2026-11-23

- Fix sessions saved under an earlier date after Raycast trims a log that stays open for days.
- Save Raycast's ID for each session so it can't be saved twice.
- Add Sync Focus Sessions, which can save sessions in the background every 10 minutes.
- Add All dates to the date dropdown, which lists every session under its date, and open on it by default.

## [Fork: sync from Raycast app logs] - 2026-11-19

- Read completed Focus sessions from Raycast's app logs, which current Raycast versions write instead of system logs.
- Fall back to the original system log reader when no Raycast app log is found.
- Replace Sync Sessions, View Sessions, and View Summaries with one View Focus Stats command that syncs when opened.
- Add a Refresh action to sync again while the view is open.

## [Node 22 and Node 26 compatibility] - {PR_MERGE_DATE}

- Use Node’s built-in SQLite to preserve session history without downloading native addons.

## [Initial Version] - 2025-08-06

- Add `Sync Sessions` command
- Add `View Sessions` command
- Add `View Summaries` command
