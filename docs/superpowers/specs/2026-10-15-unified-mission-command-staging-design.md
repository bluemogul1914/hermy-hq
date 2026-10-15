# Unified Mission Command — Staging Integration Design

Status: Finalized for owner review. This documentation checkpoint authorizes no implementation, staging startup, production change, credential change, merge, push, or deployment.

Date: 2026-10-15

## 1. Decision and scope

Use the existing HermyHQ application at `hermy.bluemogul.us` as the visual, navigation, and feature foundation. Add a native M2 Missions page to an isolated staging checkout. Keep the M2 Python API as a separate service. Preserve the current prototype listener on `bme-trade-02:127.0.0.1:8802`; the unified preview will use a separate isolated M2 source copy, a fresh SQLite file, and a newly verified free loopback port (planned `8803`) for the owner-isolation fix.

The live HermyHQ source at `/opt/hermy-hq` and its running container are read-only reference points. The staging checkout is a separate local clone with its own `.git` object store, based on the running image's source revision, `ad9e00d`; it has no symlink or bind mount to the production checkout. Staging binds only to loopback and is reached by SSH tunnel; no public hostname, DNS, reverse-proxy, or production deployment changes are in scope.

Owner decisions recorded for this design:

- Existing HermyHQ analytics may read their current production-backed sources, strictly read-only. The UI must label those values `LIVE · READ ONLY`.
- M2 Missions uses only the isolated staging API/database and must be labeled `STAGING · TEST DATA`.
- The UI displays the M2 lifecycle status exactly as returned. Do not invent an approval state, map `assigned` to “approved,” or add approve/reject actions or endpoints.
- The isolated unified-staging M2 copy must enforce operator-owner scope for mission detail, audit, and ledger reads; the shared production/staging checkout and its running listeners remain untouched.
- No production writes, credential changes, or Hermes dispatch are allowed from staging.

## 2. Read-only baseline

### Original HermyHQ

- The running image is `hermy-hq:deploy-ad9e00d`; source branch `main` is at `ad9e00d`.
- The original app contains the established grouped sidebar and responsive mobile navigation in `src/components/sidebar.tsx`, app shell in `src/components/conditional-layout.tsx`, design tokens and card styles in `src/app/globals.css`, and reusable primitives in `src/components/ui/kit.tsx` and `src/components/mc/ui.tsx`.
- Existing routes cover the requested Dashboard, Org, Agents, Activity, Cost, Client Pulse, Tasks, Goals, Projects, Memory Wiki, and the external Chat link. Preserve those routes and their existing production appearance.
- The production worktree has an unrelated untracked `hermes-bridge/package-lock.json`; do not remove, stage, or copy it into the spec commit.

### Current staging prototype and M2 API

- The separate `staging/nextjs-dashboard` prototype is not based on the HermyHQ app shell. It has its own small `globals.css`, inline utility styling, and only Dashboard, Missions, Agents, and Audit routes. It is not missing HermyHQ CSS; it is a separate prototype that does not import HermyHQ's styles/components.
- The existing staging M2 prototype is healthy on loopback port 8802, separate from production port 8800. Its launcher selects a separate SQLite staging database, sets `MC_TEST_MODE=0`, and patches Hermes execution to `/bin/true`. Preserve this listener and database as the prior baseline.
- The existing staging bridge has allowlisted mission reads/create, assign, cancel, audit/ledger, agent status, CSRF validation, identity mapping, and short-lived Proxy-Assertion generation. Dispatch and chat are explicitly excluded. The M2 mission state machine is `created → assigned → acknowledged → in_progress → complete/blocked/cancelled`; no distinct approval field/action exists.
- Current backend source does not meet operator-owner isolation for mission reads: `handle_mission_get`, `handle_mission_audit`, and `handle_mission_ledger` call `_authorize_mission_read`, whose operator branch allows any operator. The mission list separately filters by creator. `_authorize_mission_transition` checks operator-vs-agent role but does not bind assign/cancel to the mission creator. The read helper and route handlers match committed HEAD `0b6e494` as well as the dirty worktree. Both current listeners (8800 production and 8802 staging) have working directories in this same checkout. No production request/test was run; production runtime exposure remains an unresolved security blocker and is outside this authorization.
- The M2 repository is on `feature/unified-dashboard-bridge` at `0b6e494` with a dirty working tree. Proxy-Assertion source is present in the current worktree, while the VERITAS reconciliation document is scoped to a different committed snapshot. Preserve all existing review/evidence files and do not treat reports against another snapshot as proof of the current runtime.
- This baseline uses `server/server.py` plus `proxy/auth.py`; it does not contain the newer `tests/m2_staging_harness.py`, `FakeSupabaseAuth`, or `MockDispatcher` components. Do not assume those APIs exist or transplant their imports. Use source-appropriate synthetic Proxy-Assertion identities with a fresh per-run HMAC key and `/bin/true` dispatch stub; keep test keys in memory/process environment only, never in `.env` files. If the source baseline changes or the in-memory test boundary cannot be established, stop and revise the security design before Phase B.
- The staging UI's two existing test identities currently derive the same operator ID. That mapping alone cannot prove cross-owner isolation. `tests/staging_integration_full.py::test_cross_owner_isolation` uses one operator and then asserts success unconditionally; it is not cross-owner evidence. `tests/m2_security_verification.py::test_h2_mission_authorization` defines the expected 403 behavior for a second operator, but its current API path contradicts that expectation. Create a new stage-only regression using two distinct Proxy-Assertion operator IDs; do not run the existing security script as-is because it targets port 8800 and reads the production protected-token file.
- The existing `staging/capture_screenshots.js` is not approved for reuse: it logs CSRF/session-cookie prefixes and supplies a password in a shell command line. Produce screenshots using a safe, redacted browser-vault/test-auth flow instead.

## 3. Goals and non-goals

### Goals

1. Retain the original HermyHQ visual identity, responsive shell, typography, left navigation, cards, chart styles, branding, and every existing route.
2. Add a first-class `/missions` page within the original Operate navigation and mobile navigation, using the original shared UI kit and data display conventions.
3. Support staging M2 mission listing/detail, creation, lifecycle status, and audit/ledger history through the existing secured bridge. Keep assign/cancel controls disabled until separately authorized, owner-scoped on the backend, independently tested with two operators, and reviewed.
4. Keep the existing production-backed analytics visible only as GET-only, least-privilege-authorized reads, clearly distinguished from staging M2 data.
5. Enforce owner-scoped M2 access for mission detail, per-mission audit, and ledger reads in the isolated staging backend; prove it with two distinct operator identities.
6. Demonstrate auth, navigation, API permissions, CSRF, owner isolation, dispatch denial, and responsive behavior in staging.
7. Provide 12 screenshots: Dashboard, Missions, Agents, and Activity at desktop, tablet, and mobile widths.

### Non-goals

- Replacing or re-skinning the original HermyHQ dashboard.
- Replacing the M2 Python backend, merging its database into HermyHQ, or adding a new approval state/API. The only required M2 API behavior change is owner-scoped reads in the isolated staging copy; path changes are staging-isolation plumbing. Any assign/cancel owner guard is an optional extension requiring separate authorization.
- Modifying production files, environment variables, credentials, database, DNS, proxy, container, or service state.
- Exposing Hermes dispatch or chat-send routes through the staging proxy.
- Pushing, merging, deploying, or requesting production-release authorization.

## 4. Proposed staging architecture

### 4.1 Isolated frontend checkout

- After approval, create the implementation checkout at `/home/bluemogul/worktrees/hermyhq-mission-command-staging/` as an independent local clone with its own Git object store, checked out at `ad9e00d`. Do not use a linked worktree, symlink, bind mount, shared `node_modules`, or live production checkout as the staging source; never edit `/opt/hermy-hq/main` or the running production container.
- After this spec is reviewed and approved, implementation will occur only in a local `dev/*` branch of that independent clone. The HermyHQ staging process will bind to a verified free loopback port on h02.
- Reach the browser preview through an SSH tunnel. Do not add a public hostname or proxy route.
- Use a loopback-only, no-password staging identity picker in the independent clone; generate test principals, NextAuth secret, and Proxy-Assertion HMAC key in memory per run. Do not load or persist staging `.env` credentials, alter/copy Google OAuth credentials, NextAuth secrets, or production identity configuration. Test principals and role mappings are staging-only.

### 4.1.1 Isolated M2 owner-scope backend

- Create an independent M2 staging clone with its own Git object store outside the shared checkout, from the exact current staging runtime files; do not use linked worktrees or hardlinks. Record the base commit, tracked diff paths, untracked runtime files, and file hashes in the implementation evidence. Do not symlink/bind-mount shared source or edit/clean the dirty checkout used by ports 8800/8802.
- Use a fresh, run-specific runtime workspace beneath `/home/bluemogul/recovery/mission-control-unified-runtime/`, outside both source clones. Reject the root itself, any path outside it, and symlink escapes. Audit every `server/*.py` module defining `WORKSPACE`, `DATA_DIR`, `DB_PATH`, attachment, backup, or profile paths; ensure each active consumer requires the staging `MC_WORKSPACE` with no production-path fallback, and enforce runtime path checks (using explicit startup errors, not optimizable `assert` statements) proving all effective database/data/attachment/backup paths resolve beneath that scratch root and Hermes profiles point to an empty stage directory before any database initializer or server construction. Exclude the one-off `migrate_prompt17.py` from imports and execution. If any path cannot be isolated, stop before starting the service.
- Start the snapshot on a verified free loopback port (planned `8803`) with `MC_TEST_MODE=0` and Hermes stub `/bin/true`. Use separate disposable SQLite workspaces for owner-isolation RED/GREEN tests and a fresh workspace for the UI preview. The unified UI points only to this isolated listener. If the port is occupied, choose another free loopback port; never repurpose 8800 or overwrite 8802.
- Generate per-run synthetic owner subjects/tokens and the Proxy-Assertion HMAC secret in the Phase B test/preview supervisor's memory; pass them only to the isolated child processes and clear them at shutdown. Do not load any staging `.env` credentials or persist test assertions, identity tokens, or HMAC keys. The UI's local test identity selector must use the same ephemeral owner mapping; no production Google login is available in the stage build.
- In that staging copy, change operator mission-read authorization to require `mission.creator == operator_id` for detail, audit, and ledger. Preserve the existing agent-vs-operator H1/H2 role checks and dispatch denial.
- The current transition guard does not bind operators to mission creators. Assign/cancel controls remain disabled in staging until the owner separately authorizes the staging-only creator guard, two-operator tests pass, and an independent review approves the exact change. If any gate is missing, keep both controls disabled. This does not authorize a production mutation change.
- Keep the previous 8802 API and database available as the baseline; do not backfill or migrate its data into the new copy.

### 4.2 Original visual foundation

- Keep the original root layout, sidebar groups, mobile header/tab bar, design tokens, Geist typography, and shared `Panel`, `Button`, `Pill`, `EmptyState`, `SectionHeader`, `StatCard`, and loading/error components.
- Add a `/missions` navigation item without removing or renaming existing destinations. Preserve the external Chat link and mark it as an external/live service; do not exercise it during staging validation.
- Keep the original Dashboard, Org, Agents, Activity, Cost, Client Pulse, Tasks, Goals, Projects, and Memory Wiki routes. Their production-backed reads remain GET-only and are labeled `LIVE · READ ONLY`.
- Any legacy control that would write to production (including task actions or Hermes dispatch) must be disabled in the staging UI and rejected by the staging API layer. Mission creation may be enabled only against isolated M2 staging. Assign/cancel remain disabled until the separate owner-guard authorization, two-operator regression, and independent review gates in §4.1.1 pass.

### 4.3 M2 bridge and data boundary

- M2 UI requests pass through a same-origin server-side route. No M2 token, Proxy-Assertion secret, session cookie, or CSRF value is sent to browser JavaScript or included in screenshots.
- The M2 route allowlist is limited to staging-safe reads (`/api/missions`, mission detail, agent status, audit, ledger) and mission creation. Assign/cancel are denied and their UI controls remain disabled until the optional owner-scoped transition guard is separately authorized, tested with two operators, and independently reviewed. All other routes return 403/404; dispatch and chat are always denied.
- Enabled mutations require an authenticated staging session, a mapped identity with the required permission, a valid CSRF token, and the reviewed short-lived, single-use Proxy-Assertion. The assertion's operator identity must be bound to the staging test principal, not accepted from client JSON.
- Production-backed GETs use a separate explicit GET-only allowlist and a verified least-privilege credential that itself has read-only permissions; a broad credential is not accepted merely because the proxy exposes GET routes. If used, inject it only into the HermyHQ UI process through the approved secret manager; never copy it into the M2 staging process/runtime or persist it in a staging `.env`. No staging route forwards POST, PUT, PATCH, or DELETE to production. If no such credential is available, stop and render the feed unavailable rather than weakening the boundary.
- The pre-existing M2 staging process remains on 127.0.0.1:8802 and is not modified. The unified preview uses the separate owner-scoped staging copy on its verified loopback port, with its own SQLite file, `MC_TEST_MODE=0`, and `/bin/true` dispatch stub. Do not call the dispatch endpoint.

### 4.4 Missions behavior and refresh

- Show M2 states exactly as returned, with a clear label such as `Lifecycle status`; do not render a separate approval badge or imply that assignment is approval.
- Mission creation may be available only for staging data. Assign/cancel controls must be visibly disabled until the optional staging-only owner guard is separately authorized, passes two-operator tests, and receives independent review. Display API denial/errors rather than optimistic success; when enabled later, require cancellation confirmation.
- Show per-mission audit history and ledger details using existing GET endpoints.
- The reviewed UI bridge has no mission event-stream route. Use bounded no-store polling (target 10 seconds), a manual refresh action, and a visible “Updated” timestamp. Do not describe this as server-pushed streaming.
- Distinguish sources with persistent labels: original service-backed analytics = `LIVE · READ ONLY`; M2 mission records = `STAGING · TEST DATA`. Do not merge stage agent counts/test missions into production totals.

## 5. Security and independent review gates

Phase A is limited to isolated-clone edits, path/unit tests, offline builds, and independent review; do not start a Mission Control API/Next.js listener or browser during Phase A. Phase B (loopback staging services, HTTP integration, browser acceptance, and screenshots) requires a separate explicit owner authorization after Phase A passes and the exact changes receive independent review.

1. Keep existing VERITAS and security-review artifacts byte-for-byte unchanged.
2. In Phase A, establish the exact clone/commit and run only offline path/unit tests; do not start a service or browser. After separate Phase B authorization, run Proxy-Assertion API integration tests against the isolated staging API only. Reconcile the exact runtime and prior VERITAS review scope; never reuse a pass from another snapshot.
3. Add a failing offline regression before the owner-read fix: two distinct operator IDs, A and B, and a mission row owned by A; A is allowed through the owner-read guard while B is denied. Confirm RED then GREEN without starting a Mission Control service. In authorized Phase B, add/execute the route-level API regression: A creates and reads detail/audit/ledger; B uses a different `sub` and a distinct derived Proxy-Assertion `op` claim, receives 403 for each read, and cannot see A's mission in its list. Test assign/cancel ownership only if that optional extension is separately authorized.
4. Verify unauthenticated access is rejected, unmapped identity is forbidden, agent permissions are read-only, every enabled staging mutation requires CSRF, expired/replayed assertions fail, and direct browser-supplied operator IDs are ignored/rejected.
5. Verify production write paths and all Hermes-invoking paths are denied by the staging frontend proxy. Do not run live dispatch, chat-send, or a production mutation as part of testing.
6. Do not use `tests/staging_integration_full.py::test_cross_owner_isolation` as proof: it uses one operator and hardcodes the isolation assertion to true. Do not run `tests/m2_security_verification.py` unchanged: it targets 127.0.0.1:8800 and reads the production token file. Recreate the needed security checks in the isolated test harness pointed only at the new staging port.
7. Require an independent scoped review of the exact staging diff and the preserved VERITAS evidence before calling security acceptance complete.

## 6. Acceptance matrix

### Visual and functional

- Dashboard: original cards, analytics, branding, and `LIVE · READ ONLY` source labeling render.
- Missions: staging badge, accurate M2 lifecycle statuses, staging create, detail/audit/ledger, and no approval or dispatch control. Assign/cancel are visibly disabled until separately authorized, owner-scoped, independently tested, and reviewed.
- Agents: original view preserved and production-backed view labeled read-only; no staged mock count shown as live.
- Activity: original view preserved; staging mission audit remains attributable and is accessible from the Missions detail.
- All original sidebar routes remain present; route changes close the mobile drawer and selected navigation works.
- Responsive screenshots: 4 pages × 3 viewports = 12 images, plus a manifest; capture through a safe authenticated staging flow without token/password logging.
- Test desktop, tablet, and mobile widths; check no horizontal overflow, inaccessible controls, or clipped nav/content.

### Security and data

- Stage principals access only allowlisted routes on the new staging port and isolated workspace/database.
- Stage read-only/agent principal cannot create, assign, cancel, approve, or dispatch.
- Operator A can read its own mission detail, audit, and ledger; Operator B with a different `sub` and distinct derived operator ID receives 403 for those endpoints and cannot see A's mission in its list. The API regression uses two distinct Proxy-Assertion `op` claims, not two sessions sharing one ID.
- Assign/cancel stay disabled until a separately approved creator guard passes two-operator regression tests and independent review; only then may API/UI mutation routes be enabled.
- Missing/invalid CSRF and proxy assertions are denied; cross-owner read attempts fail.
- Staging proxy cannot forward writes to production, invoke Hermes, or send chat messages.
- Production-backed data requests observed during QA are GET-only; browser bundles and logs contain no server secrets or session tokens.
- `/health` for the new isolated staging M2 listener remains healthy; production 8800 and prior staging 8802 listeners/data are not changed.

### Release boundary

- Implementation remains local on a `dev/*` branch inside the independent staging clone. No push, merge, deployment, public DNS, or production credential change.
- Present the actual staging UI and evidence for owner review. Do not request production authorization until the integrated interface has been demonstrated and independently validated.

## 7. Open risks to resolve during implementation

- Verify that any server-side credential used for production-backed GET analytics itself has read-only/least-privilege permissions; a GET-only proxy over a broad token does not satisfy this gate. If no such credential is verified, stop and leave those feeds unavailable.
- Reconcile current M2 runtime/worktree with existing VERITAS reports before reusing any “pass” claim.
- Ensure the new staging auth and test harness map two test principals to distinct synthetic operator identities for the isolation test, without touching production auth.
- The current shared M2 checkout is dirty and both 8800/8802 processes have that checkout as their working directory. The owner-read behavior is present at committed HEAD, so production exposure is possible but was not probed. Do not patch `server/server.py` or test 8800; the production risk requires a separate owner-approved security review/fix.
- Apply the owner guard only in the isolated staging source snapshot, and keep the current prototype, its database, and security evidence intact; do not overwrite or clean the dirty M2 worktree.

## 8. Approval state

This document records the approved staging-only architecture, the explicit data/approval-status decisions, and the newly approved staging-only owner-isolation correction. It is a design specification only. Implementation begins only after the owner reviews and approves this revised document and its implementation plan. Production release remains a separate future authorization gate.
