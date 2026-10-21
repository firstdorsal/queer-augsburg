# Queer Augsburg Web

## Quiz Feature

Jeopardy-style quiz board for events. Code-split and only loaded when accessed.

- `/quiz/control` - Host view for managing questions and awarding points
- `/quiz/board` - Display view for audience (open in separate window/projector)

State syncs across tabs via localStorage. Export/import game data as JSON.

## Mehrere Treffen anlegen (Bulk-Import)

For members with the `UpdateMeetings` capability, the meeting list shows **"Mehrere Treffen (JSON)"** next to "Neues Treffen". Instead of filling the form once per meeting, the member

1. copies a generated prompt (today's date, known places, allowed tags, limits) into an AI model of their choice and describes the meetings there; the prompt tells the model to ask back for missing date, time or place,
2. pastes the model's answer (a JSON array; code fences and chat text around it are tolerated),
3. reviews the drafts: unknown places are picked from the known places or set on the map, errors block, hints (past dates, ignored fields, duplicates) do not,
4. creates all meetings in one request (`POST /api/create_meetings/`, at most 50). The server validates every meeting first and creates nothing if one is invalid.

Code: `src/bulkImport.ts` (format, parsing, validation, prompt), `src/components/BulkImportMeetings.tsx` (UI), server side `server/src/meeting_validation.rs` and `server/src/methods/create_meetings.rs`. Client and server validation are mirrored and both tested against `server/src/meeting_validation_cases.json`; change rules on both sides and in that file together.

The "Prompt kopieren" button needs `clipboard-write=(self)` in the `permissions-policy` header (`server/config.yml`); without clipboard access the prompt is shown for manual copying.

## Tests

```sh
pnpm test        # type-checks src incl. tests (tsconfig.test.json), then runs vitest
cd ../server && cargo test   # server tests; also regenerates src/apiTypes via ts-rs
```

`pnpm test` and `pnpm build` both run `fix-react-markdown-types`, which deletes `react-markdown/lib/complex-types.ts`: react-markdown 8 ships that TypeScript source file, and it does not compile against the Preact JSX types. Test files are excluded from `pnpm build` because they import the shared fixture from `server/`, which is outside the web Docker build context. CI runs both test suites (`test-web`, `test-server`) before building images.
