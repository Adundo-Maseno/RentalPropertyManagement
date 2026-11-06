---
type: community
cohesion: 0.27
members: 10
---

# Digital Leases & Payment Interactions

**Cohesion:** 0.27 - loosely connected
**Members:** 10 nodes

## Members
- [[dot-initLeaseSignaturePad()]] - code - public/app.js
- [[dot-onManualTenantChange()]] - code - public/app.js
- [[dot-onMoveInPromptAction()]] - code - public/app.js
- [[dot-onMpesaTenantChange()]] - code - public/app.js
- [[dot-openLeaseSignModal()]] - code - public/app.js
- [[dot-openManualPaymentForInvoice()]] - code - public/app.js
- [[dot-openManualPaymentModal()]] - code - public/app.js
- [[dot-openMpesaForInvoice()]] - code - public/app.js
- [[dot-openMpesaForTenant()]] - code - public/app.js
- [[dot-openMpesaModal()]] - code - public/app.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Digital_Leases__Payment_Interactions
SORT file.name ASC
```

## Connections to other communities
- 10 edges to [[_COMMUNITY_Core App State & RBAC Controller]]
- 3 edges to [[_COMMUNITY_Property Management Event Handlers]]
- 3 edges to [[_COMMUNITY_UI Modal Launchers & Navigation]]
- 1 edge to [[_COMMUNITY_App Initialization & Auth Lifecycle]]
- 1 edge to [[_COMMUNITY_Financial & Ledger Utilities]]

## Top bridge nodes
- [[dot-openLeaseSignModal()]] - degree 6, connects to 4 communities
- [[dot-openMpesaModal()]] - degree 5, connects to 3 communities
- [[dot-onMoveInPromptAction()]] - degree 9, connects to 2 communities
- [[dot-openManualPaymentModal()]] - degree 4, connects to 2 communities
- [[dot-openMpesaForTenant()]] - degree 5, connects to 1 community