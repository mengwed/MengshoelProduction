# Mobile Responsive Design

**Date:** 2026-03-06
**Goal:** Make the AJ app fully usable on mobile devices (< 768px)
**Approach:** CSS-first with Tailwind responsive classes, minimal new components

## Context

The app currently uses a fixed 264px sidebar that renders on top of content on mobile,
making the app completely unusable. All layouts assume desktop width.

## Breakpoint Strategy

Single breakpoint: `md:` (768px). Below = mobile, above = desktop (unchanged).

## 1. Layout & Navigation

### Sidebar (mobile)
- Hide sidebar on mobile: `hidden md:flex`
- Add a **MobileHeader** component: AJ logo (left), page title (center), hamburger icon (right)
- Hamburger opens sidebar as a slide-in overlay from the left with dark backdrop
- Tap outside or tap a nav item = close
- FiscalYearSelector remains in the mobile menu
- Animate with framer-motion (slide + fade backdrop)

### App Layout
- Remove fixed margin on mobile: `ml-64` -> `md:ml-64`
- Reduce padding: `p-8` -> `p-4 md:p-8`
- MobileHeader only renders below md breakpoint

## 2. Dashboard (mobile)

- **Header:** Stack title and GlobalSearch vertically instead of side-by-side
- **SummaryBoxes:** Already responsive (`grid-cols-2`), works as-is
- **MonthlyChart:** Works with flex, no changes needed
- **Alert cards:** Already `grid-cols-1` on small screens

## 3. Document List Pages (mobile)

### Header buttons
- Wrap action buttons on mobile: `flex-wrap gap-2`
- Stack search input full-width below buttons

### DocumentList -> Card View
- Below md: render each document as a compact card instead of table row
- Card shows: date, customer/supplier name, amount, status badge, AI indicator
- Tap card = open DocumentPanel
- Keep table view above md (unchanged)

### SummaryBoxes
- Already handles `grid-cols-2` on small screens

## 4. DocumentPanel (mobile)

- **Full screen** instead of `inset-4 top-8`
- **No PDF/form split** — form takes full width
- **"Visa PDF" button** opens PDF in new browser tab
- Form grid: `grid-cols-1` instead of `grid-cols-2` on mobile
- Action buttons stack or wrap

## 5. Other Pages

- **Bankavstamning:** Same card approach for transaction list
- **Kunder/Leverantorer/Kategorier:** Simple lists, minimal changes needed
- **FileUpload:** Reduce padding `p-12` -> `p-6 md:p-12`, file picker works on mobile
- **Installningar:** Form inputs already full-width, should work

## 6. Bugfix: Fiscal Year Filtering

The `/api/documents` GET endpoint does NOT filter by `fiscal_year_id`.
This means all documents from all years are shown regardless of selected fiscal year.

**Fix:** Add `fiscal_year_id` filter to the documents query, matching how
`/api/dashboard` already does it. Also verify `/api/bank/transactions`.

## Components to Modify

1. `src/app/(app)/layout.tsx` — responsive main layout
2. `src/components/Sidebar.tsx` — add mobile menu state + overlay
3. `src/components/DocumentList.tsx` — add card view for mobile
4. `src/components/DocumentPanel.tsx` — stack layout on mobile
5. `src/app/(app)/page.tsx` — dashboard responsive tweaks
6. `src/app/(app)/kundfakturor/page.tsx` — header button wrapping
7. `src/app/(app)/leverantorsfakturor/page.tsx` — same
8. `src/app/(app)/ovriga-dokument/page.tsx` — same
9. `src/components/FileUpload.tsx` — padding adjustment
10. `src/app/api/documents/route.ts` — fiscal year filter bugfix

## New Components

1. `src/components/MobileHeader.tsx` — top bar with hamburger menu

## Out of Scope

- Tablet-specific layout (surfplatta)
- PWA / offline support
- Camera integration for document scanning
