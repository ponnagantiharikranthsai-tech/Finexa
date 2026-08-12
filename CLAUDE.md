# FINEXA — Smart Loan Management System

## Project Architecture & Configuration
- **Framework**: Next.js 16 (App Router + Server Actions)
- **Database**: PostgreSQL (Supabase `db.tvhwxmsynmhbdapmkxzx.supabase.co:5432` for local dev)
- **PDF Engine**: jsPDF Executive Enterprise Generator
- **Styling**: Vanilla CSS Design Tokens + Tailwind CSS

## Core Commands
- `npm run dev` — Launch Next.js Development Server (http://localhost:3000)
- `npm run build` — Compile & Type-Check Production Build
- `npm start` — Run Production Server

## Environment Keys (`.env.local`)
- `OPENAI_API_KEY` — Configured for AI Assistants & Document Processing
- `DEV_DATABASE_URL` — Isolated Local Development PostgreSQL Database
- `DATABASE_URL` — Production PostgreSQL Database

## Key Features & PDF Generators
1. **Current Loan Statement PDF**: `src/features/loans/utils/generate-current-statement-pdf.ts`
2. **Payment Completed PDF**: `src/features/loans/utils/generate-payment-completed-pdf.ts` (Includes official circular stamp seal)
3. **Loan Extension PDF**: `src/features/loans/utils/generate-loan-extension-pdf.ts`
