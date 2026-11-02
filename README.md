# BomaSphere Property Management System (PMS)

> **Next-Generation Property Management Platform**  
> *Combining the localized power of **BomaHut** (Kenya & East Africa) with the world-class architecture of **AppFolio**, **Buildium**, and **DoorLoop**.*

---

## 🌟 Overview & Key Differentiators

BomaSphere is built specifically to address the operational realities of landlords, estate managers, and residents. It merges specialized African mobile money and utility management workflows inspired by **BomaHut.com** with enterprise-grade accounting and maintenance automation modeled after **AppFolio**, **DoorLoop**, and **Buildium**.

### 🇰🇪 Specialized Regional Features (BomaHut Highlights)
- **Lipa Na M-Pesa STK Push Simulator & Direct Bank Feeds**:
  - Direct integration with Safaricom M-Pesa (Paybill & Buy Goods Till).
  - STK Push prompt simulation sending instant payment prompts straight to tenant mobile devices.
  - Automatic reconciliation: instantly matches reference codes (e.g., `QGH89X12KL`), deducts tenant arrears, updates the ledger, and sets invoice status to `paid`.
  - Integration support for KCB Bank, Equity Bank, Co-operative Bank, and NCBA.
- **Water Meter Utility Billing Engine**:
  - Sub-meter tracking (`Previous Reading`, `Current Reading`, `Consumption in m³`).
  - Configurable tariff calculations (e.g. KES 175.00/m³).
  - Direct automated line-item insertion into monthly rent invoices alongside service charges and garbage fees.
- **Automated SMS & WhatsApp Dispatcher**:
  - Electronic rent reminders sent before the 5th of the month.
  - Instant digital SMS payment receipts upon receipt of funds.
  - Overdue arrears alerts and estate broadcast announcements (e.g. borehole maintenance, power outage notices).

### 🌍 World-Class Enterprise Capabilities (AppFolio / DoorLoop / Buildium)
- **Executive Portfolio Dashboard**:
  - Live occupancy rate, gross billing vs. collections, and aging arrears tracking.
  - Chart.js monthly collection trend analysis and occupancy doughnut breakdowns.
  - Instant live activity feeds for incoming payments and priority maintenance work orders.
- **Double-Entry Rent Invoicing & Account Ledgers**:
  - One-click batch invoicing engine (`/api/invoices/generate-monthly`).
  - Clear breakdown: Base Rent, Water Meter Charges, Service Charge, Garbage Fee, Late Payment Penalties.
  - Printable official invoices with tenant details and payment QR/Paybill instructions.
- **Maintenance & Work Orders Lifecycle (Kanban Board)**:
  - Ticket progression: `Reported` ➔ `Fundi Assigned` ➔ `In Progress` ➔ `Completed`.
  - Priority management: `Emergency` (pulsing indicator), `High`, `Medium`, `Low`.
  - Contractor/Fundi dispatch with estimated vs. actual repair expense tracking.
- **Landlord Remittance & Owner Statements**:
  - Automatic computation: `Gross Rent Collections` minus `Agency Commission (e.g. 10%)` minus `Operating Expenses/Repairs` = `Net Owner Remittance`.
  - Printable/PDF-ready formal Landlord Statements for investor reporting.
- **Resident Self-Service Portal**:
  - Dedicated tenant perspective allowing residents to view outstanding invoices, trigger M-Pesa STK payments, download receipts, and submit maintenance tickets.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 22+ or Node.js 24+ (uses native `node:sqlite` and native `node:http` with **zero external dependencies** required).

### Running the System
To launch the server locally:
```bash
node server.js
```

Open your browser at:
```
http://localhost:3000
```

### Running the Integration Test Suite
To run the automated direct verification suite:
```bash
node test_suite.js
```

---

## 📊 Database Schema (`bomasphere.db`)

Built on high-performance SQLite via `node:sqlite`:

| Table | Purpose |
|---|---|
| `properties` | Portfolios, addresses, landlords, commission %, Paybill numbers, bank details |
| `units` | Unit numbers, types, base rent, service charge, garbage fee, status, meter numbers |
| `tenants` | Tenant profiles, phone numbers, National IDs/Passports, emergency contacts |
| `leases` | Lease duration, deposit amounts, monthly rent terms |
| `invoices` | Itemized bills (Rent, Water, Garbage, Service Charge, Late Fees, Balances) |
| `payments` | Transactions (Receipt numbers, M-Pesa codes, bank references, timestamps) |
| `water_readings` | Meter logs (Previous/Current m³, units consumed, tariff rate, total cost) |
| `maintenance_requests` | Work orders (Title, category, priority, fundi assignment, costs, status) |
| `communications` | Audit trail of all SMS and WhatsApp notices dispatched |
| `expenses` | Property operating expenses (Security, KPLC power tokens, caretaker salaries) |

---

## 🛠️ API Reference

- `GET /api/stats` — Overall portfolio metrics, collections, arrears, charts
- `GET /api/properties` & `POST /api/properties` — Property portfolio management
- `GET /api/units` & `POST /api/units` — Unit directory & leasing status
- `GET /api/tenants` & `POST /api/tenants` — Tenant management
- `GET /api/leases` & `POST /api/leases` — Lease contracts
- `GET /api/invoices` & `POST /api/invoices` — Invoicing & ledger
- `POST /api/invoices/generate-monthly` — One-click automated monthly billing engine
- `GET /api/payments` & `POST /api/payments` — M-Pesa STK push simulation & bank entry
- `GET /api/water-readings` & `POST /api/water-readings` — Water meter logging & calculations
- `GET /api/maintenance` & `POST /api/maintenance` & `PUT /api/maintenance/:id` — Work orders
- `GET /api/communications` & `POST /api/communications/broadcast` — SMS/WhatsApp dispatcher
- `GET /api/reports/landlord-statement` — Landlord owner remittance statement generator
- `POST /api/reset-seed` — Instant sample data reset

