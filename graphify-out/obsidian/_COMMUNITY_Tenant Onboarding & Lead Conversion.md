---
type: community
cohesion: 1.00
members: 3
---

# Tenant Onboarding & Lead Conversion

**Cohesion:** 1.00 - tightly connected
**Members:** 3 nodes

## Members
- [[dot-convertLeadToTenant()]] - code - public/app.js
- [[dot-onTenantModalUnitChange()]] - code - public/app.js
- [[dot-openAddTenantModal()]] - code - public/app.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Tenant_Onboarding__Lead_Conversion
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_Core App State & RBAC Controller]]
- 1 edge to [[_COMMUNITY_UI Modal Launchers & Navigation]]
- 1 edge to [[_COMMUNITY_Financial & Ledger Utilities]]

## Top bridge nodes
- [[dot-openAddTenantModal()]] - degree 5, connects to 3 communities
- [[dot-convertLeadToTenant()]] - degree 3, connects to 1 community
- [[dot-onTenantModalUnitChange()]] - degree 3, connects to 1 community