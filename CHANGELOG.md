# Raycast Focus Stats Changelog

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
