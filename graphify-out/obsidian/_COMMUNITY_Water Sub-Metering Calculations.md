---
type: community
cohesion: 0.50
members: 4
---

# Water Sub-Metering Calculations

**Cohesion:** 0.50 - moderately connected
**Members:** 4 nodes

## Members
- [[dot-calcWaterCost()]] - code - public/app.js
- [[dot-onWaterUnitChange()]] - code - public/app.js
- [[dot-openWaterReadingForUnit()]] - code - public/app.js
- [[dot-openWaterReadingModal()]] - code - public/app.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Water_Sub-Metering_Calculations
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_Core App State & RBAC Controller]]
- 1 edge to [[_COMMUNITY_UI Modal Launchers & Navigation]]

## Top bridge nodes
- [[dot-openWaterReadingModal()]] - degree 4, connects to 2 communities
- [[dot-calcWaterCost()]] - degree 3, connects to 1 community
- [[dot-onWaterUnitChange()]] - degree 2, connects to 1 community
- [[dot-openWaterReadingForUnit()]] - degree 2, connects to 1 community