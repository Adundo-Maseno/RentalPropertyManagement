# BomaSphere Property Management System (PMS)

[![Deployment Status](https://img.shields.io/badge/Cloudflare_Pages-Live_Production-059669?style=flat&logo=cloudflare)](https://rentalpropertymanagement.pages.dev/)
[![PWA](https://img.shields.io/badge/PWA-Installable_Native_App-blue?style=flat&logo=pwa)](https://rentalpropertymanagement.pages.dev/)
[![Security RBAC](https://img.shields.io/badge/Security-5--Tier_Strict_RBAC-success?style=flat&logo=shield)](https://rentalpropertymanagement.pages.dev/)
[![Tests](https://img.shields.io/badge/Tests-31%2F31_Passed-brightgreen?style=flat)](https://github.com/Adundo-Maseno/RentalPropertyManagement)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B_Zero_Dependencies-339933?style=flat&logo=node.js)](https://nodejs.org/)

> **Next-Generation Real Estate & Property Management Platform**  
> *Combining the localized financial power of **BomaHut** (M-Pesa STK push, water sub-metering, fundi tracking) with the enterprise architecture of **AppFolio**, **Buildium**, and **DoorLoop**.*

🌐 **Live Production URL:** [https://rentalpropertymanagement.pages.dev/](https://rentalpropertymanagement.pages.dev/)

---

## 🔑 Pre-Seeded Test Logins (RBAC Personas)

BomaSphere enforces strict **Role-Based Access Control (RBAC)** across both the API routes and UI views. You can log in using either the **One-Click Persona Switcher** in the UI or by entering these credentials in the login dialog:

| Role | Persona Name | Email | Password | Default Scope & Boundary |
|---|---|---|---|---|
| **Super Admin** | Sarah Cherono | `admin@bomasphere.co.ke` | `Admin@2026` *(or `password123`)* | Full unconstrained platform authority across all portfolios, financial ledgers, system settings, user provisioning, and audit logs. |
| **Property Manager** | Patrick Ndegwa | `ndegwa@crownpeak.co.ke` | `Manager@2026` *(or `password123`)* | Portfolio management, automated batch billing, M-Pesa STK push triggering, water logging, landlord remittances, expenses, and tenant management. |
| **Site Caretaker** | John Otieno | `otieno.caretaker@kilimaniheights.ke` | `Caretaker@2026` *(or `password123`)* | Scoped to Kilimani Royal Heights. Access to water meter logging, maintenance work orders, and broadcast notices. **Strictly blocked (403)** from financial ledgers and invoicing. |
| **Landlord / Investor** | Dr. Esther Wambui Ndung'u | `esther.ndungu@gmail.com` | `Landlord@2026` *(or `password123`)* | Scoped to Riverside Green Court. Access to owner statements, monthly remittance breakdowns, unit occupancy, and asset maintenance reports. |
| **Resident Tenant** | Kariuki James Mwangi | `james.kariuki@techke.com` | `Tenant@2026` *(or `password123`)* | Scoped strictly to Unit A101 (Tenant ID #1). Resident self-service portal, view itemized rent bills, trigger instant Lipa Na M-Pesa STK payments, and log repair tickets. |

> 💡 **Production Sign In & Role Switching:** To sign in or switch roles, authenticate with the respective email & password. Use the **Sign Out** button in the sidebar footer or top header to end the active session and return to the login interface.

---

## 🌟 Core Modules & Capabilities

### 🇰🇪 1. Localized Kenyan & African Real Estate Financials
- **Lipa Na M-Pesa STK Push Gateway & Direct Bank Feeds**:
  - Direct processing of Safaricom Daraja API STK Push (`/api/payments`).
  - Sends instant payment notification prompts to tenant phone numbers (`+254...`).
  - Automatic reconciliation: matches reference codes (e.g. `QGEH2RMXPC`), deducts tenant arrears, clears overdue balances, and issues printable receipt vouchers.
  - Multi-bank remittance support for KCB Bank, Equity Bank, Co-operative Bank, ABSA, and NCBA.
- **Water Sub-Metering & Tariff Calculation Engine**:
  - Sub-meter tracking with previous/current readings in cubic meters ($m^3$).
  - Configurable tariff calculations (e.g., KES 175.00/$m^3$).
  - Automatically injects itemized water utility line-items into monthly consolidated invoices alongside base rent, service charges, and garbage fees.
- **Automated SMS & Notice Dispatcher**:
  - Automated 5th-of-the-month electronic rent reminders.
  - Automated instant SMS receipts upon payment reconciliation.
  - Estate-wide broadcast notices (borehole servicing, lift preventive maintenance, power outages).

### 🌍 2. Enterprise Property Management Architecture
- **Executive KPI Dashboard**:
  - Real-time occupancy rate, gross billed vs. collections, aging arrears, and open work order counts.
  - Interactive Chart.js monthly collection trend graphs and occupancy doughnut breakdowns.
  - Live activity feeds for incoming mobile money payments and urgent maintenance work orders.
- **Double-Entry Batch Invoicing Engine**:
  - One-click batch billing engine (`/api/invoices/generate-monthly`).
  - Transparent itemization: Base Rent + Water Meter Charges + Service Charge + Garbage Fee + Late Penalties.
  - Printable official invoices formatted for print or PDF export.
- **Maintenance & Contractor Dispatch (Kanban Lifecycle)**:
  - Ticket progression: `Reported` ➔ `Fundi Assigned` ➔ `In Progress` ➔ `Completed`.
  - Fundi/contractor dispatch with contractor phone contacts and estimated vs. actual repair cost tracking.
- **Landlord Remittance & Owner Statements**:
  - Automatically calculates: `Gross Rent Collections` − `Management Commission %` − `Approved Operating Expenses` = `Net Landlord Payout`.
  - Formal printable Landlord Statement for owner distributions.
- **Resident Self-Service Portal**:
  - Dedicated tenant view allowing residents to track current balances, trigger M-Pesa payments, and file maintenance requests.

### 📱 3. Mobile-First Progressive Web App (PWA)
- **Installable Native App**: Standalone display mode with Web App Manifest (`manifest.json`), service worker (`sw.js`), and high-resolution vector and maskable PNG icons (192px, 512px, Apple Touch icon).
- **Native Bottom Tab Navigation**: Thumb-friendly mobile bottom bar (`Home`, `Units`, `Billing`, `Payments`, `More`) with safe-area insets (`env(safe-area-inset-bottom)`).
- **Off-Canvas Slide Drawer**: Hardware-accelerated mobile drawer for full module access without screen clutter.
- **Bottom Sheet Modals**: Dialogs automatically convert into iOS/Android bottom sheets on mobile viewports.
- **Multi-Theme Suite & Dark Mode**:
  - **Swiss Minimal** (Ultra-clean typography, default monochrome)
  - **Savanna Emerald** (High-contrast emerald real estate palette)
  - **Warm Ivory** (Editorial warm parchment aesthetic)
  - **Obsidian Cyber** (Developer dark-only mode)

---

## 💡 5 High-Impact Recommended Next-Gen Features

1. **Automated WhatsApp Business API Interactive Gateway & Bot**:
   - Enable 2-way conversational interactions where tenants text *"Balance"* or *"Receipt"* to BomaSphere's WhatsApp Business number and immediately receive their statement PDF and an M-Pesa STK push.
   - Interactive message buttons for 1-tap maintenance reporting with photo/video uploads.

2. **AI-Powered Tenant Vetting & Financial Risk Scoring (CRB + M-Pesa OCR)**:
   - Automated OCR parsing of uploaded 6-month M-Pesa and bank statement PDFs to verify legitimate income consistency and detect tampered statements.
   - Direct API integration with Kenyan Credit Reference Bureaus (Metropol / TransUnion) to screen habitual rent defaulters before lease signing.

3. **Smart IoT Water & Electricity Telemetry (LoRaWAN / GSM Ultrasonic Meters)**:
   - Direct telemetry integration with smart ultrasonic pulse water meters and prepaid sub-meters.
   - Eliminates manual door-to-door meter reading on the 28th of every month.
   - Automated midnight leak detection alerts when water consumption is detected in vacant units between 1 AM and 5 AM.

4. **Multi-Property Owner Portal with KRA eTIMS & Withholding Tax (WHT) Automation**:
   - Automated electronic tax invoice signing via KRA eTIMS API for commercial and residential rent receipts.
   - Automatic Monthly Rental Income Tax (MRI at 7.5%) calculation and withholding tax deduction from owner payout schedules.

5. **Vendor & Artisan Marketplace with Milestone Escrow Payouts**:
   - Integrated network of vetted local fundis (plumbers, electricians, painters, carpenters) with tenant satisfaction ratings.
   - Escrow payouts: repair budgets are held and only disbursed via M-Pesa B2C once the tenant or caretaker confirms the repair with before/after photos.

---

## 🏗️ Technical Architecture & Tech Stack

```
BomaSphere PMS
├── Client (Browser & PWA)
│   ├── Vanilla JS (BomaSphereApp) + Tailwind CSS CDN + Chart.js + GSAP + Lucide Icons
│   ├── Stale-While-Revalidate Service Worker (sw.js - Cache v2)
│   └── Web App Manifest (manifest.json)
├── Cloudflare Global Edge Deployment (Serverless)
│   ├── functions/api/[[catchall]].js (Global Edge REST API router)
│   ├── public/_headers (Strict CSP, nosniff, cache headers)
│   └── public/_redirects (SPA routing fallback)
└── Local / Node.js Production Server
    ├── server.js (Zero-dependency native node:http & node:crypto server)
    └── db.js (High-performance native node:sqlite relational database)
```

- **Zero External npm Runtime Dependencies**: Built with native Node.js core modules (`node:http`, `node:sqlite`, `node:crypto`, `node:fs`, `node:path`).
- **Edge Deployment Ready**: Runs serverlessly across 300+ global Cloudflare locations with near-zero latency.
- **Enterprise Security**: Content Security Policy (CSP), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, parameterized SQL queries, and strict HTTP status boundaries (401/403/404).

---

## 🚀 Local Development & Testing

### 1. Prerequisites
- Node.js 22+ or Node.js 24+ installed.

### 2. Start the Local Server
```bash
node server.js
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run the Automated Direct Test Suite
To run all 31 integration, RBAC, authentication, and error-handling tests:
```bash
node test_suite.js
```

### 4. Build for Production / CI
```bash
node build.js
```
This syncs all `public/` web assets, security headers, and redirects to `dist/`.

---

## 📦 Cloudflare Pages Deployment Configuration

| Setting | Value |
|---|---|
| **Framework preset** | None / Static HTML |
| **Build command** | `node build.js` *(or leave blank)* |
| **Build output directory** | `public` *(or `dist`)* |
| **Edge Functions directory** | `functions/` *(auto-detected by Cloudflare)* |

---

## 📄 License
Commercial Real Estate SaaS — Proprietary & Confidential. Built for BomaSphere PMS.
