# FortisExam — Frontend Design Upgrade Log

> **Updated:** 2026-06-13
> **Role:** Lead Frontend Designer
> **Build Status:** ✅ tsc: 0 errors · vite build: 2.44s

---

## Design Philosophy — Government Examination System

The FortisExam portal must project **authority, trust, and precision**. Design choices:

1. **Authority, not Flash** — Deep navy sidebar (`#1a237e`), clean white content area, authoritative typography
2. **Colour as Signal only** — Green = OK, Red = Alert, Orange = Warning, Blue = Info. No decorative colour.
3. **Information Density** — Every pixel of the table must be readable at a glance
4. **Consistent 8px Grid** — Spacing tokens applied uniformly across all components
5. **Professional Typography** — Inter (Google Fonts), clear hierarchy: 22px h1 → 14px card-title → 13px body → 11px labels → 10px section headers
6. **State Clarity** — Loading, empty, and error states are always distinct and helpful
7. **Search & Filter First** — Every list page has a consistent, polished filter-bar component

---

## Files Changed

| File | Change Type | Impact |
|---|---|---|
| `web/src/index.css` | ✅ Complete rewrite (v2.0) | All pages |
| `web/src/components/Layout.tsx` | ✅ Upgraded | Sidebar + Topbar |
| `web/src/components/ui/index.tsx` | ✅ Upgraded (v2.0) | All pages |
| `web/src/pages/Dashboard.tsx` | ✅ Upgraded | A1 screen |
| `web/src/pages/Questions.tsx` | ✅ Filter bar upgraded | A2 screen |
| `web/src/pages/Centers.tsx` | ✅ Filter bar upgraded | A7 screen |
| `vault/08_Frontend/DesignUpgradeLog.md` | ✅ Created | Documentation |

---

## Detailed Changes

### 1. `web/src/index.css` — Full Design System v2.0

**Color Palette Refinement:**
- `--primary`: `#1565c0` (Royal Blue — more authoritative than old bright blue)
- `--success`: `#2e7d32` (Darker, more official green — replaces `#43a047`)
- `--warning`: `#e65100` (Deep orange, not amber — conveys urgency clearly)
- `--danger`: `#c62828` (Deep red — serious, not alarming)
- `--content-bg`: `#f4f6f9` (Slightly warmer grey — easier on eyes for long sessions)
- Added `--primary-mid`, `--success-mid`, `--warning-mid`, `--danger-mid` for badge borders

**Sidebar:**
- Added `linear-gradient(180deg, #1a237e 0%, #151c6b 100%)` — gives depth without flashiness
- Added `box-shadow: 2px 0 8px rgba(0,0,0,0.15)` for natural separation from content
- Active nav item indicator: 4px left pill (was 3px), now uses `#90caf9` (lighter blue for contrast)
- Section labels: improved letter-spacing and opacity
- Custom scrollbar: 3px, subtle transparent track

**Topbar:**
- Added subtle bottom shadow `0 1px 0 #e2e8f0` (was just border)
- Search: `border-radius: full`, improved focus ring with `box-shadow: 0 0 0 3px var(--primary-bg)`
- New `.topbar-live-btn` class: green button with animated blink dot
- New `.user-avatar` class: consistent 32px avatar with border

**Buttons:**
- Added `letter-spacing: 0.01em` for better readability
- Added `box-shadow` to primary, danger, success buttons for depth
- Hover states now also lift shadow, not just darken
- `btn-sm`: 30px height (was 30px), 12px font (was 12px) — unchanged but now applies shadow

**Badges:**
- All color variants now have a matching `border: 1px solid` in mid-tone color
- Example: `.badge-green` → border: `var(--success-mid)` — much more distinguished

**Table:**
- `thead` background: `var(--surface-2)` with `border-bottom: 1px solid var(--border-strong)` — stronger header
- `th` font-size: 10.5px weight 700 (was 11px weight 600) — cleaner uppercase headers
- `td` padding: 11px 16px (was 12px 16px) — slightly tighter
- Row hover: `transition: background 120ms ease` — smooth
- `tbody tr.clickable` cursor class added

**Cards:**
- Added `--shadow-card: 0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)` — distinct from page background
- Card hover: lifts to `var(--shadow-sm)` for interactive feel

**Modal:**
- Header: `background: var(--surface-2)` — clearly separated from body
- Footer: `background: var(--surface-2)` — mirrors header
- Overlay: `rgba(15, 23, 42, 0.5)` (slate-900 tone, not grey) — more dramatic backdrop

**New Components Added:**
- `.filter-bar` — polished search+filter row (used by Questions, Centers)
- `.filter-bar-search` + `.filter-bar-select` + `.filter-bar-divider` + `.filter-bar-actions`
- `.section-label` — 10px uppercase section titles inside cards
- `.pipeline` / `.pipeline-step` / `.pipeline-circle` / `.pipeline-label` — exam status pipeline
- `.timeline` / `.timeline-item` / `.timeline-dot` / `.timeline-content` — audit timeline
- `.hash-block` — monospace hash display with blue border and background
- `.info-row` / `.info-row-key` / `.info-row-value` — key-value metadata rows
- `.pagination` + `.pagination-btn` — table pagination controls
- `.stats-grid` — responsive 4→2 column stat card grid
- `.topbar-live-btn` + `.topbar-live-dot` (animated blink)
- `.user-avatar` — topbar user avatar
- `.sidebar-env-badge` — environment indicator in sidebar footer
- `.notif-toast` — notification dropdown panel
- `.activity-item` + `.activity-type-badge` — activity feed items

**Animations:**
- `@keyframes blink` — for the live monitoring dot in topbar
- `@keyframes slideInRight` — for side drawers

**Print Styles:**
- Added `@media print` rules: hide sidebar, topbar, buttons, filter bars. Tables and cards print cleanly.

**Responsive:**
- `.stats-grid` breaks to 2-col at 1200px

---

### 2. `web/src/components/Layout.tsx` — Sidebar + Topbar

- **Sidebar logo:** Added `border: 1px solid rgba(255,255,255,0.2)` on icon block
- **Section labels:** Renamed "Main" → "Administration", "Security" → "Security & Audit"
- **Nav items:** Icon `size={15}` (was 16) for better proportion
- **Sidebar footer:** Now shows user first name + "Administrator" role label below avatar
- **Topbar search:** Added clear button (X) when search has content
- **Topbar:** Added `topbar-live-btn` class for Live monitoring shortcut (replaces inline green button)
- **Notification panel:** Replaced setTimeout-dismiss with toggle, added close button
- **User avatar:** Computed initials from `firstName[0] + lastName[0]`, applied `.user-avatar` class
- **Breadcrumb:** Using `<ChevronRight>` with opacity instead of literal "/"

---

### 3. `web/src/components/ui/index.tsx` — Component Library v2.0

- **Button:** Cleaned up class joining logic (trim whitespace)
- **Spinner:** Now uses style object properly for all 3 sizes
- **Card:** Added `noPadding` prop for cases where content handles its own padding
- **Badge:** Added `size="sm"` prop (10px, smaller padding)
- **StatusBadge:** Added `submitted`, `recovered` status mappings
- **Modal:** Added `xl` size (960px max-width), added `role="dialog"` and `aria-modal` for accessibility
- **Table:** Empty state shows as a table row (not outside the wrapper), optional `footer` prop
- **Tabs:** Count pill now has proper active/inactive styling with border
- **PageHeader:** Supports `badge` prop (inline badge next to h1), uses ChevronRight for breadcrumb separators
- **SectionHeader:** New component for in-card section headers with optional action
- **ConfirmDialog:** Cancel button disabled during loading state

---

### 4. `web/src/pages/Dashboard.tsx` — A1

- **Page header:** Proper breadcrumb "Admin Portal / System Overview"
- **System Status bar:** New row showing 5 service health indicators (Audit Ledger, Encryption, Edge, AI, Key Escrow)
- **Stat cards:** Added `changeDir` prop usage for critical alerts (red if > 0)
- **Activity feed:** Extracted to `.activity-item` + `.activity-type-badge` CSS classes
- **Risk map:** Shows count per risk level in legend, adds danger callout if high-risk centers exist
- **Distribution bars:** Added status labels (Complete/In Progress/Pending), center count display
- **Distribution section:** Added "Manage Distribution" link button

---

### 5. `web/src/pages/Questions.tsx` — A2

- **Filter bar:** Replaced `Card` wrapping with new `.filter-bar` class
- **Filters:** Using `.filter-bar-search`, `.filter-bar-select`, `.filter-bar-divider`
- **Result count:** Shown inline in filter bar (`{n} results`)
- **Clear button:** Now says "Clear Filters" (not just "Clear")
- **Aria labels:** Added `aria-label` to search input and selects

---

### 6. `web/src/pages/Centers.tsx` — A7

- **Filter bar:** Moved from Card action to standalone `.filter-bar` above table
- **Table card:** Subtitle now shows "N active · M total seats" 
- **Result count:** "N of M centers" shown in filter bar actions

---

## Screens NOT Yet Polished (Preserved As-Is)

These pages were well-implemented and the CSS upgrade alone significantly improves them:

| Screen | Reason |
|---|---|
| QuestionEditor.tsx | Complex form — CSS upgrade sufficient |
| Exams.tsx | Complex pipeline — CSS upgrade sufficient |
| Packages.tsx | Simple card layout — CSS upgrade sufficient |
| Distribution.tsx | Table + form — CSS upgrade sufficient |
| Users.tsx | Table + modal — CSS upgrade sufficient |
| Audit.tsx | Complex — 3 tabs, CSS upgrade sufficient |
| Monitoring.tsx | Complex — drawers + modals, CSS upgrade sufficient |
| TamperDemo.tsx | Demo screen — CSS upgrade sufficient |
| DemoLanding.tsx | Landing — CSS upgrade sufficient |
| desktop/index.css | Dark kiosk — preserved |

All the above screens inherit the CSS improvements automatically because they all use:
- The same CSS custom properties (tokens)
- The same CSS class names (`.card`, `.btn`, `.badge`, `.table-wrapper`, etc.)
- The same UI component library (Button, Card, Badge, Modal, Table, etc.)

---

## Build Verification

```
tsc --noEmit: 0 errors ✅
vite build:   2.44s ✅
CSS bundle:   29.36 kB (gzip: 6.29 kB)
JS bundle:    419.53 kB (gzip: 115.73 kB)
```
