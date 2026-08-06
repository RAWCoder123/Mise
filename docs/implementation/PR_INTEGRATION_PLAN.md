# PR integration plan

Status: **draft strategy from verified git + GitHub** (2026-08-05)  
Decision owner: Claude principal implementer (after user approval to commit/merge)

## Goal

Land one coherent trunk that preserves:

1. Everything valuable on `cursor/initial-mise-import` + dirty worktree  
2. Unique commits from the six open split PRs that this trunk does **not** already contain  
3. Fail-closed security and demo/hosted separation

## Do not do

- Merge PR #1→#4 onto clean `main` and delete the dirty tree  
- Reset `cursor/initial-mise-import` to `split/mockup-redesign`  
- Force-push `main` or rewrite published history without explicit user order  
- Treat empty GitHub check rollups as “CI green”

## Verified stack

```
main
 └─ #1 domain-decouple
     └─ #2 repo-split-realtime
         └─ #3 design-system
             ├─ #4 mockup-redesign   (UI IA baseline on public stack)
             └─ #5 order-automation  (parallel; not on #4)
 main
 └─ #6 dependency-alignment          (independent)
```

Local `HEAD` contains `#1` ancestry, then **diverges**. It does **not** contain `#2`–`#4` as ancestors, but **does** contain a long post-`#1` history (concept UI, launch evidence, etc.) plus dirty operational-backend work beyond all six PRs.

## Recommended sequence

### Phase A — Preserve (required first)

1. User authorizes commits.  
2. Create rescue branch: `rescue/dirty-ops-YYYYMMDD` from current HEAD.  
3. Checkpoint commit(s) of dirty worktree (split logical groups if needed: ops backend / Square / UI / agent kit docs).  
4. Push rescue + updated `cursor/initial-mise-import` to origin (explicit push approval).

### Phase B — Inventory unique PR commits

For each PR head, list files/commits not reachable from post-checkpoint HEAD:

| PR | Likely unique value to mine |
| --- | --- |
| #2 | Realtime membership revocation (vs poll); repo file split if not already present on trunk |
| #3 | Design-system commits not already absorbed by later concept UI |
| #4 | IA shell pieces if any still missing after local Home/Today/More work |
| #5 | Default-off order automation safety evaluator + read-only API |
| #6 | Expo SDK alignment / brace-expansion pin — compare to local `package.json` carefully |

Use `git log HEAD..split/<branch> --oneline` and `git diff HEAD...split/<branch> --stat` after Phase A.

### Phase C — Integrate by cherry-pick / merge of unique deltas

Prefer **cherry-pick** of unique commits onto the preserved trunk over merging the whole stack (avoids resurrecting superseded UI and fighting the dirty ops tree).

Order suggestion after preservation:

1. `#6` dependency alignment (if still needed vs local packages)  
2. `#2` realtime / repo split deltas  
3. `#5` order-automation evaluator  
4. Selective `#3`/`#4` only where trunk is missing behavior

### Phase D — Promote

1. Open one integration PR: preserved trunk → `main` (or rename strategy with user).  
2. Run full gate suite: typecheck, `npm test`, design/mobile smokes, security static/backend, supabase tests when Docker available, staging when credentials available.  
3. Close obsolete split PRs with links to the integration PR once superseded.

## Alternative (rejected unless user insists)

Replay `main` ← #1 ← #2 ← #3 ← #4, then attempt to replay 160+ local commits + dirty tree on top. High conflict cost; easy to lose untracked M4/Square work.

## Cursor / Codex roles during integration

- Claude: sole writer for merges, commits, PR updates (per agent kit).  
- Cursor/Codex: read-only reviewers; log accept/reject in `docs/implementation/consultations/`.  
- Honor `docs/launch/CURRENT_BATCH.yaml` if a new tandem batch is opened; current batch is **complete**.
