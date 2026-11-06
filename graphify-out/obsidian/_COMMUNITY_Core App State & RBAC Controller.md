---
type: community
cohesion: 0.09
members: 28
---

# Core App State & RBAC Controller

**Cohesion:** 0.09 - loosely connected
**Members:** 28 nodes

## Members
- [[dot-calculateInvoiceTotal()]] - code - public/app.js
- [[dot-clearLeaseSignature()]] - code - public/app.js
- [[dot-copyUserEmail()]] - code - public/app.js
- [[dot-dispatchBulk5thReminders()]] - code - public/app.js
- [[dot-enforceActionRBAC()]] - code - public/app.js
- [[dot-generateHiggsfieldVideo()]] - code - public/app.js
- [[dot-loadSampleTour()]] - code - public/app.js
- [[dot-onHiggsfieldUnitChange()]] - code - public/app.js
- [[dot-onInvoiceTenantSelected()]] - code - public/app.js
- [[dot-onMpesaInvoiceChange()]] - code - public/app.js
- [[dot-openBulk5thSMSModal()]] - code - public/app.js
- [[dot-openCreateInvoiceModal()]] - code - public/app.js
- [[dot-promptPwaInstall()]] - code - public/app.js
- [[dot-renderHiggsfield()]] - code - public/app.js
- [[dot-sendTestWhatsapp()]] - code - public/app.js
- [[dot-setHiggsfieldMode()]] - code - public/app.js
- [[dot-setHiggsfieldRatio()]] - code - public/app.js
- [[dot-showArrearsSMS()]] - code - public/app.js
- [[dot-switchUserRole()]] - code - public/app.js
- [[dot-toggleAllSmsRecipients()]] - code - public/app.js
- [[dot-toggleDarkMode()]] - code - public/app.js
- [[dot-toggleLoginPasswordVisibility()]] - code - public/app.js
- [[dot-updateCharts()]] - code - public/app.js
- [[dot-updateHiggsfieldPrompt()]] - code - public/app.js
- [[dot-updateSidebarSummary()]] - code - public/app.js
- [[dot-useTemplate()]] - code - public/app.js
- [[dot-viewLeaseDetails()]] - code - public/app.js
- [[BomaSphereApp]] - code - public/app.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Core_App_State__RBAC_Controller
SORT file.name ASC
```

## Connections to other communities
- 55 edges to [[_COMMUNITY_Property Management Event Handlers]]
- 39 edges to [[_COMMUNITY_Financial & Ledger Utilities]]
- 22 edges to [[_COMMUNITY_UI Modal Launchers & Navigation]]
- 14 edges to [[_COMMUNITY_App Initialization & Auth Lifecycle]]
- 10 edges to [[_COMMUNITY_Digital Leases & Payment Interactions]]
- 4 edges to [[_COMMUNITY_Water Sub-Metering Calculations]]
- 3 edges to [[_COMMUNITY_Tenant Onboarding & Lead Conversion]]
- 3 edges to [[_COMMUNITY_Unit Assignment & Vacancy Allocation]]
- 2 edges to [[_COMMUNITY_Frontend Application Bootstrap]]

## Top bridge nodes
- [[BomaSphereApp]] - degree 161, connects to 9 communities
- [[dot-openBulk5thSMSModal()]] - degree 4, connects to 2 communities
- [[dot-openCreateInvoiceModal()]] - degree 4, connects to 2 communities
- [[dot-calculateInvoiceTotal()]] - degree 3, connects to 1 community
- [[dot-renderHiggsfield()]] - degree 3, connects to 1 community