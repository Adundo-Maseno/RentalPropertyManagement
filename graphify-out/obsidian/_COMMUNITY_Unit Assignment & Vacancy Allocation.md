---
type: community
cohesion: 0.67
members: 3
---

# Unit Assignment & Vacancy Allocation

**Cohesion:** 0.67 - moderately connected
**Members:** 3 nodes

## Members
- [[dot-onLeaseUnitSelected()]] - code - public/app.js
- [[dot-openAddLeaseModal()]] - code - public/app.js
- [[dot-openAssignTenantModal()]] - code - public/app.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Unit_Assignment__Vacancy_Allocation
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_Core App State & RBAC Controller]]
- 1 edge to [[_COMMUNITY_UI Modal Launchers & Navigation]]
- 1 edge to [[_COMMUNITY_Financial & Ledger Utilities]]
- 1 edge to [[_COMMUNITY_Property Management Event Handlers]]

## Top bridge nodes
- [[dot-openAddLeaseModal()]] - degree 6, connects to 4 communities
- [[dot-onLeaseUnitSelected()]] - degree 2, connects to 1 community
- [[dot-openAssignTenantModal()]] - degree 2, connects to 1 community