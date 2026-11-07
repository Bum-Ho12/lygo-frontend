# 06 — Design System & Theming

- Base: shadcn/ui components in `src/components/ui`, restyled with Lygo tokens.
- Tokens as CSS variables in `src/styles/tokens.css` (colour, radius, spacing, type scale),
  light and dark themes.
- **Firm theming**: firm branding sets `--brand`, `--brand-foreground` and logo for the
  Client Portal and firm pages; contrast is checked on save in the Control Center (WCAG AA).
- **Severity colours** are fixed (not themeable) so flags mean the same everywhere, and are
  always paired with an icon and label, never colour alone:
  `info` (blue), `caution` (amber), `warning` (orange), `critical` (red).
- Typography: readable body size (16px min) for the portal; dense table layouts allowed in the workspace.
- Patterns to build once in `src/components`: `DataTable`, `EmptyState`, `ProcessingTimeline`,
  `FlagBadge`, `FlagPanel`, `CitationChip`, `SourceDrawer`, `ChatThread`, `UploadDropzone`,
  `TenantSwitcher`, `StorageDestinationCard`, `ConsentDialog`.
