# Transaction Pipeline

A backend-focused project demonstrating **high-throughput financial transaction processing** with ACID guarantees, row-level locking, idempotency, and a double-entry ledger — built with FastAPI, PostgreSQL, and React.

---

## ⚡ Quick Test / Dummy Accounts

The database is pre-seeded with 4 test accounts loaded with ₹2,000 each:

| Email | Password | Account ID | Initial Balance |
|-------|----------|------------|-----------------|
| `alice@transactiq.com` | `alice123` | **#1** | **₹2,000.00** |
| `bob@transactiq.com` | `bob123` | **#2** | **₹2,000.00** |
| `charlie@transactiq.com` | `charlie123` | **#3** | **₹2,000.00** |
| `diana@transactiq.com` | `diana123` | **#4** | **₹2,000.00** |

**How to test transfers right away:**
1. Open [http://localhost:5173/login](http://localhost:5173/login)
2. Login with `alice@transactiq.com` / `alice123`
3. Transfer **₹500.00** from Account **#1** to Account **#2**
4. Logout and sign in as `bob@transactiq.com` / `bob123` — see Bob's balance updated to **₹2,500.00**
5. Check the transaction details to see the generated **Idempotency Key** and double-entry ledger entries!

---

## What This Project Demonstrates

| Concept | Implementation |
|---------|---------------|
| **ACID Transactions** | SQLAlchemy session with DB-level atomicity — all or nothing on every transfer |
| **Row-level Locking** | `SELECT ... FOR UPDATE` on both accounts before any debit/credit |
| **Deadlock Prevention** | Deterministic lock ordering (always lock lower account ID first) |
| **Idempotency** | `Idempotency-Key` header + DB unique constraint — same request never processes twice |
| **Double-entry Ledger** | Every transfer creates a DEBIT + CREDIT ledger entry |
| **JWT Authentication** | HS256 tokens, 30-minute expiry, Bearer header on all protected routes |
| **Password Hashing** | bcrypt with salt — passwords never stored in plain text |
| **Connection Pooling** | SQLAlchemy pool (size=20, overflow=30) for concurrent load |
| **Input Validation** | Pydantic schemas — amount must be > 0 and ≤ ₹1,00,00,000 |
| **Structured Logging** | Every transfer logs transaction_id and latency_ms |

---

## Tech Stack

### Backend
- **FastAPI** — async-ready Python web framework
- **SQLAlchemy 2.x** — ORM with row-level locking support
- **PostgreSQL (Neon)** — cloud-hosted serverless PostgreSQL
- **Alembic** — database migrations
- **bcrypt** — password hashing
- **PyJWT** — JWT token generation and verification
- **Pydantic v2** — request/response validation
- **python-dotenv** — environment variable management

### Frontend
- **React 18** + **Vite** — fast, modern frontend
- **React Router v6** — client-side routing with protected routes
- **Axios** — HTTP client with JWT interceptor
- Plain **CSS** — custom dark theme, no bloated UI libraries

### Infrastructure
- **Neon** — serverless PostgreSQL (cloud)
- **GitHub** — version control

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      React Frontend                      │
│          (Login / Dashboard / Transfer / History)        │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP + JWT
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Backend                       │
│                                                          │
│  /auth/register   /auth/login                           │
│  /accounts        /accounts/{id}/balance                │
│  /transactions/transfer   /transactions/history         │
│                                                          │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ API Layer  │→ │ Service Layer│→ │   Models / ORM  │ │
│  │ (Routers)  │  │(transaction_ │  │ User, Account,  │ │
│  │            │  │  service.py) │  │ Transaction,    │ │
│  └────────────┘  └──────────────┘  │ LedgerEntry     │ │
│                                    └────────┬────────┘ │
└─────────────────────────────────────────────┼───────────┘
                                              │ SQLAlchemy
                                              ▼
                                    ┌──────────────────┐
                                    │  PostgreSQL       │
                                    │  (Neon Cloud)     │
                                    └──────────────────┘
```

---

## Database Schema

```
users
  id, email (unique), password_hash, created_at

accounts
  id, user_id (FK), balance (NUMERIC 18,2), currency, created_at, updated_at

transactions
  id, source_account_id (FK), destination_account_id (FK),
  amount, status (ENUM), idempotency_key (unique), created_at

ledger_entries
  id, transaction_id (FK), account_id (FK),
  entry_type (DEBIT/CREDIT), amount, created_at
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register with email + password |
| POST | `/auth/login` | No | Login → returns JWT |
| GET | `/accounts` | Bearer JWT | List all accounts of the logged-in user |
| POST | `/accounts` | Bearer JWT | Create a new account (currency defaults to INR) |
| GET | `/accounts/{id}` | Bearer JWT | Get account details |
| GET | `/accounts/{id}/balance` | Bearer JWT | Get account balance |
| POST | `/transactions/transfer` | Bearer JWT | Transfer funds (optional `Idempotency-Key` header) |
| GET | `/transactions/history` | Bearer JWT | List all user transactions |
| GET | `/transactions/{id}` | Bearer JWT | Get single transaction detail |
| GET | `/` | No | Health check |

---

## Transfer Flow (Core Logic)

```
POST /transactions/transfer
  1. Verify source account ownership (403 if not owner)
  2. Check idempotency_key — if seen before, return cached result
  3. Acquire row-level locks in deterministic order (prevents deadlocks)
     → LOWER account ID locked first, always
  4. Validate sufficient balance on source account
  5. Debit source account  (-amount)
  6. Credit destination account (+amount)
  7. Create Transaction record (status=COMPLETED)
  8. Create 2 LedgerEntry records (DEBIT + CREDIT)
  9. Commit — all 6 DB writes are atomic
 10. Log: transaction_id, amount, latency_ms
```

---

## How to Run Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- A PostgreSQL database (local or cloud — e.g. [Neon](https://neon.tech))

### 1. Clone the repo
```bash
git clone https://github.com/Nikhil7704/transaction-pipeline.git
cd transaction-pipeline
```

### 2. Create virtual environment & install dependencies
```bash
python -m venv venv
# Windows:
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your DATABASE_URL, SECRET_KEY etc.
```

### 4. Run migrations & seed accounts
```bash
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe seed.py
```

### 5. Start the backend
```bash
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

### 6. Start the frontend
```bash
cd frontend
npm install
npm run dev
```

- Backend runs at `http://127.0.0.1:8000`
- Frontend runs at `http://localhost:5173`
- Interactive Swagger docs at `http://127.0.0.1:8000/docs`

---

## Running Tests

```bash
.\venv\Scripts\python.exe -m pytest tests/ -v
```

Test coverage:
- `test_auth.py` — register, duplicate email, login, wrong password
- `test_accounts.py` — create account, get balance
- `test_transactions.py` — successful transfer, insufficient balance, idempotency
- `test_concurrency.py` — 100 concurrent transfers stress test

---

## Project Structure

```
transaction-pipeline/
├── app/
│   ├── api/
│   │   ├── auth.py          # Register + Login endpoints
│   │   ├── accounts.py      # Account CRUD (list, create, get, balance)
│   │   └── transactions.py  # Transfer + History endpoints
│   ├── core/
│   │   ├── security.py      # bcrypt hashing, JWT creation
│   │   └── dependencies.py  # get_current_user dependency
│   ├── db/
│   │   └── database.py      # Engine, SessionLocal, connection pool
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── services/
│   │   └── transaction_service.py  # Core transfer logic
│   └── main.py              # FastAPI app, CORS, router registration
├── alembic/                 # Database migrations
├── frontend/                # React 18 + Vite frontend
│   └── src/
│       ├── pages/           # Login, Dashboard, Accounts, Transfer, History
│       ├── components/      # Navbar, ProtectedRoute
│       ├── context/         # AuthContext (JWT state)
│       └── api/client.js    # Axios instance with JWT interceptor
├── tests/                   # Pytest test suite
├── seed.py                  # Dummy data seeder
├── requirements.txt
├── .env.example
└── README.md
```

---

## Key Design Decisions

**Why PostgreSQL?**  
Row-level locking (`SELECT FOR UPDATE`) and ACID transactions are first-class features. SQLite cannot handle concurrent writes safely.

**Why no Redis?**  
Idempotency is enforced at the DB layer via a `UNIQUE` constraint on `idempotency_key`. For this scale, an extra cache layer adds complexity without benefit.

**Why deterministic lock ordering?**  
When two concurrent transfers involve the same two accounts in opposite directions, both would try to lock the same rows in opposite orders — causing a deadlock. Always locking the lower account ID first breaks the cycle.

**Why double-entry ledger?**  
Every financial system needs an audit trail. The ledger makes it trivial to reconstruct any account's balance history and verify that money was never created or destroyed.
