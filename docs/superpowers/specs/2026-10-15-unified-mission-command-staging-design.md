# Unified Mission Command — Staging Integration Design

Status: Owner-approved architecture; spec review pending. This document authorizes no implementation, production change, merge, push, or deployment.

Date: 2026-10-15

## 1. Decision and scope

Use the existing HermyHQ application at `hermy.bluemogul.us` as the visual, navigation, and feature foundation. Add a native M2 Missions page to an isolated staging checkout. Keep the M2 Python API as a separate service and use its existing staging listener on `bme-trade-02:127.0.0.1:8802`.

The live HermyHQ source at `/opt/hermy-hq` and its running container are read-only reference points. The staging checkout is a separate Git worktree based on the running image's source revision, `ad9e00d`. Staging binds only to loopback and is reached by SSH tunnel; no public hostname, DNS, reverse-proxy, or production deployment changes are in scope.

Owner decisions recorded for this design:

- Existing HermyHQ analytics may read their current production-backed sources, strictly read-only. The UI must label those values `LIVE · READ ONLY`.
- M2 Missions uses only the isolated staging API/database and must be labeled `STAGING · TEST DATA`.
- The UI displays the M2 lifecycle status exactly as returned. Do not invent an approval state, map `assigned` to “approved,” or add approve/reject actions or endpoints.
- No production writes, credential changes, or Hermes dispatch are allowed from staging.

## 2. Read-only baseline

### Original HermyHQ

- The running image is `hermy-hq:deploy-ad9e00d`; source branch `main` is at `ad9e00d`.
- The original app contains the established grouped sidebar and responsive mobile navigation in `src/components/sidebar.tsx`, app shell in `src/components/conditional-layout.tsx`, design tokens and card styles in `src/app/globals.css`, and reusable primitives in `src/components/ui/kit.tsx` and `src/components/mc/ui.tsx`.
- Existing routes cover the requested Dashboard, Org, Agents, Activity, Cost, Client Pulse, Tasks, Goals, Projects, Memory Wiki, and the external Chat link. Preserve those routes and their existing production appearance.
- The production worktree has an unrelated untracked `hermes-bridge/package-lock.json`; do not remove, stage, or copy it into the spec commit.

### Current staging prototype and M2 API

- The separate `staging/nextjs-dashboard` prototype is not based on the HermyHQ app shell. It has its own small `globals.css`, inline utility styling, and only Dashboard, Missions, Agents, and Audit routes. It is not missing HermyHQ CSS; it is a separate prototype that does not import HermyHQ's styles/components.
- The staging M2 API is healthy on loopback port 8802, separate from production port 8800. Its launcher selects a separate SQLite staging database, sets `MC_TEST_MODE=0`, and patches Hermes execution to `/bin/true`.
- The existing staging bridge has allowlisted mission reads/create, assign, cancel, audit/ledger, agent status, CSRF validation, identity mapping, and short-lived Proxy-Assertion generation. Dispatch and chat are explicitly excluded. The M2 mission state machine is `created → assigned → acknowledged → in_progress → complete/blocked/cancelled`; no distinct approval field/action exists.
- The M2 repository is on `feature/unified-dashboard-bridge` at `0b6e494` with a dirty working tree. Proxy-Assertion source is present in the current worktree, while the VERITAS reconciliation document is scoped to a different committed snapshot. Preserve all existing review/evidence files and do not treat reports against another snapshot as proof of the current runtime.
- The staging UI's two existing test identities currently derive the same operator ID. That mapping alone cannot prove cross-owner isolation. Security acceptance must include a distinct synthetic operator in isolated tests without changing production identities.
- The existing `staging/capture_screenshots.js` is not approved for reuse: it logs CSRF/session-cookie prefixes and supplies a password in a shell command line. Produce screenshots using a safe, redacted browser-vault/test-auth flow instead.

## 3. Goals and non-goals

### Goals

1. Retain the original HermyHQ visual identity, responsive shell, typography, left navigation, cards, chart styles, branding, and every existing route.
2. Add a first-class `/missions` page within the original Operate navigation and mobile navigation, using the original shared UI kit and data display conventions.
3. Support staging M2 mission listing/detail, creation, assignment, cancellation, lifecycle status, and audit/ledger history through the existing secured bridge.
4. Keep the existing production-backed analytics visible as read-only data, clearly distinguished from staging M2 data.
5. Demonstrate auth, navigation, API permissions, CSRF, owner isolation, dispatch denial, and responsive behavior in staging.
6. Provide 12 screenshots: Dashboard, Missions, Agents, and Activity at desktop, tablet, and mobile widths.

### Non-goals

- Replacing or re-skinning the original HermyHQ dashboard.
- Replacing the M2 Python backend, merging its database into HermyHQ, or adding a new approval state/API.
- Modifying production files, environment variables, credentials, database, DNS, proxy, container, or service state.
- Exposing Hermes dispatch or chat-send routes through the staging proxy.
- Pushing, merging, deploying, or requesting production-release authorization.

## 4. Proposed staging architecture

### 4.1 Isolated frontend checkout

- Use the isolated worktree `/home/bluemogul/worktrees/hermyhq-mission-command-spec` based on `ad9e00d`; never edit `/opt/hermy-hq/main` or the running production container.
- After this spec is reviewed and approved, implementation will occur only in a separate local `dev/*` branch/worktree. The staging process will bind to a verified free loopback port on h02.
- Reach the browser preview through an SSH tunnel. Do not add a public hostname or proxy route.
- Use staging-specific authentication in the worktree; do not alter or copy Google OAuth credentials, NextAuth secrets, or production identity configuration. Test principals and role mappings are staging-only.

### 4.2 Original visual foundation

- Keep the original root layout, sidebar groups, mobile header/tab bar, design tokens, Geist typography, and shared `Panel`, `Button`, `Pill`, `EmptyState`, `SectionHeader`, `StatCard`, and loading/error components.
- Add a `/missions` navigation item without removing or renaming existing destinations. Preserve the external Chat link and mark it as an external/live service; do not exercise it during staging validation.
- Keep the original Dashboard, Org, Agents, Activity, Cost, Client Pulse, Tasks, Goals, Projects, and Memory Wiki routes. Their production-backed reads remain GET-only and are labeled `LIVE · READ ONLY`.
- Any legacy control that would write to production (including task actions or Hermes dispatch) must be disabled in the staging UI and rejected by the staging API layer. The only enabled mutations in this preview are the explicitly allowlisted M2 staging operations.

### 4.3 M2 bridge and data boundary

- M2 UI requests pass through a same-origin server-side route. No M2 token, Proxy-Assertion secret, session cookie, or CSRF value is sent to browser JavaScript or included in screenshots.
- The M2 route allowlist is limited to staging-safe reads (`/api/missions`, mission detail, agent status, audit, ledger) and required staging mutations (create mission, assign, cancel). All other routes return 403/404; dispatch and chat are always denied.
- Mutations require an authenticated staging session, a mapped identity with the required permission, a valid CSRF token, and the reviewed short-lived, single-use Proxy-Assertion. The assertion's operator identity must be bound to the staging test principal, not accepted from client JSON.
- Production-backed GETs use a separate explicit GET-only allowlist. No staging route forwards POST, PUT, PATCH, or DELETE to production. If the existing production credential cannot be safely constrained to server-side reads, stop and report the missing least-privilege credential rather than weakening the boundary.
- The M2 staging process remains on 127.0.0.1:8802 and keeps its separate SQLite file, `MC_TEST_MODE=0`, and `/bin/true` dispatch stub. Do not call the dispatch endpoint.

### 4.4 Missions behavior and refresh

- Show M2 states exactly as returned, with a clear label such as `Lifecycle status`; do not render a separate approval badge or imply that assignment is approval.
- Provide create, assign, and cancel controls only when allowed by the M2 API and the staging principal's permissions. Display a confirmation for cancellation and surface API denial/errors rather than optimistic success.
- Show per-mission audit history and ledger details using existing GET endpoints.
- The reviewed UI bridge has no mission event-stream route. Use bounded no-store polling (target 10 seconds), a manual refresh action, and a visible “Updated” timestamp. Do not describe this as server-pushed streaming.
- Distinguish sources with persistent labels: original service-backed analytics = `LIVE · READ ONLY`; M2 mission records = `STAGING · TEST DATA`. Do not merge stage agent counts/test missions into production totals.

## 5. Security and independent review gates

1. Keep existing VERITAS and security-review artifacts byte-for-byte unchanged.
2. Before claiming security pass, establish the exact staging source/commit and run the approved current proxy/auth tests against the isolated staging API/database only. Reconcile the current dirty M2 worktree and prior review scope; do not quote a pass from a different snapshot.
3. Exercise a separate synthetic operator ID in an owner-isolation test. Confirm an identity cannot read or mutate another operator's mission; the current owner/agent map sharing one operator ID is insufficient for this assertion.
4. Verify unauthenticated access is rejected, unmapped identity is forbidden, agent permissions are read-only, owner mutations require CSRF, expired/replayed assertions fail, and direct browser-supplied operator IDs are ignored/rejected.
5. Verify production write paths and all Hermes-invoking paths are denied by the staging frontend proxy. Do not run live dispatch, chat-send, or a production mutation as part of testing.
6. Require an independent scoped review of the exact staging diff and the preserved VERITAS evidence before calling security acceptance complete.

## 6. Acceptance matrix

### Visual and functional

- Dashboard: original cards, analytics, branding, and `LIVE · READ ONLY` source labeling render.
- Missions: staging badge, accurate M2 lifecycle statuses, create/assign/cancel, detail/audit/ledger, no approval or dispatch control.
- Agents: original view preserved and production-backed view labeled read-only; no staged mock count shown as live.
- Activity: original view preserved; staging mission audit remains attributable and is accessible from the Missions detail.
- All original sidebar routes remain present; route changes close the mobile drawer and selected navigation works.
- Responsive screenshots: 4 pages × 3 viewports = 12 images, plus a manifest; capture through a safe authenticated staging flow without token/password logging.
- Test desktop, tablet, and mobile widths; check no horizontal overflow, inaccessible controls, or clipped nav/content.

### Security and data

- Stage owner can perform only allowlisted actions against port 8802 and the isolated staging database.
- Stage read-only/agent principal cannot create, assign, cancel, approve, or dispatch.
- Missing/invalid CSRF and proxy assertions are denied; cross-owner reads/writes fail.
- Staging proxy cannot forward writes to production, invoke Hermes, or send chat messages.
- Production-backed data requests observed during QA are GET-only; browser bundles and logs contain no server secrets or session tokens.
- `/health` for staging M2 remains healthy; production listeners and data are not changed.

### Release boundary

- Implementation remains local on a `dev/*` branch/worktree. No push, merge, deployment, public DNS, or production credential change.
- Present the actual staging UI and evidence for owner review. Do not request production authorization until the integrated interface has been demonstrated and independently validated.

## 7. Open risks to resolve during implementation

- Confirm a least-privilege server-side credential path for the existing production-backed GET-only pages. If only a broadly privileged token is available, stop before adding it to staging and request owner direction.
- Reconcile current M2 runtime/worktree with existing VERITAS reports before reusing any “pass” claim.
- Ensure the new staging auth maps distinct test principals to distinct synthetic operator identities for the isolation test, without touching production auth.
- Keep the current prototype, its database, and security evidence intact; do not overwrite or clean the dirty M2 worktree.

## 8. Approval state

This document records the approved staging-only architecture and the user's explicit data/approval-status decisions. It is a design specification only. Implementation begins only after the owner reviews and approves this document. Production release remains a separate future authorization gate.
