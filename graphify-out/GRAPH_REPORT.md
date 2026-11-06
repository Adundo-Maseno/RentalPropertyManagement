# Graph Report - RentalPropertyManagement  (2026-11-06)

## Corpus Check
- 21 files · ~69,672 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 3, .ico 2, .example 1)

## Summary
- 321 nodes · 662 edges · 39 communities (14 shown, 25 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Backend & Database Infrastructure
- Core App State & RBAC Controller
- PWA Web App Manifest
- System Diagnostic & Portal Views
- Project Metadata & Node Modules
- Tenancy Lease & E-Sign Workflows
- SMS & WhatsApp Messaging Hub
- Cloudflare Edge Serverless Functions
- Gated Security & Visitor Passes
- Smart IoT & Utility Telemetry
- Frontend Application Bootstrap
- Estate Amenities & Clubhouse Bookings
- Rent Ledger & Batch Invoicing
- Maintenance Work Orders & Dispatch
- Move-In Condition Audits & Settlement
- Landlord Remittance & Expense Statements
- Artisan Marketplace & Fundi Escrow
- Diaspora Landlord Investment ROI
- KRA eTIMS Tax Compliance
- AI Tenant Vetting & CRB Scoring
- Public Viewing Leads & Prospect Tours
- PWA Service Worker & Offline Cache
- Operating Expense Entry Modal
- Property Asset Registration
- Resident Registration Form
- Unit Specifications Modal
- SaaS User Management
- Portfolio & Units Showcase
- Global Edge Runtime
- Native HTTP Server
- SQLite Database Storage

## God Nodes (most connected - your core abstractions)
1. `BomaSphereApp` - 161 edges
2. `handleRequest()` - 15 edges
3. `Authentication & Role Login Dialog` - 5 edges
4. `hashPassword()` - 4 edges
5. `scripts` - 4 edges
6. `Executive KPI Dashboard View` - 4 edges
7. `verifyPassword()` - 3 edges
8. `seedDatabase()` - 3 edges
9. `getAuthUser()` - 3 edges
10. `resolveRequestUser()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Generate Custom Billing Invoice Modal` --conceptually_related_to--> `Double-Entry Batch Invoicing Engine`  [INFERRED]
  public/index.html → README.md
- `Operating Expenses Management View` --conceptually_related_to--> `Landlord Remittance & Owner Statement System`  [INFERRED]
  public/index.html → README.md
- `Authentication & Role Login Dialog` --references--> `Super Admin Role (Sarah Cherono)`  [EXTRACTED]
  public/index.html → README.md
- `Authentication & Role Login Dialog` --references--> `Property Manager Role (Patrick Ndegwa)`  [EXTRACTED]
  public/index.html → README.md
- `Authentication & Role Login Dialog` --references--> `Site Caretaker Role (John Otieno)`  [EXTRACTED]
  public/index.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Multi-Tier SaaS Role-Based Access Control Flow** — readme_role_super_admin, readme_role_property_manager, readme_role_site_caretaker, readme_role_landlord, readme_role_resident_tenant, public_index_view_users, public_index_modal_auth_login [EXTRACTED 0.95]
- **Tenant Onboarding, Screening & Digital Lease Execution Lifecycle** — public_index_modal_add_tenant, public_index_modal_tenant_vetting, public_index_modal_create_lease, public_index_modal_lease_sign, public_index_modal_movein_payment_prompt, public_index_modal_new_inspection [INFERRED 0.90]
- **Water Sub-Metering & Automated Batch Invoicing Pipeline** — readme_water_submetering, public_index_modal_water_reading, readme_batch_invoicing, public_index_view_invoices, public_index_modal_custom_invoice, public_index_modal_send_5th_sms [EXTRACTED 0.92]
- **Lipa Na M-Pesa & Multi-Bank Payment Reconciliation Flow** — readme_mpesa_stk_gateway, public_index_modal_mpesa, public_index_modal_manual_payment, public_index_view_payments, public_index_view_invoices, readme_sms_dispatcher [EXTRACTED 0.95]
- **Higgsfield AI Cinematic Vacancy Syndication & Viewing Flow** — public_rentals_public_showcase, public_rentals_modal_higgsfield_tour, public_rentals_modal_viewing, public_rentals_higgsfield_camera_engine, public_index_view_higgsfield, public_index_view_tenants [EXTRACTED 0.92]

## Communities (39 total, 25 thin omitted)

### Community 0 - "Backend & Database Infrastructure"
Cohesion: 0.06
Nodes (36): distDir, fs, path, srcDir, crypto, { DatabaseSync }, db, DB_PATH (+28 more)

### Community 5 - "PWA Web App Manifest"
Cohesion: 0.11
Nodes (17): background_color, categories, description, dir, display, display_override, icons, id (+9 more)

### Community 6 - "System Diagnostic & Portal Views"
Cohesion: 0.13
Nodes (17): 404 Not Found Diagnostics View, 500 Server Error Incident View, Authentication & Role Login Dialog, Executive KPI Dashboard View, Higgsfield AI Virtual Tour Studio View, Resident Self-Service Portal View, RBAC Users & Roles Management View, Higgsfield AI Physics-Aware Camera Engine (+9 more)

### Community 8 - "Project Metadata & Node Modules"
Cohesion: 0.15
Nodes (12): author, description, keywords, license, main, name, scripts, build (+4 more)

### Community 10 - "Tenancy Lease & E-Sign Workflows"
Cohesion: 0.22
Nodes (9): Execute Tenancy Lease Modal, Digital Lease Agreement E-Sign Modal, Record Bank & Cash Payment Modal, Move-In Payment & Digital Lease Prompt Modal, Lipa Na M-Pesa STK Push Modal, Digital Leases & E-Signatures View, Payments & M-Pesa Hub View, Digital Lease Agreements & In-Browser E-Signatures (+1 more)

### Community 11 - "SMS & WhatsApp Messaging Hub"
Cohesion: 0.40
Nodes (5): Broadcast Tenant Notice Modal, 5th Due Automated SMS Dispatcher Modal, SMS & Communications Hub View, Automated SMS & Notice Dispatcher, WhatsApp Business API Interactive Gateway

### Community 12 - "Cloudflare Edge Serverless Functions"
Cohesion: 0.67
Nodes (3): DB, onRequest(), resolveRequestUser()

### Community 14 - "Gated Security & Visitor Passes"
Cohesion: 0.50
Nodes (4): Issue Visitor Gate Pass Modal, Gate Barrier Security Scanner Modal, Visitor Gate Passes Ledger View, Gated Estate Visitor Passes & QR Barrier Security

### Community 15 - "Smart IoT & Utility Telemetry"
Cohesion: 0.50
Nodes (4): Water Meter Reading Entry Modal, Water Sub-Metering Management View, Smart IoT Water & Electricity Telemetry, Water Sub-Metering & Tariff Calculation Engine

### Community 19 - "Estate Amenities & Clubhouse Bookings"
Cohesion: 0.67
Nodes (3): Estate Amenity Reservation Modal, Shared Estate Amenities View, Shared Estate Amenities & Clubhouse Booking Engine

### Community 20 - "Rent Ledger & Batch Invoicing"
Cohesion: 0.67
Nodes (3): Generate Custom Billing Invoice Modal, Rent Roll Invoicing & Ledger View, Double-Entry Batch Invoicing Engine

### Community 21 - "Maintenance Work Orders & Dispatch"
Cohesion: 0.67
Nodes (3): Create Maintenance Ticket Modal, Maintenance Tickets Kanban View, Maintenance & Contractor Dispatch System

### Community 22 - "Move-In Condition Audits & Settlement"
Cohesion: 0.67
Nodes (3): Move-In / Move-Out Condition Inspection Modal, Move-In / Exit Audits View, Move-In / Move-Out Condition Audits & Deposit Settlement

### Community 23 - "Landlord Remittance & Expense Statements"
Cohesion: 0.67
Nodes (3): Operating Expenses Management View, Landlord Remittance Statements View, Landlord Remittance & Owner Statement System

## Knowledge Gaps
- **45 isolated node(s):** `BomaSphere Property Management System`, `Cloudflare Global Edge Serverless Architecture`, `Zero-Dependency Node.js Server`, `Native Node SQLite Relational Database`, `WhatsApp Business API Interactive Gateway` (+40 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 105 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BomaSphereApp` connect `Core App State & RBAC Controller` to `Property Management Event Handlers`, `Financial & Ledger Utilities`, `UI Modal Launchers & Navigation`, `App Initialization & Auth Lifecycle`, `Digital Leases & Payment Interactions`, `Water Sub-Metering Calculations`, `Frontend Application Bootstrap`, `Tenant Onboarding & Lead Conversion`, `Unit Assignment & Vacancy Allocation`?**
  _High betweenness centrality (0.220) - this node is a cross-community bridge._
- **What connects `BomaSphere Property Management System`, `Cloudflare Global Edge Serverless Architecture`, `Zero-Dependency Node.js Server` to the rest of the system?**
  _45 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend & Database Infrastructure` be split into smaller, more focused modules?**
  _Cohesion score 0.06382978723404255 - nodes in this community are weakly interconnected._
- **Should `Property Management Event Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.14634146341463414 - nodes in this community are weakly interconnected._
- **Should `Financial & Ledger Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.10158730158730159 - nodes in this community are weakly interconnected._
- **Should `Core App State & RBAC Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.08994708994708994 - nodes in this community are weakly interconnected._
- **Should `UI Modal Launchers & Navigation` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._