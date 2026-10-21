# High-Throughput Transaction Pipeline

A production-grade financial transaction processing engine built with **FastAPI**, **PostgreSQL**, and **React**. Designed to demonstrate how to handle **concurrency, race conditions, ACID guarantees, idempotency, and double-entry bookkeeping** without overengineering the infrastructure.

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
1. Open the web app at **[http://localhost:5173/login](http://localhost:5173/login)**
2. Sign in as `alice@transactiq.com` / `alice123`
3. Click **Transfer** in the top navigation
4. Transfer **₹500.00** from Account **#1** to Account **#2** (Bob)
5. Sign out and log in as `bob@transactiq.com` / `bob123` — see Bob's balance updated to **₹2,500.00**
6. Click into the transaction in **History** to inspect the **Idempotency Key**, timestamp, and status.

---

## The Core Problem

When handling financial transactions, standard CRUD operations fail under concurrent load:

```
Initial Balance = ₹1,000

Thread 1: Transfer ₹700   ──► Reads balance: ₹1,000 ──► Approves
Thread 2: Transfer ₹700   ──► Reads balance: ₹1,000 ──► Approves

Result: ₹1,400 spent from an account with only ₹1,000! ❌ (Lost Update / Double Spend)
```

This project eliminates race conditions, deadlocks, and duplicate transfers using **PostgreSQL row-level locking (`SELECT FOR UPDATE`)**, **deterministic lock ordering**, and **unique idempotency keys**.

---

## Key Engineering Guarantees

| Guarantee | How It Is Implemented |
|---|---|
| **ACID Atomicity** | Every transfer executes in a single database transaction — balance debits, credits, transaction creation, and ledger writes commit together or rollback completely. |
| **Race Condition Prevention** | PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) are acquired on both accounts before checking balances or performing math. |
| **Deadlock Prevention** | Accounts are always locked in ascending ID order (`min(id)` first, then `max(id)`), eliminating cyclic wait conditions. |
| **Idempotency** | Clients pass an `Idempotency-Key` UUID. A database unique constraint ensures identical requests return cached results and never execute twice. |
| **Auditability (Double-Entry)** | Every transaction writes two immutable `ledger_entries`: one DEBIT and one CREDIT, guaranteeing zero money creation/destruction. |
| **Currency Precision** | All balances use `NUMERIC(18, 2)` — floating-point rounding errors are strictly avoided. |
| **Connection Pooling** | SQLAlchemy connection pool (`pool_size=20`, `max_overflow=30`) configured to handle burst concurrent load. |
| **Structured Logging** | Every transfer logs `transaction_id`, accounts involved, amount, and `latency_ms`. |

---

## Tech Stack

### Backend
- **FastAPI** — high-performance Python framework with native async support and OpenAPI docs
- **SQLAlchemy 2.x** — ORM providing row-level locking (`with_for_update`) and connection pooling
- **PostgreSQL (Neon)** — cloud-hosted serverless PostgreSQL with ACID compliance
- **Alembic** — database migration engine
- **bcrypt** — secure salted password hashing
- **PyJWT** — stateless JSON Web Token (HS256) auth with 30-minute expiration
- **Pydantic v2** — strict request validation and response serialization
- **Pytest + AnyIO** — test suite including async concurrency stress testing

### Frontend
- **React 18** + **Vite** — responsive client with fast HMR
- **React Router v6** — client-side routing with `ProtectedRoute` guards
- **Axios** — HTTP client configured with JWT auto-injection interceptors
- **Custom Modern Theme** — bespoke dark theme UI, zero bulky third-party component libraries

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    React Web Frontend                        │
│   (Overview / Wallets / Money Transfer / Audit History)       │
└──────────────────────────────┬───────────────────────────────┘
                               │ Bearer JWT + Idempotency-Key
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     FastAPI Application                      │
│                                                              │
│  ┌─────────────────┐   ┌─────────────────┐   ┌────────────┐  │
│  │   Auth Router   │   │ Accounts Router │   │ TX Router  │  │
│  └────────┬────────┘   └────────┬────────┘   └─────┬──────┘  │
│           │                     │                  │         │
│           ▼                     ▼                  ▼         │
│   JWT Dependencies      Ownership Check     Transfer Engine  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               Transaction Service Layer                │  │
│  │                                                        │  │
│  │   1. Check Idempotency Key in Database                 │  │
│  │   2. Begin DB Transaction                              │  │
│  │   3. Sort account IDs: lock lower ID first             │  │
│  │   4. SELECT ... FOR UPDATE (Row-level lock)            │  │
│  │   5. Verify source has sufficient balance              │  │
│  │   6. Debit Source Account (-amount)                    │  │
│  │   7. Credit Destination Account (+amount)              │  │
│  │   8. Insert Transaction (COMPLETED)                    │  │
│  │   9. Insert 2x Ledger Entries (DEBIT + CREDIT)         │  │
│  │  10. COMMIT & Log Latency                              │  │
│  └───────────────────────────┬────────────────────────────┘  │
└──────────────────────────────┼───────────────────────────────┘
                               │ SQLAlchemy Pool (20 + 30)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                 PostgreSQL (Neon Cloud)                      │
│   users  │  accounts  │  transactions  │  ledger_entries     │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Schema & Models

### `users`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` | Primary Key, Index | Unique user ID |
| `email` | `VARCHAR` | Unique, Index, Not Null | User login email |
| `password_hash` | `VARCHAR` | Not Null | bcrypt hash |
| `created_at` | `TIMESTAMP` | Default `NOW()` | Registration timestamp |

### `accounts`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` | Primary Key, Index | Account number |
| `user_id` | `INTEGER` | Foreign Key → `users.id`, Index | Account owner |
| `balance` | `NUMERIC(18,2)` | Not Null, Default `0.00` | Account balance |
| `currency` | `VARCHAR(3)` | Default `'INR'` | Currency code (INR, USD, etc.) |
| `created_at` | `TIMESTAMP` | Default `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | On Update `NOW()` | Last modified timestamp |

### `transactions`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` | Primary Key, Index | Unique transaction reference |
| `source_account_id` | `INTEGER` | Foreign Key → `accounts.id`, Index | Sender account |
| `destination_account_id` | `INTEGER` | Foreign Key → `accounts.id`, Index | Receiver account |
| `amount` | `NUMERIC(18,2)` | Not Null | Amount transferred |
| `status` | `VARCHAR` | Not Null | `PENDING`, `COMPLETED`, `FAILED` |
| `idempotency_key` | `VARCHAR` | Unique, Index | Client idempotency UUID |
| `created_at` | `TIMESTAMP` | Default `NOW()` | Execution timestamp |

### `ledger_entries`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` | Primary Key, Index | Ledger entry ID |
| `transaction_id` | `INTEGER` | Foreign Key → `transactions.id`, Index | Associated transaction |
| `account_id` | `INTEGER` | Foreign Key → `accounts.id`, Index | Affected account |
| `entry_type` | `VARCHAR(10)` | Not Null | `DEBIT` or `CREDIT` |
| `amount` | `NUMERIC(18,2)` | Not Null | Entry amount |
| `created_at` | `TIMESTAMP` | Default `NOW()` | Timestamp |

---

## Detailed Engineering Concepts

### 1. Row-Level Locking (`SELECT FOR UPDATE`)
To avoid dirty reads and lost updates during concurrent requests, accounts are locked at the database level:
```python
# Acquire locks on both accounts simultaneously
accounts = (
    db.query(Account)
    .filter(Account.id.in_([first_id, second_id]))
    .with_for_update()
    .all()
)
```
Any competing transaction targeting either account is queued by PostgreSQL until the active transaction issues a `COMMIT` or `ROLLBACK`.

### 2. Deadlock Prevention via Deterministic Ordering
When two transfers happen concurrently between the same accounts in opposite directions:
- Request 1: Account 1 ➔ Account 2
- Request 2: Account 2 ➔ Account 1

If Request 1 locks Account 1 and waits for Account 2, while Request 2 locks Account 2 and waits for Account 1, a **deadlock** occurs.

**Solution:** Always acquire locks in ascending order by account ID:
```python
first_id, second_id = sorted([source_id, destination_id])
# Always lock first_id before second_id
```
Both threads attempt to lock Account 1 first. The second thread blocks cleanly before holding any conflicting locks, completely eliminating the deadlock.

### 3. Idempotency Under Network Retries
If a client experiences a timeout after sending a transfer:
```
Client  ──[ POST /transfer (₹500, Key: "uuid-123") ]──►  Server (Processed in DB)
Client  ◄──[ Network Disconnect / Timeout ]────────────── Server
Client  ──[ Retry POST /transfer (₹500, Key: "uuid-123") ]──► Server
```
- The backend checks if a transaction with `idempotency_key == "uuid-123"` exists.
- If found, it immediately returns the original response with HTTP 200 without executing the transfer a second time.
- The unique database index on `idempotency_key` guarantees that even two identical requests arriving simultaneously cannot both write to the table.

### 4. Double-Entry Bookkeeping
Money must never appear or disappear from thin air. Every transaction creates matching debit and credit entries:
```
Transaction #101: Transfer ₹500 from Account #1 to Account #2
  Ledger Entry 1: Account #1 ➔ DEBIT  ₹500.00
  Ledger Entry 2: Account #2 ➔ CREDIT ₹500.00
  Net Sum = ₹0.00 (Balanced)
```

---

## API Endpoints Reference

| Method | Endpoint | Auth | Headers | Description |
|---|---|---|---|---|
| `POST` | `/auth/register` | Public | — | Register new user (`email`, `password`) |
| `POST` | `/auth/login` | Public | — | Authenticate user, returns Bearer JWT |
| `GET` | `/accounts` | Bearer JWT | — | List all accounts owned by current user |
| `POST` | `/accounts` | Bearer JWT | — | Create account (`currency` defaults to `'INR'`) |
| `GET` | `/accounts/{id}` | Bearer JWT | — | Retrieve account details (ownership enforced) |
| `GET` | `/accounts/{id}/balance` | Bearer JWT | — | Retrieve account balance |
| `POST` | `/transactions/transfer` | Bearer JWT | `Idempotency-Key` (opt) | Execute transfer (`source`, `destination`, `amount`) |
| `GET` | `/transactions/history` | Bearer JWT | — | List all transactions for user's accounts |
| `GET` | `/transactions/{id}` | Bearer JWT | — | Get single transaction detail |
| `GET` | `/` | Public | — | Health check |

---

## Concurrency Testing (The Stress Test)

The project includes an automated stress test ([`tests/test_concurrency.py`](file:///d:/Transaction%20pipeline/tests/test_concurrency.py)) to verify database-level correctness:

```
Test Setup:
  Account A balance = ₹100,000.00
  Account B balance = ₹0.00

Test Action:
  Fire 100 concurrent async HTTP transfer requests (₹1,000.00 each) from A to B.

Verification:
  - Account A final balance = ₹0.00
  - Account B final balance = ₹100,000.00
  - Exactly 100 transactions recorded
  - No negative balance, no lost update, zero duplicate transactions
```

---

## How to Run Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL database (local or cloud instance like [Neon](https://neon.tech))

### 1. Clone the repository
```bash
git clone https://github.com/Nikhil7704/transaction-pipeline.git
cd transaction-pipeline
```

### 2. Backend Setup
```bash
python -m venv venv

# Windows:
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
TEST_DATABASE_URL=postgresql://user:password@host/dbname_test?sslmode=require
SECRET_KEY=your-super-secret-key-12345
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### 4. Database Migrations & Seeding
```bash
# Run migrations
.\venv\Scripts\python.exe -m alembic upgrade head

# Seed dummy accounts (Alice, Bob, Charlie, Diana with ₹2,000 each)
.\venv\Scripts\python.exe seed.py
```

### 5. Start Servers
```bash
# Terminal 1 — Backend (http://127.0.0.1:8000)
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

### 6. Run Automated Tests
```bash
.\venv\Scripts\python.exe -m pytest tests/ -v
```

---

## Architectural FAQ & Design Decisions

#### Why not use Redis or Kafka?
For systems processing hundreds to low thousands of transactions per second, PostgreSQL alone with row-level locks and connection pooling is faster, strictly ACID-compliant, and simpler to operate. Introducing message brokers or caches for core account balances introduces cache invalidation challenges, eventual consistency, and distributed failure modes without solving a real bottleneck at this scale.

#### Why NUMERIC instead of Float?
IEEE 754 floating-point numbers cannot accurately represent decimals like `0.1` or `0.2` (`0.1 + 0.2 = 0.30000000000000004`). In financial systems, accumulated rounding errors cause balance drift. `NUMERIC(18, 2)` stores exact decimal values with arbitrary precision.

#### How does connection pooling protect the database?
SQLAlchemy's QueuePool manages pre-warmed database connections (`pool_size=20`, `max_overflow=30`). This prevents sudden traffic spikes from exhausting PostgreSQL process limits while reusing connections efficiently.

---

## License
MIT
