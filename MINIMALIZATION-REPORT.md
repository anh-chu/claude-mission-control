# Minimalization Report

**Generated**: 2026-04-24
**Codebase**: mission-control v0.15.0
**Total**: ~42,200 LOC across 100 API routes, 96 UI components, 19 pages, 37 lib files, 11 hooks

---

## Executive Summary

App is feature-rich but bloated. 19 pages, 100 API routes, 96 components for what is essentially a task/project management + AI agent orchestration tool. Several areas have clear duplication, dead code, and optional features that can be stripped for a leaner core.

**Estimated removable**: ~30-40% of routes, ~25% of pages, ~15% of components, 1 dead dependency.

---

## 1. CONFIRMED DUPLICATES (Remove Immediately)

### 1.1 Projects vs Ventures (100% identical)
- **Pages**: `src/app/projects/page.tsx` and `src/app/ventures/page.tsx` are textually identical (only label differs)
- **API Routes**: `/api/projects/route.ts` and `/api/ventures/route.ts` are byte-for-byte identical
- **Sub-routes**: `[id]/run/route.ts` and `[id]/stop/route.ts` are also identical in both
- **Client calls**: `useProjects()` hook calls `/api/ventures` only. `/api/projects` is never called.
- **Action**: Delete entire `src/app/projects/` and `src/app/api/projects/` (6 files, ~900 LOC)

### 1.2 Priority Matrix vs Status Board (superset overlap)
- Priority Matrix includes both Eisenhower 2x2 AND Kanban view toggle
- Status Board is Kanban-only (subset of Priority Matrix)
- Both use same `BoardColumn`, `BoardPanels`, `BoardDndWrapper` components
- **Action**: Remove `src/app/status-board/` (2 files, ~280 LOC). Priority Matrix covers both views.

### 1.3 Redirect Stubs
- `src/app/daemon/page.tsx` redirects to `/autopilot`
- `src/app/goals/page.tsx` redirects to `/objectives`
- **Action**: Delete both. Configure Next.js redirects in `next.config.js` instead (~4 LOC).

---

## 2. OPTIONAL FEATURES (Evaluate for Removal)

### 2.1 Wiki/Documents System (~2,060 LOC)
- **Pages**: `src/app/documents/page.tsx` (1,447 LOC, largest page)
- **API**: 11 wiki routes (init, generate, content, upload, file, folder, move, runs, run-stream, prompt, root)
- **Lib**: `src/lib/wiki-plugin.ts` (plugin installer/bootstrapper)
- **Impact**: Self-contained. No other features depend on it.
- **Recommendation**: Remove if wiki/second-brain not core to your vision. Saves ~2,060 LOC.

### 2.2 Checkpoints System (~400 LOC)
- **API**: 5 routes (export, import, load, new, CRUD)
- **Purpose**: Snapshot/restore workspace state
- **Impact**: Only used by Settings page backup/restore dialogs
- **Recommendation**: Remove for minimalism. Manual backup via file system sufficient.

### 2.3 Guide Page (~568 LOC)
- Purely static hardcoded documentation
- No data hooks, no API calls
- **Recommendation**: Remove. Replace with README or external docs link.

### 2.4 Sync Route (~50 LOC)
- `POST /api/sync`: Regenerates .claude/commands/ files
- Developer-facing CLI integration helper
- **Recommendation**: Remove. Run via script instead.

### 2.5 Missions Route (~367 LOC)
- Complex multi-task orchestration with reconciliation loops
- Advanced feature, not visible in default UI
- **Recommendation**: Remove if single-task execution sufficient.

---

## 3. SIMPLIFICATION CANDIDATES

### 3.1 Sidebar Navigation (Currently 7 items)
Current sidebar: Dashboard, Priority Matrix, Status Board, Objectives, Quick Capture, Projects, Automation

**Pages reachable only via programmatic navigation (not in sidebar)**:
- `/activity` - Activity log
- `/crew` - Agent management
- `/decisions` - Decision queue
- `/documents` - Wiki/docs
- `/inbox` - Message inbox
- `/initiatives` - Initiative tracking
- `/logs` - System logs
- `/settings` - App settings
- `/skills` - Skill library

12 hidden pages vs 7 visible = confusing navigation. Either add to sidebar or remove.

### 3.2 Skeleton Components (14 variants, 243 LOC)
- Only 6 have 2+ imports. 8 are single-use.
- **Recommendation**: Consolidate into 3-4 generic skeletons (Card, Row, Grid, Dashboard).

### 3.3 Context Menus (5 variants, 356 LOC)
- All follow identical pattern: ContextMenuContent with ContextMenuItems
- **Recommendation**: Extract shared wrapper, reduce to config-driven single component.

### 3.4 Dialog Components (8 dialogs, 1,665 LOC)
- create-task, create-project, create-goal + edit variants
- **Recommendation**: Merge create/edit pairs into unified form dialogs. Saves ~500 LOC.

### 3.5 Onboarding Dialog (253 LOC, 1 import)
- Single-use, possibly legacy
- **Recommendation**: Remove if onboarding not actively maintained.

---

## 4. DEAD CODE

| Item | Location | Status |
|------|----------|--------|
| `/api/projects/*` (all routes) | `src/app/api/projects/` | Never called by client |
| `checkbox.tsx` UI primitive | `src/components/ui/checkbox.tsx` | 0 imports found |
| `DashboardEisenhowerCounts` type | `src/hooks/use-dashboard-data.ts` | Exported, never imported |
| `ethers` dependency | `package.json` | 0 usage in entire codebase |

---

## 5. DEPENDENCY AUDIT

### Used Dependencies (35)
All actively imported except `ethers`.

### Suspicious
| Package | Usage Count | Notes |
|---------|------------|-------|
| `ethers` | 0 files | **DEAD. Remove.** |
| `@dnd-kit/*` (3 pkgs) | 4 files | Only if keeping board views |
| `cmdk` | 1 file | Command palette only |
| `node-cron` | 2 files | Daemon scheduler only |
| `async-mutex` | 1 file | data.ts file locking |

---

## 6. DAEMON SUBSYSTEM ASSESSMENT

- **Size**: ~7,272 LOC across 9 files in `scripts/daemon/`
- **Purpose**: Background agent execution (task runner, inbox responder, wiki generator, scheduler, health monitor, crash recovery)
- **Status**: Critical infrastructure. Powers automation/autopilot feature.
- **Recommendation**: Keep if AI agent execution is core. Remove entirely if app is just task management.

---

## 7. PROPOSED MINIMAL CORE

If goal is "task + project management with optional AI automation":

### Keep (Core)
| Area | Pages | Routes | LOC |
|------|-------|--------|-----|
| Dashboard | 1 | 2 | ~1,050 |
| Priority Matrix | 1 | 0 | ~390 |
| Objectives/Goals | 1 | 4 | ~810 |
| Quick Capture | 1 | 5 | ~450 |
| Projects (ventures) | 1 | 6 | ~470 |
| Automation | 1 | 3 | ~880 |
| Tasks API | 0 | 8 | ~950 |
| Inbox | 1 | 7 | ~830 |
| Crew/Agents | 1 | 4 | ~360 |
| Settings | 1 | 4 | ~820 |
| **Total** | **9** | **43** | **~7,010** |

### Remove/Defer
| Area | Files | LOC Saved |
|------|-------|-----------|
| Projects (duplicate of ventures) | 6 | ~900 |
| Status Board (duplicate of matrix) | 2 | ~280 |
| Documents/Wiki | 14 | ~2,060 |
| Checkpoints | 5 | ~400 |
| Guide | 1 | ~568 |
| Missions | 1 | ~367 |
| Sync | 1 | ~50 |
| Redirect stubs | 2 | ~10 |
| Dead code/deps | 3 | ~100 |
| **Total** | **35** | **~4,735** |

### Simplify
| Area | Action | LOC Saved |
|------|--------|-----------|
| Skeletons | Consolidate 14 to 4 | ~100 |
| Context menus | Config-driven single component | ~200 |
| Dialogs | Merge create/edit pairs | ~500 |
| Onboarding dialog | Remove if unused | ~253 |
| **Total** | | **~1,053** |

---

## 8. RISK ASSESSMENT

| Action | Risk | Mitigation |
|--------|------|------------|
| Remove /api/projects | None (dead code) | Verify no external callers |
| Remove status-board | Low (priority-matrix covers it) | Update any deep links |
| Remove wiki/documents | Medium (feature loss) | Archive code in branch |
| Remove checkpoints | Low (backup feature) | Document manual backup process |
| Remove ethers dep | None (unused) | Just `pnpm remove ethers` |
| Remove daemon | HIGH (breaks automation) | Only if pivoting away from AI agents |

---

## Summary

**Current state**: 42,200 LOC, 100 routes, 96 components, 19 pages
**After immediate cleanup**: ~37,465 LOC (~11% reduction)
**After full minimalization**: ~35,400 LOC (~16% reduction, 57 routes, 9 pages)
**After simplification**: ~34,350 LOC (~19% total reduction)

Priority order:
1. Delete `/api/projects/` and `/src/app/projects/` (dead duplicate)
2. Delete `ethers` dependency
3. Delete redirect stubs, use next.config redirects
4. Remove status-board page
5. Evaluate wiki/documents removal
6. Consolidate skeletons/dialogs/context-menus
