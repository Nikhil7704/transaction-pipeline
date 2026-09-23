# High-Throughput Transaction Pipeline

A backend system for processing concurrent financial transactions with correctness guarantees, built to demonstrate how a backend engineer thinks about **concurrency, reliability, and data integrity**.

---

## What Does It Do?

The system allows users to:

1. **Register** and **authenticate** using JWT tokens
2. **Create accounts** with a specified currency
3. **View account balances**
4. **Transfer money** between accounts
5. **View transaction history** and individual transaction details

The interesting part is not the CRUD — it's ensuring that **account balances remain correct even when many transfers hit the same account at the same time**.

### The Core Problem

```
Initial Balance = ₹1,000

Request 1: Transfer ₹700     (reads balance → ₹1,000 → approves)
Request 2: Transfer ₹700     (reads balance → ₹1,000 → approves)

Result: ₹1,400 spent from a ₹1,000 account ← This must never happen
```

This project solves that using PostgreSQL transactions, row-level locking, and idempotency — without overengineering the infrastructure.

---

## Tech Stack

| Technology   | Purpose                                                    |
|--------------|------------------------------------------------------------|
| **Python**   | Core language for all business logic                       |
| **FastAPI**  | REST API framework with automatic validation and docs      |
| **PostgreSQL** | Primary database — source of truth for all financial data |
| **SQLAlchemy** | ORM for database interaction                              |
| **Alembic**  | Database migration management                              |
| **Pydantic** | Request/response validation with type safety               |
| **PyJWT**    | JSON Web Token authentication                              |
| **bcrypt**   | Secure password hashing                                    |
| **Pytest**   | Unit, integration, and concurrency testing                 |

---

## Architecture

```
transaction-pipeline/
├── app/
│   ├── main.py                  # FastAPI application entry point
│   ├── api/
│   │   ├── auth.py              # POST /auth/register, POST /auth/login
│   │   ├── accounts.py          # POST /accounts, GET /accounts/{id}, GET /accounts/{id}/balance
│   │   └── transactions.py      # POST /transactions/transfer, GET /transactions/history
│   ├── core/
│   │   ├── security.py          # Password hashing, JWT creation
│   │   └── dependencies.py      # get_current_user auth dependency
│   ├── db/
│   │   └── database.py          # SQLAlchemy engine, session, Base
│   ├── models/
│   │   ├── user.py              # User table
│   │   ├── account.py           # Account table (NUMERIC balance)
│   │   ├── transaction.py       # Transaction table with idempotency_key
│   │   └── ledger.py            # Ledger entries (double-entry bookkeeping)
│   ├── schemas/
│   │   ├── auth.py              # UserCreate, Token
│   │   ├── account.py           # AccountCreate, AccountResponse
│   │   └── transaction.py       # TransferRequest, TransferResponse
│   └── services/
│       └── transaction_service.py  # Core transfer logic with locking
├── tests/
│   ├── conftest.py              # Test fixtures and DB setup
│   ├── test_auth.py             # Auth endpoint tests
│   ├── test_accounts.py         # Account endpoint tests
│   ├── test_transactions.py     # Transfer, idempotency tests
│   └── test_concurrency.py      # 100 concurrent transfer stress test
├── alembic/                     # Database migrations
├── .env.example                 # Environment variable template
├── requirements.txt
└── README.md
```

### Request Flow

```
Client Request
      │
      ▼
 ┌──────────┐
 │ FastAPI   │ ← Route matching, Pydantic validation
 └────┬─────┘
      │
      ▼
 ┌──────────┐
 │   Auth   │ ← JWT verification via get_current_user dependency
 └────┬─────┘
      │
      ▼
 ┌──────────────────────┐
 │  Transaction Service  │
 │                       │
 │  1. Check idempotency │ ← Has this request been processed before?
 │  2. BEGIN transaction  │
 │  3. Lock account rows  │ ← SELECT ... FOR UPDATE (deterministic order)
 │  4. Validate balance   │
 │  5. Debit source       │
 │  6. Credit destination │
 │  7. Create TX record   │
 │  8. Create ledger      │
 │  9. COMMIT             │
 └───────────┬───────────┘
             │
             ▼
      ┌─────────────┐
      │ PostgreSQL   │ ← Single source of truth
      │              │
      │ users        │
      │ accounts     │
      │ transactions │
      │ ledger       │
      └─────────────┘
```

---

## Database Schema

### users
| Column        | Type        | Notes                   |
|---------------|-------------|-------------------------|
| id            | INTEGER     | Primary key             |
| email         | VARCHAR     | Unique, indexed         |
| password_hash | VARCHAR     | bcrypt hashed           |
| created_at    | TIMESTAMP   | Auto-generated          |

### accounts
| Column     | Type          | Notes                          |
|------------|---------------|--------------------------------|
| id         | INTEGER       | Primary key                    |
| user_id    | INTEGER       | FK → users.id                  |
| balance    | NUMERIC(18,2) | Fixed-precision, never float   |
| currency   | VARCHAR(3)    | e.g. INR, USD                  |
| created_at | TIMESTAMP     | Auto-generated                 |
| updated_at | TIMESTAMP     | Auto-updated on modification   |

### transactions
| Column                 | Type          | Notes                              |
|------------------------|---------------|-------------------------------------|
| id                     | INTEGER       | Primary key                         |
| source_account_id      | INTEGER       | FK → accounts.id                    |
| destination_account_id | INTEGER       | FK → accounts.id                    |
| amount                 | NUMERIC(18,2) | Transfer amount                    |
| status                 | VARCHAR       | PENDING / COMPLETED / FAILED        |
| idempotency_key        | VARCHAR       | Unique, prevents duplicate requests |
| created_at             | TIMESTAMP     | Auto-generated                      |

### ledger_entries
| Column         | Type          | Notes                    |
|----------------|---------------|--------------------------|
| id             | INTEGER       | Primary key              |
| transaction_id | INTEGER       | FK → transactions.id     |
| account_id     | INTEGER       | FK → accounts.id         |
| entry_type     | VARCHAR(10)   | DEBIT or CREDIT          |
| amount         | NUMERIC(18,2) | Entry amount             |
| created_at     | TIMESTAMP     | Auto-generated           |

---

## API Endpoints

### Authentication

| Method | Endpoint          | Description           | Auth |
|--------|-------------------|-----------------------|------|
| POST   | `/auth/register`  | Register a new user   | No   |
| POST   | `/auth/login`     | Login, receive JWT    | No   |

### Accounts

| Method | Endpoint                 | Description          | Auth |
|--------|--------------------------|----------------------|------|
| POST   | `/accounts`              | Create new account   | Yes  |
| GET    | `/accounts/{id}`         | Get account details  | Yes  |
| GET    | `/accounts/{id}/balance` | Get account balance  | Yes  |

### Transactions

| Method | Endpoint                  | Description                | Auth | Headers              |
|--------|---------------------------|----------------------------|------|----------------------|
| POST   | `/transactions/transfer`  | Transfer money             | Yes  | Idempotency-Key (optional) |
| GET    | `/transactions/history`   | View transaction history   | Yes  |                      |
| GET    | `/transactions/{id}`      | Get transaction details    | Yes  |                      |

---

## Key Engineering Concepts

### 1. ACID Transactions

A transfer involves multiple database writes:

```
Debit source account
Credit destination account
Create transaction record
Create ledger entries (DEBIT + CREDIT)
```

All of these happen inside a single PostgreSQL transaction. If **any** step fails, **everything** is rolled back — the source account is never debited without the destination being credited.

### 2. Row-Level Locking (Preventing Race Conditions)

When processing a transfer, the relevant account rows are locked using:

```sql
SELECT * FROM accounts
WHERE id IN (:source_id, :destination_id)
ORDER BY id
FOR UPDATE;
```

This tells PostgreSQL: *"Lock these rows until my transaction finishes."* Any other transaction trying to modify the same accounts must wait. This prevents two concurrent transfers from reading the same stale balance and both succeeding when only one should.

### 3. Deadlock Prevention

Without ordering, two concurrent transfers could deadlock:

```
Transfer A→B: Locks A, then tries to lock B
Transfer B→A: Locks B, then tries to lock A
← Both waiting on each other forever
```

We prevent this by **always acquiring locks in ascending account ID order**, regardless of transfer direction. Both transfers above would lock the lower ID first.

### 4. Idempotency

Network failures can cause clients to retry a request without knowing if it already succeeded:

```
Client → Transfer ₹2,000 → Server processes it → Network timeout
Client doesn't know the result → Retries the same request
```

Without idempotency, the user gets charged twice. With idempotency:

- The client sends an `Idempotency-Key` header with each request
- If the backend has already processed a request with that key, it returns the **original result** instead of creating a new transaction
- Enforced at the database level with a unique constraint

### 5. Double-Entry Ledger

Every transaction creates two ledger entries:

```
Transaction #1001

Account A → DEBIT  ₹2,000
Account B → CREDIT ₹2,000
```

This provides a complete audit trail and mirrors how real financial systems track money movement.

### 6. Why NUMERIC and Not Float?

```python
>>> 0.1 + 0.2
0.30000000000000004
```

Floating-point arithmetic introduces rounding errors that are unacceptable for money. PostgreSQL's `NUMERIC(18,2)` stores values with **exact decimal precision**.

---

## How to Run

### Prerequisites

- Python 3.11+
- PostgreSQL running locally

### Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/transaction-pipeline.git
cd transaction-pipeline

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Configure

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your PostgreSQL credentials
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/transaction_pipeline
```

Create the databases in PostgreSQL:

```sql
CREATE DATABASE transaction_pipeline;
CREATE DATABASE transaction_pipeline_test;
```

### Run Migrations

```bash
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

### Start the Server

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://127.0.0.1:8000` and interactive Swagger docs at `http://127.0.0.1:8000/docs`.

---

## How to Test

```bash
# Run all tests
pytest -v

# Run specific test files
pytest tests/test_auth.py -v
pytest tests/test_transactions.py -v
pytest tests/test_concurrency.py -v
```

### The Concurrency Test

This is the most important test in the project:

```
Setup:
  Account A = ₹100,000
  Account B = ₹0

Action:
  Fire 100 concurrent HTTP requests
  Each transfers ₹1,000 from A → B

Expected:
  Account A = ₹0
  Account B = ₹100,000
  Exactly 100 successful transactions
  No negative balance
  No lost update
  No duplicate transaction
```

If the locking mechanism is broken, the balances will be inconsistent. This test proves they aren't.

---

## Why No Redis / Kafka / Microservices?

This project intentionally keeps the infrastructure minimal:

- **PostgreSQL alone** handles caching, idempotency, and all data operations at this scale
- Adding Redis for caching would introduce infrastructure complexity without measurable benefit
- Adding message queues or breaking into microservices would add distributed systems problems without solving any actual bottleneck

The goal is to demonstrate **engineering depth with a small surface area**, not to add technologies for the sake of listing them. If scale demanded it, a caching layer or message queue could be introduced — but only when PostgreSQL becomes the bottleneck, which it won't at this scale.

---

## What This Project Demonstrates

- REST API design with proper HTTP status codes and validation
- JWT authentication and authorization (account ownership checks)
- PostgreSQL ACID transactions for financial correctness
- Row-level locking to handle concurrent requests safely
- Deadlock prevention through deterministic lock ordering
- Idempotent API design to handle retries safely
- Fixed-precision arithmetic for monetary values
- Double-entry bookkeeping with a ledger table
- Structured logging with transaction metadata
- Layered architecture with separation of concerns
- Automated testing including concurrency stress tests

---

## License

MIT
