# Mobile Responsive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the AJ app fully usable on mobile devices (< 768px) and fix fiscal year filtering bug.

**Architecture:** CSS-first approach using Tailwind `md:` breakpoint. Sidebar becomes a hamburger overlay on mobile. Tables become card views. DocumentPanel stacks vertically. One new component (MobileHeader). Bugfix adds fiscal_year_id filter to documents API.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Framer Motion

---

### Task 1: Bugfix — Fiscal Year Filtering in Documents API

**Files:**
- Modify: `src/app/api/documents/route.ts`

**Step 1: Add fiscal year lookup to the documents GET handler**

In `src/app/api/documents/route.ts`, after `const searchParams = ...` (line 11), add the fiscal year lookup and filter:

```typescript
// After line 9: const supabase = createServiceClient()
// Add fiscal year lookup:
const { data: fiscalYear } = await supabase
  .from('fiscal_years')
  .select('id')
  .eq('is_active', true)
  .single()

if (!fiscalYear) {
  return apiError('No active fiscal year', 400)
}
```

Then after the base query is created (after line 28 `.order(...)`), add:

```typescript
query = query.eq('fiscal_year_id', fiscalYear.id)
```

**Step 2: Verify fix works**

Run: `npm run dev` and switch fiscal years — only documents for that year should show.

**Step 3: Commit**

```bash
git add src/app/api/documents/route.ts
git commit -m "fix: filter documents by active fiscal year"
```

---

### Task 2: Responsive App Layout

**Files:**
- Modify: `src/app/(app)/layout.tsx`

**Step 1: Make main content responsive**

Change line 21 from:
```tsx
<main className="flex-1 ml-64 p-8">
```
to:
```tsx
<main className="flex-1 md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
```

The `pt-16` makes room for the mobile header on small screens.

**Step 2: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "feat: make app layout responsive with mobile padding"
```

---

### Task 3: Mobile Sidebar with Hamburger Menu

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Step 1: Convert Sidebar to support mobile overlay**

Replace the entire `Sidebar.tsx` with a version that:
- On desktop (`md:` and up): renders the same fixed sidebar as today
- On mobile: renders a top header bar with AJ logo + hamburger icon
- Hamburger toggles a slide-in overlay sidebar with dark backdrop
- Clicking a nav item or the backdrop closes the menu
- Uses framer-motion for slide animation
- Auto-closes on route change via `usePathname`

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { logout } from '@/app/login/actions'
import FiscalYearSelector from '@/components/FiscalYearSelector'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/kundfakturor', label: 'Kundfakturor', icon: '💰' },
  { href: '/leverantorsfakturor', label: 'Leverantörsfakturor', icon: '📦' },
  { href: '/ovriga-dokument', label: 'Övriga dokument', icon: '📋' },
  { href: '/bankavstamning', label: 'Bankavstämning', icon: '🏦' },
  { href: '/kunder', label: 'Kunder', icon: '👥' },
  { href: '/leverantorer', label: 'Leverantörer', icon: '🏢' },
  { href: '/kategorier', label: 'Kategorier', icon: '🏷️' },
  { href: '/installningar', label: 'Inställningar', icon: '⚙️' },
]

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname()

  return (
    <>
      <div className="p-6">
        <img src="/icon.svg" alt="AJ" className="w-10 h-10" />
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 bg-gray-800/50 rounded-lg"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{item.icon}</span>
              <span className="relative z-10">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-2">
        <label className="block text-xs text-gray-500 mb-1 px-1">Räkenskapsår</label>
        <FiscalYearSelector />
      </div>

      <div className="p-3 border-t border-gray-800">
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-900 transition-colors"
          >
            <span>👋</span>
            <span>Logga ut</span>
          </button>
        </form>
      </div>
    </>
  )
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 h-screen bg-gray-950 border-r border-gray-800 flex-col fixed left-0 top-0">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-4 h-14">
        <img src="/icon.svg" alt="AJ" className="w-8 h-8" />
        <button
          onClick={() => setMobileOpen(true)}
          className="text-gray-400 hover:text-white p-2"
          aria-label="Öppna meny"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/60 z-50"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-64 bg-gray-950 border-r border-gray-800 z-50 flex flex-col"
            >
              <SidebarContent onNavClick={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
```

**Step 2: Test on mobile**

Open dev tools, toggle device toolbar (375px width). Verify:
- Sidebar is hidden, top bar with hamburger shows
- Tapping hamburger slides in sidebar from left
- Tapping nav item closes sidebar and navigates
- Tapping backdrop closes sidebar

**Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add mobile hamburger menu with slide-in sidebar"
```

---

### Task 4: Dashboard Responsive Layout

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Step 1: Stack dashboard header on mobile**

Change the header div (line 193-196) from:
```tsx
<div className="flex items-center justify-between mb-8">
  <h1 className="text-2xl font-bold text-white">Dashboard</h1>
  <GlobalSearch />
</div>
```
to:
```tsx
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
  <h1 className="text-2xl font-bold text-white">Dashboard</h1>
  <GlobalSearch />
</div>
```

**Step 2: Commit**

```bash
git add src/app/(app)/page.tsx
git commit -m "feat: stack dashboard header on mobile"
```

---

### Task 5: Document List Card View for Mobile

**Files:**
- Modify: `src/components/DocumentList.tsx`

**Step 1: Add a useMediaQuery hook and card view**

Add a mobile card view that renders below `md` breakpoint. Keep the table for desktop.

After the existing imports, add a hook to detect mobile:

```tsx
import { useState, useMemo, useEffect } from 'react'
```

Add inside the component, before the return:

```tsx
const [isMobile, setIsMobile] = useState(false)

useEffect(() => {
  const mq = window.matchMedia('(max-width: 767px)')
  setIsMobile(mq.matches)
  const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}, [])
```

Then in the return, wrap the table in a conditional:

```tsx
return (
  <>
    {isMobile ? (
      <div className="space-y-3">
        {sorted.map((doc, i) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            onClick={() => setSelectedDoc(doc)}
            className="p-4 bg-gray-900 border border-gray-800 rounded-xl active:bg-gray-800 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between mb-1">
              <span className="text-white text-sm font-medium truncate mr-2">
                {doc.customer_name || doc.supplier_name || '-'}
              </span>
              <span className="text-white text-sm font-mono whitespace-nowrap">
                {formatAmount(doc.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{formatDate(doc.invoice_date)}</span>
                <span>{TYPE_LABELS[doc.type] || doc.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doc.status]}`}>
                  {STATUS_LABELS[doc.status]}
                </span>
                {doc.ai_needs_review && (
                  <span className="text-yellow-400 text-xs">⚠️</span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {documents.length === 0 && (
          <p className="text-center text-gray-500 py-8">Inga dokument ännu</p>
        )}
      </div>
    ) : (
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {/* existing table code unchanged */}
      </div>
    )}

    <AnimatePresence>
      {selectedDoc && (
        <DocumentPanel ... />
      )}
    </AnimatePresence>
  </>
)
```

**Step 2: Test**

Toggle device toolbar at 375px. Cards should show with name, amount, date, status. Tap opens DocumentPanel.

**Step 3: Commit**

```bash
git add src/components/DocumentList.tsx
git commit -m "feat: add mobile card view for document list"
```

---

### Task 6: DocumentPanel Mobile Layout

**Files:**
- Modify: `src/components/DocumentPanel.tsx`

**Step 1: Make DocumentPanel responsive**

Change the panel container (line 130) from:
```tsx
className="absolute inset-4 top-8 bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden flex flex-col"
```
to:
```tsx
className="absolute inset-0 md:inset-4 md:top-8 bg-gray-950 md:border md:border-gray-800 md:rounded-2xl overflow-hidden flex flex-col"
```

Change the body split (line 139) from:
```tsx
<div className="flex flex-1 min-h-0">
```
to:
```tsx
<div className="flex flex-col md:flex-row flex-1 min-h-0">
```

Change the PDF viewer (line 141) from:
```tsx
<div className="w-1/2 border-r border-gray-800 bg-gray-900">
```
to a conditional on mobile — show a "Visa PDF" button instead:

```tsx
{/* PDF viewer - hidden on mobile, shown on desktop */}
<div className="hidden md:block w-1/2 border-r border-gray-800 bg-gray-900">
  {/* existing PDF iframe code */}
</div>
```

Change the form container (line 156) from:
```tsx
<div className="w-1/2 overflow-y-auto p-6">
```
to:
```tsx
<div className="flex-1 md:w-1/2 overflow-y-auto p-4 md:p-6">
```

Add a "Visa PDF" button at the top of the form (mobile only), before the AI review warning:

```tsx
{/* Mobile PDF button */}
{pdfUrl && pdfUrl !== 'error' && (
  <a
    href={pdfUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="md:hidden mb-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm hover:bg-gray-700 transition-colors"
  >
    📄 Visa PDF
  </a>
)}
```

Change the form grid (line 173) from:
```tsx
<div className="grid grid-cols-2 gap-4 mb-6">
```
to:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
```

Change action buttons (line 244) to wrap on mobile:
```tsx
<div className="flex flex-wrap gap-3">
```

**Step 2: Test**

On mobile width: panel should be fullscreen, no PDF split, "Visa PDF" button at top, form fields stacked vertically.

**Step 3: Commit**

```bash
git add src/components/DocumentPanel.tsx
git commit -m "feat: mobile-friendly DocumentPanel with stacked layout"
```

---

### Task 7: Document Page Headers (Responsive Buttons)

**Files:**
- Modify: `src/app/(app)/kundfakturor/page.tsx`
- Modify: `src/app/(app)/leverantorsfakturor/page.tsx`
- Modify: `src/app/(app)/ovriga-dokument/page.tsx`

**Step 1: Make header buttons wrap on mobile**

In all three files, change the header pattern from:
```tsx
<div className="flex items-center justify-between mb-8">
  <h1 className="text-2xl font-bold text-white">...</h1>
  <div className="flex items-center gap-2">
    ...buttons...
  </div>
</div>
```
to:
```tsx
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
  <h1 className="text-2xl font-bold text-white">...</h1>
  <div className="flex flex-wrap items-center gap-2">
    ...buttons...
  </div>
</div>
```

**Step 2: Commit**

```bash
git add src/app/(app)/kundfakturor/page.tsx src/app/(app)/leverantorsfakturor/page.tsx src/app/(app)/ovriga-dokument/page.tsx
git commit -m "feat: wrap page header buttons on mobile"
```

---

### Task 8: Bank Reconciliation Mobile Cards

**Files:**
- Modify: `src/app/(app)/bankavstamning/page.tsx`

**Step 1: Add mobile card view for bank transactions**

Same pattern as Task 5. Add `isMobile` state with matchMedia hook. Render cards on mobile instead of table.

Mobile card for each transaction shows:
- Date + transaction type
- Reference (truncated)
- Amount (colored green/white)
- Match status (green filename or red "Inget kvitto")
- Matcha/Avlanka button

Also make the header responsive:
```tsx
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
```

**Step 2: Commit**

```bash
git add src/app/(app)/bankavstamning/page.tsx
git commit -m "feat: mobile card view for bank transactions"
```

---

### Task 9: Kunder & Leverantorer Mobile Cards

**Files:**
- Modify: `src/app/(app)/kunder/page.tsx`
- Modify: `src/app/(app)/leverantorer/page.tsx`

**Step 1: Add mobile card view**

Same matchMedia pattern. On mobile, render each entity as a card:

```tsx
<div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
  <div className="flex items-center justify-between">
    <span className="text-white font-medium">{entity.name}</span>
    <div className="flex gap-3">
      <button className="text-xs text-gray-400">Redigera</button>
      <button className="text-xs text-red-400">Ta bort</button>
    </div>
  </div>
  <div className="text-gray-400 text-xs mt-1">
    {entity.org_number || ''} {entity.email || ''}
  </div>
</div>
```

Also make headers responsive with `flex-col md:flex-row`.

**Step 2: Commit**

```bash
git add src/app/(app)/kunder/page.tsx src/app/(app)/leverantorer/page.tsx
git commit -m "feat: mobile card view for customers and suppliers"
```

---

### Task 10: FileUpload Mobile Padding

**Files:**
- Modify: `src/components/FileUpload.tsx`

**Step 1: Reduce padding on mobile**

Change the drop zone padding (line 106) from:
```tsx
className={`border-2 border-dashed rounded-xl p-12 text-center ...`}
```
to:
```tsx
className={`border-2 border-dashed rounded-xl p-6 md:p-12 text-center ...`}
```

**Step 2: Commit**

```bash
git add src/components/FileUpload.tsx
git commit -m "feat: reduce file upload padding on mobile"
```

---

### Task 11: Final Testing & Polish

**Step 1: Full mobile walkthrough**

Test each page at 375px width in dev tools:
- [ ] Dashboard: header stacked, summary boxes 2-col, chart visible, alerts stacked
- [ ] Kundfakturor: header wraps, card view, upload works, DocumentPanel stacked
- [ ] Leverantorsfakturor: same as above
- [ ] Ovriga dokument: same as above
- [ ] Bankavstamning: card view, import button, matching modal
- [ ] Kunder: card view, add/edit form, linked documents
- [ ] Leverantorer: card view, category picker
- [ ] Kategorier: already grid-cols-1 on mobile ✓
- [ ] Installningar: verify form inputs render correctly
- [ ] Fiscal year: switch year, verify correct data shows

**Step 2: Fix any issues found during testing**

**Step 3: Final commit**

```bash
git commit -m "fix: mobile responsive polish"
```
