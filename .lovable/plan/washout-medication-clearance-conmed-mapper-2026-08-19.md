# WASHOUT — Medication Clearance & ConMed Mapper

A clinical-research web app that standardizes medication names (WHO-DD), calculates washout clearance dates from half-life data, flags protocol violations, and produces EDC-ready text and sponsor reports.

## Stack note

This will be built on Lovable's stack rather than FastAPI + Docker: React + TypeScript + TanStack Start on the front end, with Lovable Cloud providing the PostgreSQL database, authentication, row-level security, and server-side logic. Same architecture in spirit (typed API layer, relational DB, JWT sessions, audit trail) with no local Docker setup needed — it deploys with one click.

## Screens

1. **Auth** (`/auth`) — email + password sign in and sign up, role selected at signup (coordinator by default). Public route.
2. **Dashboard** (`/dashboard`) — metric cards (Active Studies, Total Patients, Medications Tracked, High-Risk Alerts), recent activity feed from the audit log, quick actions.
3. **Drug Search** (`/drugs`) — fuzzy search tolerant of misspellings and trade names; results table with preferred name, ATC code, half-life, trade names; "Copy EDC Text" and "Calculate Clearance" per row. Admin-only "Add drug" dialog.
4. **Washout Calculator** (`/calculator`) — drug + last dose date + patient; outputs clearance date, status badge (CLEARED / PENDING / PROHIBITED / UNKNOWN), protocol compliance, copyable EDC text. Saves a `washout_calculations` audit row.
5. **Patients** (`/patients`, `/patients/$id`) — list filterable by study; profile with demographics, medication table with status badges and clearance dates, add/edit/delete medication, generate report.
6. **Study Manager** (`/studies`, `/studies/$id`) — list and create studies, manage prohibited drugs with required washout days.
7. **Reports** (`/reports`) — Medication Summary, Protocol Deviation Risk, Patient Clearance Status. Each exports CSV and PDF.

Public landing at `/` explains the product with a sign-in CTA; everything else sits behind the auth gate.

## Washout logic

`clearance_date = last_dose_date + 5 × (half_life_hours / 24)`, rounded up to whole days.

Status rules:
- No half-life on file → UNKNOWN.
- Drug on the study's prohibited list and clearance date in the future → PROHIBITED, risk HIGH.
- Prohibited but clearance date already passed → CLEARED, risk LOW.
- Not prohibited → CLEARED with the informational clearance date.
- If the study specifies `washout_days_required`, the later of the half-life date and `last_dose + washout_days_required` is used.

Calculations run server-side so results and audit entries cannot be forged from the browser, and they are written to `patient_medications` plus a `washout_calculations` log row.

## Data model

Tables: `profiles` (id, full_name, email), `user_roles` (separate table, enum admin/coordinator/pi/cra), `studies`, `prohibited_drugs`, `drug_dictionary`, `patients`, `patient_medications`, `washout_calculations`, `audit_log`.

Roles live in their own table checked by a security-definer `has_role()` function — never on the profile row — so role checks can't be escalated from the client.

Access rules: any signed-in user can read the drug dictionary; only admins can write it. Studies, patients, medications, and calculations are readable by signed-in staff and writable by coordinators, PIs, and admins. The audit log is insert-only for the app and readable by admins and PIs. No anonymous access to patient data.

Seed data ships in the initial migration: the 10 WHO-DD drugs with ATC codes, half-lives, trade names and misspellings; studies ST-001/002/003 with their prohibited drugs; and patients P-001 through P-005 with their listed medications and last-dose dates, so the demo has content on first load.

## Design

Medical-professional look, not a generic SaaS template: deep navy `#1a365d` primary on a cool slate-grey background, semantic status colors (green cleared, orange pending, red prohibited, blue informational), Inter typography, dense data tables, compact status badges with icons. All colors defined as design tokens in `src/styles.css` so light and dark both work.

## Technical notes

- Server functions in `src/lib/*.functions.ts` handle the clearance calculation, search, reporting queries, and audit writes; protected ones use `requireSupabaseAuth`.
- Fuzzy search runs in Postgres with `pg_trgm` similarity across preferred name, trade names, and known misspellings, so a typo like "omaprazole" still resolves.
- CSV export is generated client-side; PDF via `jspdf` + `jspdf-autotable`.
- Each route defines its own `head()` metadata; report routes are marked noindex.

## Build order

1. Enable Lovable Cloud, run the schema + RLS + seed migration.
2. Auth, roles, route gate, app shell and navigation.
3. Drug dictionary + search + EDC text formatting.
4. Studies and prohibited drug management.
5. Patients, medications, clearance calculation and status badges.
6. Dashboard metrics and activity feed.
7. Reports with CSV and PDF export.
