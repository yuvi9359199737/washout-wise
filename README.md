# Washout Companion

---

# MASTER PROMPT: BUILD A PRODUCTION-READY "WASHOUT" APP

## 1. Product Overview

**Product Name:** WASHOUT (Medication Clearance & ConMed Mapper)

**Tagline:** A protocol-specific medication clearance and washout-tracking application that prevents ConMed-related protocol deviations by automating WHO-DD formatting and half-life clearance calculations.

**Core Problem:** Clinical Research Coordinators (CRCs) spend hours manually checking patient medications against protocol restrictions, calculating washout periods, and formatting medication names for EDC systems. This leads to protocol deviations, data entry errors, and delayed enrollment.

**Solution:** A web application that:
1. Allows CRCs to search medications and get standardized names (WHO-DD format)
2. Automatically calculates washout clearance dates using half-life data
3. Flags protocol violations before they happen
4. Generates EDC-ready formatted text for copy-paste

---

## 2. Technology Stack

### Recommended Stack (Production-Ready)

| Layer | Technology | Why |
|-------|------------|-----|
| **Frontend** | React 18 + TypeScript + Vite | Modern, fast, type-safe |
| **Styling** | Tailwind CSS + shadcn/ui | Professional healthcare UI without design skills |
| **Backend** | Python FastAPI | Fast development, automatic API docs, type validation |
| **Database** | PostgreSQL | Robust, ACID compliant, handles medical data safely |
| **ORM** | SQLAlchemy | Type-safe database interactions |
| **Auth** | JWT with refresh tokens | Secure, stateless authentication |
| **Deployment** | Docker Compose | One-command deployment, works everywhere |

### Alternative Stack (If You Prefer JavaScript)

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14+ (App Router) |
| **Backend** | Next.js API Routes + Prisma |
| **Database** | PostgreSQL (via Vercel Postgres or Supabase) |
| **Auth** | NextAuth.js or Stack Auth |
| **Deployment** | Vercel |

**My Recommendation:** Use the **React + FastAPI + PostgreSQL** stack. It is the most commonly used stack in clinical research software and will impress interviewers who know the industry.

---

## 3. Project Structure

```
washout-app/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py          # Login, registration, JWT
│   │   │   ├── drugs.py         # Drug search, WHO-DD mapping
│   │   │   ├── patients.py      # Patient CRUD
│   │   │   ├── studies.py       # Study/protocol management
│   │   │   └── washout.py       # Clearance calculations
│   │   ├── core/
│   │   │   ├── config.py        # Environment variables
│   │   │   ├── database.py      # DB connection
│   │   │   └── security.py      # Password hashing, JWT
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── drug.py
│   │   │   ├── patient.py
│   │   │   ├── study.py
│   │   │   └── washout.py
│   │   └── schemas/
│   │       └── (Pydantic models for validation)
│   ├── migrations/              # Alembic database migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   ├── dashboard/
│   │   │   ├── drug-search/
│   │   │   ├── patient-profile/
│   │   │   └── washout-calculator/
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── DrugSearch.tsx
│   │   │   ├── PatientDetail.tsx
│   │   │   └── StudyManager.tsx
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API calls (axios)
│   │   ├── types/               # TypeScript types
│   │   └── utils/               # Helper functions
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── .env.example
│
├── docker-compose.yml
└── README.md
```

---

## 4. Database Schema

### Core Tables

**users**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID (PK) | Primary key |
| email | VARCHAR(255) | Unique, login email |
| password_hash | VARCHAR(255) | Bcrypt hashed |
| full_name | VARCHAR(100) | User's full name |
| role | ENUM | admin, coordinator, pi, cra |
| created_at | TIMESTAMP | Auto |

**studies**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID (PK) | Primary key |
| name | VARCHAR(200) | Study name |
| protocol_number | VARCHAR(50) | Unique protocol ID |
| phase | VARCHAR(20) | Phase I-IV |
| indication | VARCHAR(200) | Disease area |
| pi_id | UUID (FK) | Principal Investigator |
| status | ENUM | active, completed, on-hold |
| created_at | TIMESTAMP | Auto |

**prohibited_drugs** (Protocol restrictions)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID (PK) | Primary key |
| study_id | UUID (FK) | Which study |
| drug_name | VARCHAR(200) | Name of prohibited drug |
| atc_code | VARCHAR(20) | ATC code if known |
| washout_days_required | INTEGER | Days patient must be off drug |
| reason | TEXT | Why prohibited |

**drug_dictionary** (WHO-DD format)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID (PK) | Primary key |
| preferred_name | VARCHAR(200) | WHO-DD preferred term |
| atc_code | VARCHAR(20) | Anatomical Therapeutic Chemical code |
| trade_names | TEXT[] | Common brand names |
| half_life_hours | DECIMAL | Elimination half-life |
| common_misspellings | TEXT[] | For fuzzy search |
| source | VARCHAR(50) | e.g., "RxNorm", "DrugCentral" |

**patients**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID (PK) | Primary key |
| study_id | UUID (FK) | Enrolled study |
| study_id_number | VARCHAR(50) | Patient ID in study |
| pseudonym | VARCHAR(100) | De-identified name |
| age | INTEGER | |
| gender | VARCHAR(10) | |
| enrollment_date | DATE | |
| status | ENUM | screening, enrolled, completed, dropped |

**patient_medications** (Current medications)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID (PK) | Primary key |
| patient_id | UUID (FK) | |
| drug_name_raw | VARCHAR(200) | What CRC typed |
| drug_dictionary_id | UUID (FK) | Matched standardized drug |
| dose | VARCHAR(50) | |
| frequency | VARCHAR(50) | |
| last_dose_date | DATE | |
| clearance_date | DATE | Calculated: last_dose + (5 × half_life) |
| is_prohibited | BOOLEAN | Flagged by system |
| protocol_deviation_risk | ENUM | low, medium, high |

**washout_calculations** (Audit log)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID (PK) | Primary key |
| patient_medication_id | UUID (FK) | |
| calculated_by | UUID (FK) | User who ran calculation |
| half_life_used | DECIMAL | Value used |
| clearance_date | DATE | Calculated result |
| calculated_at | TIMESTAMP | Auto |

**audit_log**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | |
| action | VARCHAR(100) | |
| table_name | VARCHAR(50) | |
| record_id | UUID | |
| old_data | JSONB | |
| new_data | JSONB | |
| created_at | TIMESTAMP | Auto |

---

## 5. API Endpoints (Backend)

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new user |
| POST | `/api/auth/login` | Login → returns JWT |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/auth/logout` | Logout (invalidate token) |

### Drug Dictionary
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drugs/search?q={term}` | Fuzzy search drug names |
| GET | `/api/drugs/{id}` | Get drug details |
| GET | `/api/drugs/atc/{code}` | Get drugs by ATC code |
| POST | `/api/drugs` | Add new drug (admin only) |

### Studies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/studies` | List all studies |
| GET | `/api/studies/{id}` | Get study details |
| POST | `/api/studies` | Create study |
| PUT | `/api/studies/{id}` | Update study |
| POST | `/api/studies/{id}/prohibited` | Add prohibited drug |

### Patients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients` | List patients (filter by study) |
| GET | `/api/patients/{id}` | Get patient with medications |
| POST | `/api/patients` | Create patient |
| PUT | `/api/patients/{id}` | Update patient |

### Medications & Washout
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients/{id}/medications` | List patient's medications |
| POST | `/api/patients/{id}/medications` | Add medication |
| PUT | `/api/medications/{id}` | Update medication |
| DELETE | `/api/medications/{id}` | Delete medication |
| POST | `/api/medications/{id}/calculate` | Run washout calculation |
| GET | `/api/patients/{id}/washout-status` | Get all clearance statuses |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/study/{id}/medications` | All medications in study |
| GET | `/api/reports/study/{id}/deviations` | Protocol deviation report |
| GET | `/api/reports/patient/{id}/clearance` | Patient clearance summary |

---

## 6. Core Logic: Washout Calculator

### The "5 × Half-Life" Rule

```
clearance_date = last_dose_date + (5 × half_life_in_days)
```

### Implementation Pseudocode

```python
def calculate_clearance(medication_id: UUID) -> WashoutResult:
    med = get_medication(medication_id)
    drug = get_drug_dictionary(med.drug_dictionary_id)
    
    if not drug.half_life_hours:
        return WashoutResult(
            status="UNKNOWN",
            message="Half-life data not available for this drug"
        )
    
    half_life_days = drug.half_life_hours / 24
    clearance_days = 5 * half_life_days
    clearance_date = med.last_dose_date + timedelta(days=clearance_days)
    
    # Check against protocol
    study = get_study(med.patient.study_id)
    prohibited = get_prohibited_drugs(study.id)
    
    is_prohibited = any(
        p.drug_name.lower() == drug.preferred_name.lower() 
        for p in prohibited
    )
    
    if is_prohibited and clearance_date > date.today():
        risk = "HIGH"
        message = f"WARNING: Patient is on prohibited drug. Clearance date: {clearance_date}"
    elif is_prohibited and clearance_date <= date.today():
        risk = "LOW"
        message = f"Drug is cleared. Safe to enroll."
    else:
        risk = "LOW"
        message = f"Drug is not prohibited. Clearance date: {clearance_date}"
    
    return WashoutResult(
        clearance_date=clearance_date,
        half_life_used=drug.half_life_hours,
        is_prohibited=is_prohibited,
        risk=risk,
        message=message
    )
```

---

## 7. Frontend Screens

### Screen 1: Login
- Email + Password fields
- "Login" button
- "Forgot Password?" link (optional for demo)
- Professional healthcare design

### Screen 2: Dashboard
- **Metrics Cards:**
  - Active Studies
  - Total Patients
  - Medications Tracked
  - High-Risk Drug Alerts
- **Recent Activity Feed:** Shows latest calculations, alerts
- **Quick Actions:** "Search Drug", "Add Patient", "View Studies"

### Screen 3: Drug Search (Signature Feature)
- **Search Bar:** Type drug name (supports misspellings)
- **Results Table:**
  - Preferred Name (WHO-DD format)
  - ATC Code
  - Half-Life
  - Trade Names
- **"Copy EDC Text" Button:** Generates formatted text:
  ```
  OMEPRAZOLE (ATC: A02BC01) | 40mg | Daily | Last dose: 15-JAN-2026
  ```
- **"Calculate Clearance" Button:** Opens washout calculator

### Screen 4: Washout Calculator
- **Inputs:**
  - Drug (auto-filled from search)
  - Last Dose Date (date picker)
  - Patient (select from dropdown)
- **Output:**
  - Clearance Date (calculated)
  - Status badge: CLEARED / PENDING / PROHIBITED
  - Protocol Compliance: ✅ or ❌
  - EDC-ready text to copy

### Screen 5: Patient Profile
- Patient demographics
- **Medication List:**
  - Each medication with status badge
  - Clearance date if calculated
  - Prohibited flag
- **"Add Medication" Button**
- **"Generate Report" Button**

### Screen 6: Study Manager
- List of studies
- Create new study
- Add prohibited drugs to study
- View study dashboard

### Screen 7: Reports
- Medication Summary Report (by study)
- Protocol Deviation Risk Report
- Patient Clearance Status Report
- Export to CSV/PDF

---

## 8. Synthetic Demo Data

### 10 Sample Drugs (WHO-DD Format)

| Preferred Name | ATC Code | Half-Life (hours) | Trade Names | Common Misspellings |
|----------------|----------|-------------------|-------------|---------------------|
| Omeprazole | A02BC01 | 1.5 | Prilosec, Losec | omeprazol, omaprazole |
| Metformin | A10BA02 | 6.5 | Glucophage | metiformin, metphormin |
| Atorvastatin | C10AA05 | 14 | Lipitor | atorvastatin, atorvastin |
| Amlodipine | C08CA01 | 35 | Norvasc | amlodapine, amlodipin |
| Aspirin | B01AC06 | 0.3 | Bayer Aspirin | asprin, aspririn |
| Losartan | C09CA01 | 2 | Cozaar | losartin, losarton |
| Escitalopram | N06AB10 | 30 | Lexapro | escitalapram, escitalopr |
| Pantoprazole | A02BC02 | 1 | Protonix | pantaprazole, panto |
| Clopidogrel | B01AC04 | 7 | Plavix | clopidogrel, clopidog |
| Simvastatin | C10AA01 | 3 | Zocor | simvastatin, simvastin |

### 3 Sample Studies

| Study ID | Name | Indication | Prohibited Drugs | Required Washout |
|----------|------|------------|------------------|------------------|
| ST-001 | Phase III Immunotherapy NSCLC | Lung Cancer | Atorvastatin, Simvastatin | 14 days |
| ST-002 | Phase II Cardiac Trial | Heart Failure | Aspirin, Clopidogrel | 7 days |
| ST-003 | Phase I Neurology Trial | Alzheimer's | Escitalopram | 30 days |

### 5 Sample Patients

| Patient ID | Study | Age | Gender | Current Medications |
|------------|-------|-----|--------|---------------------|
| P-001 | ST-001 | 62 | M | Atorvastatin (last dose: 10-JAN-2026) |
| P-002 | ST-001 | 58 | F | Metformin (last dose: 15-JAN-2026) |
| P-003 | ST-002 | 71 | M | Aspirin (last dose: 05-JAN-2026) |
| P-004 | ST-002 | 65 | F | Amlodipine (last dose: 12-JAN-2026) |
| P-005 | ST-003 | 48 | M | Escitalopram (last dose: 01-JAN-2026) |

### Expected Washout Results

| Patient | Drug | Prohibited? | Last Dose | Clearance Date | Status |
|---------|------|-------------|-----------|----------------|--------|
| P-001 | Atorvastatin | YES (ST-001) | 10-JAN-2026 | 24-JAN-2026 | 🔴 PROHIBITED (pending) |
| P-002 | Metformin | NO | 15-JAN-2026 | 16-JAN-2026 | 🟢 CLEARED |
| P-003 | Aspirin | YES (ST-002) | 05-JAN-2026 | 06-JAN-2026 | 🟢 CLEARED (safe) |
| P-004 | Amlodipine | NO | 12-JAN-2026 | 19-JAN-2026 | 🟢 CLEARED |
| P-005 | Escitalopram | YES (ST-003) | 01-JAN-2026 | 31-JAN-2026 | 🔴 PROHIBITED (pending) |

---

## 9. UI/UX Design Specification

### Color Palette (Medical Professional)

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Navy | #1a365d | Headers, primary buttons |
| Primary Light | #e2e8f0 | Backgrounds |
| Success Green | #38a169 | "Cleared" status |
| Danger Red | #e53e3e | "Prohibited" / "High Risk" |
| Warning Orange | #dd6b20 | "Pending" status |
| Info Blue | #3182ce | Information, help |

### Typography

| Element | Font | Size |
|---------|------|------|
| Headings | Inter | 20-28px |
| Body | Inter | 14-16px |
| Labels | Inter | 12px |
| Status Badges | Inter | 12px (bold) |

### Status Badge Design

| Status | Badge Color | Icon |
|--------|-------------|------|
| ✅ CLEARED | Green | Check mark |
| ⏳ PENDING | Orange | Clock |
| ❌ PROHIBITED | Red | Warning triangle |
| ⚠️ HIGH RISK | Red | Alert |
| ℹ️ UNKNOWN | Gray | Question mark |

---

## 10. Interview Demonstration Script (5 Minutes)

### Opening (30 seconds)
> "I built WASHOUT, a medication clearance and washout-tracking application. It solves a major problem in clinical research: CRCs spend too much time manually checking if patient medications are prohibited and calculating washout periods. My app automates this and prevents protocol deviations."

### Step 1: Login & Dashboard (45 seconds)
> "Here's the dashboard. I can see all my active studies, total patients, medications being tracked, and any high-risk drug alerts. The system immediately flags patients who might be on prohibited drugs."

### Step 2: Drug Search (60 seconds)
> "This is the signature feature. I type a drug name, even with a misspelling, and the system finds the standardized WHO-DD name, ATC code, and half-life. It suggests trade names and common misspellings. One click copies the EDC-ready formatted text."

### Step 3: Washout Calculator (60 seconds)
> "I select a patient, choose their medication, enter the last dose date, and click Calculate. The system uses the 5 × half-life rule to determine the clearance date. It automatically checks against the study's prohibited drug list and flags any violations."

### Step 4: Patient Profile (45 seconds)
> "Here's the patient profile showing all their current medications, each with a status badge. Green means cleared, red means prohibited. I can see exactly when each drug will clear the patient's system."

### Step 5: Protocol Deviation Prevention (45 seconds)
> "This is the key value: the system prevents protocol deviations before they happen. If a patient is on a prohibited drug, the system clearly shows the clearance date and warns the CRC to wait before enrolling."

### Step 6: Reports (30 seconds)
> "I can generate reports for the study sponsor showing all medications, clearance statuses, and any protocol deviation risks. This supports source data verification and audit trails."

### Closing (30 seconds)
> "WASHOUT is built with React, FastAPI, and PostgreSQL. It demonstrates GCP principles, data integrity, and a practical understanding of clinical research workflows. I'm happy to answer any questions."

---

## 11. Deployment Instructions

### Using Docker Compose (Recommended)

```bash
# Clone or create project
git clone your-repo
cd washout-app

# Create .env files from examples
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Build and run all services
docker-compose up -d --build

# Access the app
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
# Database: localhost:5432 (pgAdmin at localhost:5050)
```

### Environment Variables

**Backend (.env)**
```
DATABASE_URL=postgresql://user:password@db:5432/washout
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Frontend (.env)**
```
VITE_API_URL=http://localhost:8000/api
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: washout_user
      POSTGRES_PASSWORD: washout_pass
      POSTGRES_DB: washout
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin123
    ports:
      - "5050:80"
    depends_on:
      - db

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://washout_user:washout_pass@db:5432/washout
    ports:
      - "8000:8000"
    depends_on:
      - db
    volumes:
      - ./backend:/app

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    environment:
      VITE_API_URL: http://localhost:8000/api

volumes:
  postgres_data:
```

---

