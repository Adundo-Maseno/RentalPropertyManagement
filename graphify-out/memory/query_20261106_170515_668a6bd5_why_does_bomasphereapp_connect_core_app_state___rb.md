---
type: "query"
date: "2026-11-06T17:05:15.095039+00:00"
question: "Why does BomaSphereApp connect Core App State & RBAC Controller to Digital Leases & Payment Interactions, Financial & Ledger Utilities, and Tenant Onboarding & Lead Conversion across 9 community boundaries?"
contributor: "graphify"
source_nodes: ["BomaSphereApp", "Core App State & RBAC Controller", "Digital Leases & Payment Interactions", "Financial & Ledger Utilities", "Tenant Onboarding & Lead Conversion"]
---

# Q: Why does BomaSphereApp connect Core App State & RBAC Controller to Digital Leases & Payment Interactions, Financial & Ledger Utilities, and Tenant Onboarding & Lead Conversion across 9 community boundaries?

## Answer

BomaSphereApp functions as the central monolithic SPA orchestrator for BomaSphere PMS.
With 161 direct method edges, it bridges 10 operational communities:
1. Property Management Event Handlers (42 methods like handleMpesaSubmit, runBatchBilling, switchView, handleTicketSubmit)
2. Financial & Ledger Utilities (36 methods including generateLandlordStatement, renderExpenses, formatMoney, escapeHtml)
3. Core App State & RBAC Controller (27 methods managing authState, enforceActionRBAC, calculateInvoiceTotal, dispatchBulk5thReminders)
4. UI Modal Launchers & Navigation (20 modal lifecycle handlers like openModal, openAddPropertyModal, openAddUnitModal)
5. App Initialization & Auth Lifecycle (14 methods including init, initAuthSession, setupEventListeners, restoreThemeAndMode)
6. Digital Leases & Payment Interactions (10 methods managing onMoveInPromptAction, openManualPaymentForInvoice, initLeaseSignaturePad)
7. Water Sub-Metering Calculations (4 utility calculation and tariff lookup methods)
8. Tenant Onboarding & Lead Conversion (3 pipeline methods: openAddTenantModal, onTenantModalUnitChange, convertLeadToTenant)
9. Unit Assignment & Vacancy Allocation (3 vacancy and collision-prevention methods: openAddLeaseModal, openAssignTenantModal, onLeaseUnitSelected)
10. Frontend Application Bootstrap (contains initApp, app.js lifecycle)

This design gives BomaSphere immediate reactivity and zero-latency state synchronization in a zero-build client runtime, but concentrates high betweenness centrality (0.220) into a single master controller.

## Source Nodes

- BomaSphereApp
- Core App State & RBAC Controller
- Digital Leases & Payment Interactions
- Financial & Ledger Utilities
- Tenant Onboarding & Lead Conversion