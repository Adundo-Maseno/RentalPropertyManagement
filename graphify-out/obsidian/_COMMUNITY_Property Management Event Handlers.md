---
type: community
cohesion: 0.15
members: 42
---

# Property Management Event Handlers

**Cohesion:** 0.15 - loosely connected
**Members:** 42 nodes

## Members
- [[dot-closeModal()]] - code - public/app.js
- [[dot-deleteUser()]] - code - public/app.js
- [[dot-executeBulk5thSmsDispatch()]] - code - public/app.js
- [[dot-fetchAPI()]] - code - public/app.js
- [[dot-handleAddExpenseSubmit()]] - code - public/app.js
- [[dot-handleAddPropertySubmit()]] - code - public/app.js
- [[dot-handleAddUnitSubmit()]] - code - public/app.js
- [[dot-handleAddUserSubmit()]] - code - public/app.js
- [[dot-handleBroadcastSubmit()]] - code - public/app.js
- [[dot-handleCustomInvoiceSubmit()]] - code - public/app.js
- [[dot-handleManualPaymentSubmit()]] - code - public/app.js
- [[dot-handleMpesaSubmit()]] - code - public/app.js
- [[dot-handlePasswordLogin()]] - code - public/app.js
- [[dot-handleTicketSubmit()]] - code - public/app.js
- [[dot-handleWaterSubmit()]] - code - public/app.js
- [[dot-loadTenantVettings()]] - code - public/app.js
- [[dot-markViewingStatus()]] - code - public/app.js
- [[dot-openEtimsModal()]] - code - public/app.js
- [[dot-quickGateCheck()]] - code - public/app.js
- [[dot-refreshAllData()]] - code - public/app.js
- [[dot-refreshIotTelemetry()]] - code - public/app.js
- [[dot-releaseEscrow()]] - code - public/app.js
- [[dot-renderUsers()]] - code - public/app.js
- [[dot-renderVisitorPasses()]] - code - public/app.js
- [[dot-runBatchBilling()]] - code - public/app.js
- [[dot-sendCustomWhatsapp()]] - code - public/app.js
- [[dot-sendQuickComm()]] - code - public/app.js
- [[dot-settleDepositRefund()]] - code - public/app.js
- [[dot-showToast()]] - code - public/app.js
- [[dot-submitAmenityBooking()]] - code - public/app.js
- [[dot-submitInspectionReport()]] - code - public/app.js
- [[dot-submitLeaseSignature()]] - code - public/app.js
- [[dot-submitNewVisitorPass()]] - code - public/app.js
- [[dot-submitTenantVetting()]] - code - public/app.js
- [[dot-switchAuthAccount()]] - code - public/app.js
- [[dot-switchView()]] - code - public/app.js
- [[dot-toggleIotPanel()]] - code - public/app.js
- [[dot-toggleSmartValve()]] - code - public/app.js
- [[dot-updateTicketStatus()]] - code - public/app.js
- [[dot-updateUserSessionDisplay()]] - code - public/app.js
- [[dot-validateGatePass()]] - code - public/app.js
- [[dot-viewPrintableReceipt()]] - code - public/app.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Property_Management_Event_Handlers
SORT file.name ASC
```

## Connections to other communities
- 55 edges to [[_COMMUNITY_Core App State & RBAC Controller]]
- 34 edges to [[_COMMUNITY_Financial & Ledger Utilities]]
- 9 edges to [[_COMMUNITY_App Initialization & Auth Lifecycle]]
- 5 edges to [[_COMMUNITY_UI Modal Launchers & Navigation]]
- 3 edges to [[_COMMUNITY_Digital Leases & Payment Interactions]]
- 1 edge to [[_COMMUNITY_Unit Assignment & Vacancy Allocation]]

## Top bridge nodes
- [[dot-showToast()]] - degree 50, connects to 5 communities
- [[dot-fetchAPI()]] - degree 41, connects to 4 communities
- [[dot-switchView()]] - degree 17, connects to 4 communities
- [[dot-refreshAllData()]] - degree 36, connects to 3 communities
- [[dot-closeModal()]] - degree 20, connects to 3 communities