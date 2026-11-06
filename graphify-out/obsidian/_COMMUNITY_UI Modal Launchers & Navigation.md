---
type: community
cohesion: 0.10
members: 20
---

# UI Modal Launchers & Navigation

**Cohesion:** 0.10 - loosely connected
**Members:** 20 nodes

## Members
- [[dot-loadMarketplace()]] - code - public/app.js
- [[dot-openAddExpenseModal()]] - code - public/app.js
- [[dot-openAddPropertyModal()]] - code - public/app.js
- [[dot-openAddUnitModal()]] - code - public/app.js
- [[dot-openAddUserModal()]] - code - public/app.js
- [[dot-openArtisanMarketplaceModal()]] - code - public/app.js
- [[dot-openBroadcastModal()]] - code - public/app.js
- [[dot-openGateSecurityScannerModal()]] - code - public/app.js
- [[dot-openMaintenanceModal()]] - code - public/app.js
- [[dot-openModal()]] - code - public/app.js
- [[dot-openNewAmenityBookingModal()]] - code - public/app.js
- [[dot-openNewInspectionModal()]] - code - public/app.js
- [[dot-openNewTicketModal()]] - code - public/app.js
- [[dot-openNewVisitorPassModal()]] - code - public/app.js
- [[dot-openTenantVettingModal()]] - code - public/app.js
- [[dot-updateAmenityFee()]] - code - public/app.js
- [[dot-updateInspectionMath()]] - code - public/app.js
- [[dot-vetViewingLead()]] - code - public/app.js
- [[dot-viewPrintableInvoice()]] - code - public/app.js
- [[dot-viewTenantLedger()]] - code - public/app.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/UI_Modal_Launchers__Navigation
SORT file.name ASC
```

## Connections to other communities
- 22 edges to [[_COMMUNITY_Core App State & RBAC Controller]]
- 7 edges to [[_COMMUNITY_Financial & Ledger Utilities]]
- 5 edges to [[_COMMUNITY_Property Management Event Handlers]]
- 3 edges to [[_COMMUNITY_Digital Leases & Payment Interactions]]
- 1 edge to [[_COMMUNITY_Unit Assignment & Vacancy Allocation]]
- 1 edge to [[_COMMUNITY_Tenant Onboarding & Lead Conversion]]
- 1 edge to [[_COMMUNITY_App Initialization & Auth Lifecycle]]
- 1 edge to [[_COMMUNITY_Water Sub-Metering Calculations]]

## Top bridge nodes
- [[dot-openModal()]] - degree 28, connects to 8 communities
- [[dot-loadMarketplace()]] - degree 5, connects to 3 communities
- [[dot-openNewAmenityBookingModal()]] - degree 4, connects to 2 communities
- [[dot-openNewInspectionModal()]] - degree 4, connects to 2 communities
- [[dot-openTenantVettingModal()]] - degree 4, connects to 2 communities