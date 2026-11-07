# 10 — Accessibility & Internationalisation

## Accessibility (WCAG 2.2 AA)
- Keyboard access for all features incl. document viewer and flag navigation.
- Severity never by colour alone (icon + label).
- Screen-reader labels for citation chips and flags; live regions for streaming chat.
- axe checks in unit and e2e tests; manual screen-reader pass per release.

## Internationalisation
- `next-intl`, messages in `src/messages/en.json` and `src/messages/sw.json`.
- Phase 1 English; Phase 2 Kiswahili for the Client Portal, assistant and SMS templates.
- Dates/times in `Africa/Nairobi`, formats `en-KE` / `sw-KE`; currency KES.
- Legal terms glossary (`src/messages/glossary.*.json`) so translations stay consistent.
