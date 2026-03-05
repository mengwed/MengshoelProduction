# AJ Web App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a modern web app for bookkeeping with AI-powered PDF extraction, replacing the existing Electron desktop app.

**Architecture:** Next.js 15 App Router with server components and API routes. Supabase provides auth, PostgreSQL database, and file storage. Claude Haiku API extracts data from uploaded PDF invoices. Dark-themed UI with TailwindCSS and Framer Motion.

**Tech Stack:** Next.js 15, React 18, TypeScript, TailwindCSS, Framer Motion, Supabase (Auth + DB + Storage), Claude Haiku API, Vitest, Vercel

---

## Phase 1: Project Foundation

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.local.example`

**Step 1: Create Next.js app with TypeScript and TailwindCSS**

Run:
```bash
cd "/Users/ulrikamw/Code/AJ version 2"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

When prompted, accept defaults. This scaffolds the project.

**Step 2: Install dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr framer-motion xlsx
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

**Step 3: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Create `src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest'
```

**Step 4: Create .env.local.example**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**Step 5: Update .gitignore**

Append to `.gitignore`:
```
.env.local
```

**Step 6: Add test script to package.json**

In `package.json` scripts, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 7: Verify setup**

Run:
```bash
npm run build
```
Expected: Build succeeds with no errors.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with TailwindCSS and Vitest"
```

---

### Task 2: Configure Supabase client

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`

**Step 1: Create browser Supabase client**

Create `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 2: Create server Supabase client**

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  )
}
```

**Step 3: Create middleware for auth session refresh**

Create `src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

Create `src/middleware.ts`:
```typescript
import { updateSession } from '@/lib/supabase/middleware'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: configure Supabase client, server client, and auth middleware"
```

---

### Task 3: Set up Supabase database schema

**Files:**
- Create: `supabase/schema.sql`

**Step 1: Write the complete database schema**

Create `supabase/schema.sql`:
```sql
-- Fiscal years
CREATE TABLE fiscal_years (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Categories
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customers
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  org_number TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Suppliers
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  org_number TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  email TEXT,
  phone TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document type enum
CREATE TYPE document_type AS ENUM (
  'outgoing_invoice',
  'incoming_invoice',
  'payment_received',
  'credit_card_statement',
  'government_fee',
  'loan_statement',
  'receipt',
  'other'
);

-- Document status enum
CREATE TYPE document_status AS ENUM (
  'imported',
  'reviewed',
  'paid'
);

-- Documents (main table for all document types)
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type document_type NOT NULL,
  fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id),
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  linked_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  amount DECIMAL(12,2),
  vat DECIMAL(12,2),
  vat_rate DECIMAL(5,2),
  total DECIMAL(12,2),
  payment_date DATE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  ai_extracted_data JSONB,
  ai_confidence INTEGER CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
  ai_needs_review BOOLEAN DEFAULT false,
  status document_status DEFAULT 'imported',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document lines (for credit card statements etc.)
CREATE TABLE document_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  date DATE,
  description TEXT,
  amount DECIMAL(12,2),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bank transactions (for reconciliation)
CREATE TABLE bank_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id),
  booking_date DATE NOT NULL,
  transaction_date DATE,
  transaction_type TEXT,
  reference TEXT,
  amount DECIMAL(12,2) NOT NULL,
  balance DECIMAL(12,2),
  matched_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  import_batch_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_fiscal_year ON documents(fiscal_year_id);
CREATE INDEX idx_documents_customer ON documents(customer_id);
CREATE INDEX idx_documents_supplier ON documents(supplier_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_document_lines_document ON document_lines(document_id);
CREATE INDEX idx_bank_transactions_fiscal_year ON bank_transactions(fiscal_year_id);
CREATE INDEX idx_bank_transactions_matched ON bank_transactions(matched_document_id);
CREATE INDEX idx_bank_transactions_batch ON bank_transactions(import_batch_id);

-- Row Level Security
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow all authenticated users (2 users share data)
CREATE POLICY "Authenticated users can do everything" ON fiscal_years
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON document_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON bank_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed: fiscal year 2025
INSERT INTO fiscal_years (year, is_active) VALUES (2025, true);

-- Storage bucket for PDFs
-- Run in Supabase dashboard: create bucket 'documents' with public = false
-- Storage RLS: allow authenticated users to upload/read
```

**Step 2: Instructions for applying**

This SQL should be run in the Supabase SQL Editor dashboard. Also create a Storage bucket called `documents` (private) via the Supabase dashboard.

**Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add complete database schema with RLS policies"
```

---

### Task 4: Create shared TypeScript types

**Files:**
- Create: `src/types/index.ts`

**Step 1: Define all types**

Create `src/types/index.ts`:
```typescript
export type DocumentType =
  | 'outgoing_invoice'
  | 'incoming_invoice'
  | 'payment_received'
  | 'credit_card_statement'
  | 'government_fee'
  | 'loan_statement'
  | 'receipt'
  | 'other'

export type DocumentStatus = 'imported' | 'reviewed' | 'paid'

export interface FiscalYear {
  id: number
  year: number
  is_active: boolean
  created_at: string
}

export interface Category {
  id: number
  name: string
  description: string | null
  emoji: string | null
  created_at: string
}

export interface Customer {
  id: number
  name: string
  org_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  email: string | null
  phone: string | null
  created_at: string
}

export interface Supplier {
  id: number
  name: string
  org_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  email: string | null
  phone: string | null
  category_id: number | null
  category_name?: string
  category_emoji?: string
  created_at: string
}

export interface Document {
  id: string
  type: DocumentType
  fiscal_year_id: number
  customer_id: number | null
  supplier_id: number | null
  linked_document_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  amount: number | null
  vat: number | null
  vat_rate: number | null
  total: number | null
  payment_date: string | null
  category_id: number | null
  file_path: string
  file_name: string
  ai_extracted_data: Record<string, unknown> | null
  ai_confidence: number | null
  ai_needs_review: boolean
  status: DocumentStatus
  created_at: string
  // Joined fields
  customer_name?: string
  supplier_name?: string
  category_name?: string
  category_emoji?: string
}

export interface DocumentLine {
  id: string
  document_id: string
  date: string | null
  description: string | null
  amount: number | null
  category_id: number | null
  created_at: string
}

export interface BankTransaction {
  id: string
  fiscal_year_id: number
  booking_date: string
  transaction_date: string | null
  transaction_type: string | null
  reference: string | null
  amount: number
  balance: number | null
  matched_document_id: string | null
  import_batch_id: string
  created_at: string
}

export interface DashboardStats {
  income: number
  income_vat: number
  expenses: number
  expenses_vat: number
  result: number
  vat_to_pay: number
  document_count: number
  needs_review_count: number
}

export interface CustomerInput {
  name: string
  org_number?: string
  address?: string
  postal_code?: string
  city?: string
  email?: string
  phone?: string
}

export interface SupplierInput {
  name: string
  org_number?: string
  address?: string
  postal_code?: string
  city?: string
  email?: string
  phone?: string
  category_id?: number | null
}

export interface CategoryInput {
  name: string
  description?: string
  emoji?: string
}

export interface AIExtractionResult {
  type: DocumentType
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  amount: number | null
  vat: number | null
  vat_rate: number | null
  total: number | null
  counterpart_name: string | null
  counterpart_org_number: string | null
  confidence: number
  needs_review: boolean
  review_reasons: string[]
  lines: Array<{
    date: string | null
    description: string | null
    amount: number | null
  }> | null
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript type definitions for all entities"
```

---

## Phase 2: Auth & Layout

### Task 5: Create login page

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/actions.ts`

**Step 1: Create login server actions**

Create `src/app/login/actions.ts`:
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
```

**Step 2: Create login page**

Create `src/app/login/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">AJ</h1>
          <p className="text-gray-400 mt-2">Logga in</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <input
              name="email"
              type="email"
              placeholder="E-post"
              required
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <input
              name="password"
              type="password"
              placeholder="Losenord"
              required
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50"
          >
            {loading ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/login/
git commit -m "feat: add login page with dark theme and Supabase auth"
```

---

### Task 6: Create app layout with sidebar

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/Sidebar.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Step 1: Update global styles for dark theme**

Replace `src/app/globals.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #050505;
  --foreground: #f5f5f5;
}

body {
  background: var(--background);
  color: var(--foreground);
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}
```

**Step 2: Update root layout**

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AJ',
  description: 'Bokforing som inte suger',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv" className="dark">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

**Step 3: Create Sidebar component**

Create `src/components/Sidebar.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { logout } from '@/app/login/actions'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/kundfakturor', label: 'Kundfakturor', icon: '💰' },
  { href: '/leverantorsfakturor', label: 'Leverantorsfakturor', icon: '📦' },
  { href: '/bankavstamning', label: 'Bankavstamning', icon: '🏦' },
  { href: '/kunder', label: 'Kunder', icon: '👥' },
  { href: '/leverantorer', label: 'Leverantorer', icon: '🏢' },
  { href: '/kategorier', label: 'Kategorier', icon: '🏷️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 h-screen bg-gray-950 border-r border-gray-800 flex flex-col fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">AJ</h1>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
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
    </aside>
  )
}
```

**Step 4: Create app layout with sidebar**

Create `src/app/(app)/layout.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  )
}
```

**Step 5: Create placeholder dashboard page**

Create `src/app/(app)/page.tsx`:
```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      <p className="text-gray-400 mt-2">Kommer snart...</p>
    </div>
  )
}
```

**Step 6: Verify build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add app layout with dark sidebar navigation and auth guard"
```

---

## Phase 3: Core CRUD Pages

### Task 7: Categories page

**Files:**
- Create: `src/app/(app)/kategorier/page.tsx`
- Create: `src/app/api/categories/route.ts`
- Create: `src/app/api/categories/[id]/route.ts`
- Create: `src/components/CategoryForm.tsx`

**Step 1: Create categories API routes**

Create `src/app/api/categories/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('categories')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

Create `src/app/api/categories/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('categories')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Remove category references first
  await supabase.from('suppliers').update({ category_id: null }).eq('category_id', id)
  await supabase.from('documents').update({ category_id: null }).eq('category_id', id)

  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

**Step 2: Create CategoryForm component**

Create `src/components/CategoryForm.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { Category, CategoryInput } from '@/types'

interface Props {
  category?: Category
  onSave: (data: CategoryInput) => void
  onCancel: () => void
}

export default function CategoryForm({ category, onSave, onCancel }: Props) {
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [emoji, setEmoji] = useState(category?.emoji ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ name, description: description || undefined, emoji: emoji || undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Emoji</label>
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className="w-20 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-center text-2xl focus:outline-none focus:ring-2 focus:ring-purple-500"
          maxLength={2}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Namn</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Beskrivning</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
        >
          Spara
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
        >
          Avbryt
        </button>
      </div>
    </form>
  )
}
```

**Step 3: Create categories page**

Create `src/app/(app)/kategorier/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, CategoryInput } from '@/types'
import CategoryForm from '@/components/CategoryForm'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    const res = await fetch('/api/categories')
    const data = await res.json()
    setCategories(data)
  }

  async function handleSave(input: CategoryInput) {
    if (editing) {
      await fetch(`/api/categories/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    } else {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    }
    setShowForm(false)
    setEditing(null)
    fetchCategories()
  }

  async function handleDelete(id: number) {
    if (!confirm('Ta bort denna kategori?')) return
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    fetchCategories()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Kategorier</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
        >
          + Ny kategori
        </button>
      </div>

      <AnimatePresence>
        {(showForm || editing) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl"
          >
            <CategoryForm
              category={editing ?? undefined}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((cat, i) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors group"
          >
            <div className="text-3xl mb-2">{cat.emoji || '📁'}</div>
            <h3 className="text-white font-medium">{cat.name}</h3>
            {cat.description && (
              <p className="text-gray-500 text-sm mt-1">{cat.description}</p>
            )}
            <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => { setEditing(cat); setShowForm(false) }}
                className="text-xs text-gray-400 hover:text-white"
              >
                Redigera
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Ta bort
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add categories page with CRUD and animated grid"
```

---

### Task 8: Customers page

**Files:**
- Create: `src/app/(app)/kunder/page.tsx`
- Create: `src/app/api/customers/route.ts`
- Create: `src/app/api/customers/[id]/route.ts`
- Create: `src/components/EntityForm.tsx`

Follow same pattern as Task 7 but for customers. EntityForm is a reusable form for both customers and suppliers (same fields minus category_id).

**Commit:** `"feat: add customers page with CRUD"`

---

### Task 9: Suppliers page

**Files:**
- Create: `src/app/(app)/leverantorer/page.tsx`
- Create: `src/app/api/suppliers/route.ts`
- Create: `src/app/api/suppliers/[id]/route.ts`

Follow same pattern as Task 8 but for suppliers (includes category_id dropdown).

**Commit:** `"feat: add suppliers page with CRUD and category selection"`

---

## Phase 4: Document Upload & AI Extraction

### Task 10: AI extraction service

**Files:**
- Create: `src/lib/ai/extract.ts`
- Create: `src/lib/ai/prompt.ts`
- Test: `src/lib/ai/__tests__/extract.test.ts`

**Step 1: Write the AI prompt**

Create `src/lib/ai/prompt.ts`:
```typescript
export const EXTRACTION_PROMPT = `Du ar en AI-assistent som analyserar svenska bokforingsdokument (PDF).

Analysera detta dokument och extrahera foljande information.

VIKTIGA REGLER:
1. Om avsandaren ar "Mengshoel Production" -> type = "outgoing_invoice" (kundfaktura)
2. Om mottagaren ar "Mengshoel Production" -> type = "incoming_invoice" (leverantorsfaktura)
3. Om dokumentet ar en inbetalningsdetalj fran banken -> type = "payment_received"
4. Om dokumentet ar ett kontoutdrag med flera transaktioner -> type = "credit_card_statement"
5. Om avsandaren ar Transportstyrelsen, Skatteverket eller annan myndighet -> type = "government_fee"
6. Om dokumentet ar en laneavisering -> type = "loan_statement"
7. Om du inte kan avgora typen -> type = "other"

MOMSREGLER:
- Extrahera BARA moms om den tydligt framgar i dokumentet
- Myndighetsavgifter har ALDRIG moms
- Laneaviseringar har ALDRIG moms
- Om moms inte tydligt framgar, satt vat och vat_rate till null
- GISSA ALDRIG momsbelopp

For kontoutdrag (credit_card_statement): extrahera VARJE transaktion som en separat rad i "lines".

Svara ENBART med giltig JSON i detta format:
{
  "type": "outgoing_invoice|incoming_invoice|payment_received|credit_card_statement|government_fee|loan_statement|receipt|other",
  "invoice_number": "fakturanummer eller null",
  "invoice_date": "YYYY-MM-DD eller null",
  "due_date": "YYYY-MM-DD eller null",
  "amount": 0.00 (belopp exkl moms, eller null),
  "vat": 0.00 (momsbelopp, eller null),
  "vat_rate": 25 (momssats i procent, eller null),
  "total": 0.00 (belopp inkl moms),
  "counterpart_name": "namn pa kund/leverantor/avsandare",
  "counterpart_org_number": "organisationsnummer eller null",
  "confidence": 85 (0-100, hur saker du ar),
  "needs_review": false,
  "review_reasons": [],
  "lines": null (eller array av rader for kontoutdrag)
}

For "lines" (kontoutdrag), anvand detta format:
"lines": [
  { "date": "YYYY-MM-DD", "description": "beskrivning", "amount": -100.00 }
]`
```

**Step 2: Create extraction function**

Create `src/lib/ai/extract.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'
import { EXTRACTION_PROMPT } from './prompt'
import type { AIExtractionResult } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function extractFromPDF(
  pdfBase64: string,
  filenameHint?: string
): Promise<AIExtractionResult> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64,
          },
        },
        {
          type: 'text',
          text: filenameHint
            ? `${EXTRACTION_PROMPT}\n\nFilnamn: ${filenameHint}`
            : EXTRACTION_PROMPT,
        },
      ],
    },
  ]

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages,
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from AI')
  }

  const parsed = JSON.parse(textBlock.text) as AIExtractionResult
  return parsed
}
```

**Step 3: Install Anthropic SDK**

Run:
```bash
npm install @anthropic-ai/sdk
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add AI extraction service with Claude Haiku for PDF analysis"
```

---

### Task 11: Document upload API

**Files:**
- Create: `src/app/api/documents/upload/route.ts`
- Create: `src/lib/matching.ts`

**Step 1: Create fuzzy matching utility**

Create `src/lib/matching.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9åäö]/g, '')
}

function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.8

  // Simple character overlap
  const setA = new Set(na.split(''))
  const setB = new Set(nb.split(''))
  const intersection = [...setA].filter((c) => setB.has(c)).length
  const union = new Set([...setA, ...setB]).size
  return intersection / union
}

export async function findMatchingCustomer(name: string) {
  const supabase = await createClient()
  const { data: customers } = await supabase.from('customers').select('*')
  if (!customers?.length) return null

  let bestMatch = null
  let bestScore = 0

  for (const customer of customers) {
    const score = similarity(name, customer.name)
    if (score > bestScore && score >= 0.6) {
      bestScore = score
      bestMatch = customer
    }
  }

  return bestMatch
}

export async function findMatchingSupplier(name: string) {
  const supabase = await createClient()
  const { data: suppliers } = await supabase.from('suppliers').select('*')
  if (!suppliers?.length) return null

  let bestMatch = null
  let bestScore = 0

  for (const supplier of suppliers) {
    const score = similarity(name, supplier.name)
    if (score > bestScore && score >= 0.6) {
      bestScore = score
      bestMatch = supplier
    }
  }

  return bestMatch
}

export async function findMatchingInvoice(referenceNumber: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('invoice_number', referenceNumber)
    .limit(1)
    .single()

  return data
}
```

**Step 2: Create upload API route**

Create `src/app/api/documents/upload/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractFromPDF } from '@/lib/ai/extract'
import { findMatchingCustomer, findMatchingSupplier, findMatchingInvoice } from '@/lib/matching'

export async function POST(request: Request) {
  const supabase = await createClient()

  const formData = await request.formData()
  const file = formData.get('file') as File
  const typeHint = formData.get('typeHint') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Get active fiscal year
  const { data: fiscalYear } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!fiscalYear) {
    return NextResponse.json({ error: 'No active fiscal year' }, { status: 400 })
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from('documents')
    .select('id, file_name')
    .eq('file_name', file.name)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({
      error: 'duplicate',
      existing: existing[0],
      message: `En fil med namnet "${file.name}" finns redan`,
    }, { status: 409 })
  }

  // Upload to Supabase Storage
  const fileBuffer = await file.arrayBuffer()
  const filePath = `${fiscalYear.year}/${crypto.randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, fileBuffer, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // AI extraction
  const base64 = Buffer.from(fileBuffer).toString('base64')
  const aiResult = await extractFromPDF(base64, file.name)

  // Override type if user uploaded from a specific page
  if (typeHint === 'outgoing' && aiResult.confidence < 90) {
    aiResult.type = 'outgoing_invoice'
  } else if (typeHint === 'incoming' && aiResult.confidence < 90) {
    aiResult.type = 'incoming_invoice'
  }

  // Match customer/supplier
  let customerId: number | null = null
  let supplierId: number | null = null
  let linkedDocumentId: string | null = null

  if (aiResult.counterpart_name) {
    if (aiResult.type === 'outgoing_invoice') {
      const customer = await findMatchingCustomer(aiResult.counterpart_name)
      customerId = customer?.id ?? null
    } else if (aiResult.type === 'payment_received') {
      const customer = await findMatchingCustomer(aiResult.counterpart_name)
      customerId = customer?.id ?? null
      // Try to match payment to invoice
      if (aiResult.invoice_number) {
        const invoice = await findMatchingInvoice(aiResult.invoice_number)
        linkedDocumentId = invoice?.id ?? null
      }
    } else {
      const supplier = await findMatchingSupplier(aiResult.counterpart_name)
      supplierId = supplier?.id ?? null
    }
  }

  // Insert document
  const { data: doc, error: insertError } = await supabase
    .from('documents')
    .insert({
      type: aiResult.type,
      fiscal_year_id: fiscalYear.id,
      customer_id: customerId,
      supplier_id: supplierId,
      linked_document_id: linkedDocumentId,
      invoice_number: aiResult.invoice_number,
      invoice_date: aiResult.invoice_date,
      due_date: aiResult.due_date,
      amount: aiResult.amount,
      vat: aiResult.vat,
      vat_rate: aiResult.vat_rate,
      total: aiResult.total,
      file_path: filePath,
      file_name: file.name,
      ai_extracted_data: aiResult,
      ai_confidence: aiResult.confidence,
      ai_needs_review: aiResult.needs_review,
      status: 'imported',
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Insert document lines for credit card statements
  if (aiResult.type === 'credit_card_statement' && aiResult.lines) {
    const lines = aiResult.lines.map((line) => ({
      document_id: doc.id,
      date: line.date,
      description: line.description,
      amount: line.amount,
    }))
    await supabase.from('document_lines').insert(lines)
  }

  return NextResponse.json(doc)
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add document upload API with AI extraction and fuzzy matching"
```

---

### Task 12: File upload component

**Files:**
- Create: `src/components/FileUpload.tsx`

**Step 1: Create drag-and-drop upload component**

Create `src/components/FileUpload.tsx`:
```tsx
'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface UploadResult {
  file: File
  status: 'uploading' | 'done' | 'error' | 'duplicate'
  document?: Record<string, unknown>
  error?: string
}

interface Props {
  typeHint?: 'outgoing' | 'incoming'
  onUploadComplete: () => void
}

export default function FileUpload({ typeHint, onUploadComplete }: Props) {
  const [results, setResults] = useState<UploadResult[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const uploadFile = useCallback(async (file: File) => {
    setResults((prev) => [...prev, { file, status: 'uploading' }])

    const formData = new FormData()
    formData.append('file', file)
    if (typeHint) formData.append('typeHint', typeHint)

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.status === 409) {
        setResults((prev) =>
          prev.map((r) =>
            r.file === file ? { ...r, status: 'duplicate', error: data.message } : r
          )
        )
      } else if (!res.ok) {
        setResults((prev) =>
          prev.map((r) =>
            r.file === file ? { ...r, status: 'error', error: data.error } : r
          )
        )
      } else {
        setResults((prev) =>
          prev.map((r) =>
            r.file === file ? { ...r, status: 'done', document: data } : r
          )
        )
      }
    } catch {
      setResults((prev) =>
        prev.map((r) =>
          r.file === file ? { ...r, status: 'error', error: 'Uppkopplingsfel' } : r
        )
      )
    }
  }, [typeHint])

  async function handleFiles(files: FileList) {
    const pdfFiles = Array.from(files).filter((f) => f.type === 'application/pdf')
    for (const file of pdfFiles) {
      await uploadFile(file)
    }
    onUploadComplete()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  const allDone = results.length > 0 && results.every((r) => r.status !== 'uploading')

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging
            ? 'border-purple-500 bg-purple-500/10'
            : 'border-gray-800 hover:border-gray-600'
        }`}
      >
        <p className="text-gray-400 text-lg mb-2">
          Dra och slapp PDF-filer har
        </p>
        <p className="text-gray-600 text-sm mb-4">eller</p>
        <label className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm cursor-pointer">
          Valj filer
          <input
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </label>
      </div>

      <AnimatePresence>
        {results.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg"
          >
            <span className="text-lg">
              {r.status === 'uploading' && '⏳'}
              {r.status === 'done' && '✅'}
              {r.status === 'error' && '❌'}
              {r.status === 'duplicate' && '⚠️'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm truncate">{r.file.name}</p>
              {r.error && <p className="text-red-400 text-xs">{r.error}</p>}
              {r.status === 'uploading' && (
                <p className="text-gray-500 text-xs">Analyserar med AI...</p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {allDone && results.length > 0 && (
        <button
          onClick={() => setResults([])}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Rensa lista
        </button>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add drag-and-drop file upload component with batch support"
```

---

## Phase 5: Document List Pages

### Task 13: Documents API and shared list component

**Files:**
- Create: `src/app/api/documents/route.ts`
- Create: `src/app/api/documents/[id]/route.ts`
- Create: `src/components/DocumentList.tsx`
- Create: `src/components/DocumentPanel.tsx`
- Create: `src/components/SummaryBoxes.tsx`

**Step 1: Create documents API**

Create `src/app/api/documents/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type')
  const month = searchParams.get('month')
  const status = searchParams.get('status')
  const needsReview = searchParams.get('needsReview')

  let query = supabase
    .from('documents')
    .select(`
      *,
      customers(name),
      suppliers(name),
      categories(name, emoji)
    `)
    .order('invoice_date', { ascending: false })

  if (type === 'outgoing') {
    query = query.eq('type', 'outgoing_invoice')
  } else if (type === 'incoming') {
    query = query.in('type', [
      'incoming_invoice', 'credit_card_statement', 'government_fee',
      'loan_statement', 'receipt', 'other'
    ])
  }

  if (month) {
    query = query.gte('invoice_date', `${month}-01`).lte('invoice_date', `${month}-31`)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (needsReview === 'true') {
    query = query.eq('ai_needs_review', true)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten joined fields
  const documents = data?.map((doc: Record<string, unknown>) => ({
    ...doc,
    customer_name: (doc.customers as Record<string, string> | null)?.name,
    supplier_name: (doc.suppliers as Record<string, string> | null)?.name,
    category_name: (doc.categories as Record<string, string> | null)?.name,
    category_emoji: (doc.categories as Record<string, string> | null)?.emoji,
    customers: undefined,
    suppliers: undefined,
    categories: undefined,
  }))

  return NextResponse.json(documents)
}
```

Create `src/app/api/documents/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('documents')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Delete file from storage
  const { data: doc } = await supabase.from('documents').select('file_path').eq('id', id).single()
  if (doc) {
    await supabase.storage.from('documents').remove([doc.file_path])
  }

  const { error } = await supabase.from('documents').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

**Step 2: Create SummaryBoxes component**

Create `src/components/SummaryBoxes.tsx`:
```tsx
'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface Box {
  label: string
  value: number
  icon: string
  format?: 'currency' | 'number'
}

interface Props {
  boxes: Box[]
}

function AnimatedNumber({ value, format = 'currency' }: { value: number; format?: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 600
    const start = performance.now()
    const startVal = display

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(startVal + (value - startVal) * eased)
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [value])

  if (format === 'number') return <>{Math.round(display)}</>

  return (
    <>
      {new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.round(display))}
    </>
  )
}

export default function SummaryBoxes({ boxes }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {boxes.map((box, i) => (
        <motion.div
          key={box.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="p-4 bg-gray-900 border border-gray-800 rounded-xl"
        >
          <div className="text-2xl mb-1">{box.icon}</div>
          <p className="text-gray-400 text-xs uppercase tracking-wider">{box.label}</p>
          <p className="text-white text-xl font-bold mt-1">
            <AnimatedNumber value={box.value} format={box.format} />
          </p>
        </motion.div>
      ))}
    </div>
  )
}
```

**Step 3: Create DocumentList and DocumentPanel components**

These are substantial components — DocumentList renders a filterable table/list of documents, and DocumentPanel is a slide-over for viewing/editing a single document with PDF preview.

The DocumentPanel should include:
- PDF viewer (iframe to Supabase Storage signed URL)
- Editable fields for all AI-extracted data
- "Byt typ" button (changes document type)
- Customer/supplier selector
- Save/delete buttons

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add documents API, summary boxes, document list and panel components"
```

---

### Task 14: Kundfakturor page

**Files:**
- Create: `src/app/(app)/kundfakturor/page.tsx`

**Step 1: Create the page**

Create `src/app/(app)/kundfakturor/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import type { Document } from '@/types'
import SummaryBoxes from '@/components/SummaryBoxes'
import DocumentList from '@/components/DocumentList'
import FileUpload from '@/components/FileUpload'

export default function KundfakturorPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [showUpload, setShowUpload] = useState(false)

  async function fetchDocuments() {
    const res = await fetch('/api/documents?type=outgoing')
    const data = await res.json()
    setDocuments(data)
  }

  useEffect(() => { fetchDocuments() }, [])

  const totalInvoiced = documents.reduce((sum, d) => sum + (d.amount ?? 0), 0)
  const totalVat = documents.reduce((sum, d) => sum + (d.vat ?? 0), 0)
  const paidCount = documents.filter((d) => d.status === 'paid').length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Kundfakturor</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all text-sm font-medium"
        >
          + Ladda upp
        </button>
      </div>

      <SummaryBoxes boxes={[
        { label: 'Fakturerat', value: totalInvoiced, icon: '💰' },
        { label: 'Moms', value: totalVat, icon: '🧾' },
        { label: 'Antal', value: documents.length, icon: '📄', format: 'number' },
        { label: 'Betalda', value: paidCount, icon: '✅', format: 'number' },
      ]} />

      {showUpload && (
        <div className="mb-8">
          <FileUpload typeHint="outgoing" onUploadComplete={fetchDocuments} />
        </div>
      )}

      <DocumentList documents={documents} onUpdate={fetchDocuments} />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Kundfakturor page with summary boxes and upload"
```

---

### Task 15: Leverantorsfakturor page

Same pattern as Task 14 but with `type=incoming`, different summary boxes (Kostnader, Ingaende moms, Antal, Att granska).

**Commit:** `"feat: add Leverantorsfakturor page with summary boxes and upload"`

---

## Phase 6: Dashboard

### Task 16: Dashboard with summary boxes and chart

**Files:**
- Create: `src/app/api/dashboard/route.ts`
- Modify: `src/app/(app)/page.tsx`

**Step 1: Create dashboard API**

Create `src/app/api/dashboard/route.ts` — aggregates income, expenses, VAT from documents table for the active fiscal year.

**Step 2: Build dashboard page** with:
- 6 summary boxes: Intakter, Utgaende moms, Kostnader, Ingaende moms, Resultat, Moms att betala
- "Att granska" section showing documents with `ai_needs_review = true`
- Simple monthly bar chart (can use a lightweight chart or CSS-only bars)

**Commit:** `"feat: add dashboard with summary boxes and review queue"`

---

## Phase 7: Bank Reconciliation

### Task 17: Bank transaction import API

**Files:**
- Create: `src/app/api/bank/import/route.ts`
- Create: `src/lib/bank/parse-swedbank.ts`
- Create: `src/lib/bank/match.ts`

**Step 1: Create Swedbank Excel parser**

Parse the specific format: skip header rows, extract Bokforingsdatum, Transaktionsdatum, Transaktionstyp, Referens, Belopp, Bokfort saldo.

**Step 2: Create matching logic**

Match bank transactions to documents by:
1. Exact reference match (e.g. "Faktura 1355 SVT" matches invoice_number "1355")
2. Amount + date proximity (same amount, within 3 days)
3. Supplier name in reference text

**Step 3: Create import API route**

Accepts .xlsx file, parses it, matches against existing documents, inserts into bank_transactions.

**Commit:** `"feat: add bank transaction import with Swedbank Excel parser and auto-matching"`

---

### Task 18: Bank reconciliation page

**Files:**
- Create: `src/app/(app)/bankavstamning/page.tsx`

Three sections:
1. Upload area for Excel file
2. Summary boxes: Matchade, Saknar kvitto, Saknas i bank
3. Filterable list with color-coded status

**Commit:** `"feat: add bank reconciliation page with matching overview"`

---

## Phase 8: Excel Export

### Task 19: Excel export API

**Files:**
- Create: `src/app/api/documents/export/route.ts`

Uses `xlsx` library to generate .xlsx from filtered documents. Add export buttons to Kundfakturor and Leverantorsfakturor pages.

**Commit:** `"feat: add Excel export for customer and supplier invoices"`

---

## Phase 9: Polish

### Task 20: AJ icon and favicon

**Files:**
- Create: `public/icon.svg`
- Create: `src/app/favicon.ico` (generated from SVG)
- Modify: `src/app/layout.tsx`

Create a minimalist "AJ" SVG logo — bold, modern sans-serif on transparent/dark background. Generate favicon from it.

**Commit:** `"feat: add AJ logo and favicon"`

---

### Task 21: Fiscal year selector

**Files:**
- Create: `src/components/FiscalYearSelector.tsx`
- Create: `src/app/api/fiscal-years/route.ts`

Dropdown in the sidebar or header to switch active fiscal year. All queries filter by active year.

**Commit:** `"feat: add fiscal year selector"`

---

### Task 22: Final integration test and deploy setup

**Step 1: Verify all pages build**

Run:
```bash
npm run build
```

**Step 2: Create GitHub repo and push**

```bash
git remote add origin <github-url>
git push -u origin main
```

**Step 3: Connect to Vercel**

- Go to vercel.com, import the GitHub repo
- Add environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY)
- Deploy

**Step 4: Set up Supabase**

- Run schema.sql in Supabase SQL Editor
- Create Storage bucket "documents" (private)
- Create 2 user accounts via Supabase Auth dashboard

**Commit:** `"chore: final build verification and deploy configuration"`

---

## Task Dependency Summary

```
Phase 1: Tasks 1-4 (foundation) — sequential
Phase 2: Tasks 5-6 (auth & layout) — sequential, depends on Phase 1
Phase 3: Tasks 7-9 (CRUD) — can be parallelized, depends on Phase 2
Phase 4: Tasks 10-12 (upload & AI) — sequential, depends on Phase 1
Phase 5: Tasks 13-15 (document pages) — depends on Phase 3 + Phase 4
Phase 6: Task 16 (dashboard) — depends on Phase 5
Phase 7: Tasks 17-18 (bank) — depends on Phase 5
Phase 8: Task 19 (export) — depends on Phase 5
Phase 9: Tasks 20-22 (polish) — depends on everything
```

Parallelizable: Tasks 7+8+9, Tasks 10+11 vs 7+8+9, Tasks 17+19
