# Unified Mission Command Staging Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demonstrate an isolated staging build of the original HermyHQ Mission Command UI with a native M2 Missions page and verified owner-scoped M2 access.

**Architecture:** Build the UI from an independent HermyHQ clone at the deployed source revision, retaining its current shell, routes, tokens, and shared components. Keep production-backed reads behind a verified least-privilege GET-only allowlist; run the M2 UI against a separate, owner-scoped staging backend clone on a loopback port with its own fail-closed runtime workspace and Hermes stub.

**Tech Stack:** Next.js 16.1.6, React 19.2.3, NextAuth v4, Tailwind CSS v4, TypeScript, existing HermyHQ UI kit, Python stdlib M2 API, SQLite, Node built-in test runner, browser-based viewport QA.

**Spec:** `docs/superpowers/specs/2026-10-15-unified-mission-command-staging-design.md`

**Status:** Finalized for owner review; no implementation, staging startup, production change, credential change, merge, push, or deployment is authorized until a separate approval is given.

## Global Constraints

- Source baseline: HermyHQ `ad9e00d`; M2 API baseline: `feature/unified-dashboard-bridge` at `0b6e494` plus a recorded manifest of the existing staging-only working-tree files.
- Create staging source as independent local clones with their own `.git` object stores; do not use linked worktrees, hardlinks, symlinks, bind mounts, or shared `node_modules`. Never edit the live `/opt/hermy-hq/main` checkout or the shared M2 source checkout used by ports 8800/8802.
- Do not call production M2 port 8800 during tests. Do not run `tests/m2_security_verification.py` unchanged; it defaults to port 8800 and reads the protected production token file. Do not run `tests/prompt_18_security_veritas.py` unless that file is separately reviewed and explicitly approved.
- Keep the existing staging M2 service/database at 127.0.0.1:8802 intact. The unified staging M2 copy uses a new verified free loopback port (planned 8803), with disposable test workspaces and a separate UI preview workspace outside the source checkout.
- Keep `MC_TEST_MODE=0`; the staging M2 launcher must force Hermes execution to `/bin/true`. Never invoke M2 dispatch or chat-send routes.
- Production-backed data in the preview is GET-only. Deny POST, PUT, PATCH, and DELETE against production-backed routes before any upstream fetch.
- Do not copy or change production Google OAuth credentials, production NextAuth secrets, or production service credentials. Any production analytics credential must itself be verified read-only/least-privilege; a GET-only proxy over a broad credential does not meet the requirement. If no such credential exists, stop and keep those feeds unavailable rather than place a broadly privileged credential in staging.
- Generate stage identities and Proxy-Assertion HMAC material per run in memory; pass it only to the isolated server/test child processes and clear it at shutdown. Never load staging `.env` credentials or persist test identities/assertions/secrets. Production analytics credentials, if independently verified least-privilege, are injected only into the UI process from the approved secret manager and are never given to the M2 process.
- Preserve existing VERITAS and security-review documents byte-for-byte. Add new evidence instead of rewriting prior review artifacts.
- Phase A is offline-only: no M2 API or Next.js listener, no browser, no login, and no Mission Control requests. Phase B (loopback staging service/browser acceptance) requires separate explicit owner authorization and starts only after Phase A tests pass and an independent scoped review passes.
- No production modification, push, merge, deployment, DNS change, public listener, or live Hermes execution is authorized by this plan.

---

## File and workspace map

HermyHQ UI implementation clone (created only after implementation approval):

- `/home/bluemogul/worktrees/hermyhq-mission-command-staging/`
- Existing UI shell: `src/app/layout.tsx`, `src/components/conditional-layout.tsx`, `src/components/sidebar.tsx`, `src/app/globals.css`
- Shared visual components: `src/components/ui/kit.tsx`, `src/components/mc/ui.tsx`
- Existing auth: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/login/page.tsx`, `src/middleware.ts`
- Existing production MC proxy: `src/app/api/mc/[...path]/route.ts`, `src/lib/mc.ts`
- New staging proxy and helper: `src/app/api/staging-m2/[...path]/route.ts`, `src/lib/staging-m2-proxy.ts`
- New Missions route/components: `src/app/missions/page.tsx`, `src/components/missions/`
- Staging labels/policy: `src/components/staging-banner.tsx`, `src/lib/staging-policy.ts`
- Tests: `tests/staging/`

M2 backend staging-only independent clone (created only after implementation approval; its `.git` store and source files are separate from the shared checkout):

- `/home/bluemogul/recovery/mission-control-unified-staging/`
- Staging owner guard: copied `server/server.py`.
- Workspace-root overrides in the isolated copy: `server.py`, `attachments.py`, `avatars.py`, `hermes_chat.py`, `roster.py`, `settings.py`, and `store.py` (plus baseline `missions.py`/`backup.py` env support).
- New staging launcher and non-secret config template: `staging/unified_m2.py`, `staging/unified_m2.env.example`.
- Phase B API test supervisor: `tests/staging/run_owner_http.py`; generate all signing material and test identities in memory, no dotenv.
- Remote preview API supervisor: `staging/serve_preview_api.py`; read one validated JSON config from SSH stdin, launch only the isolated API, and stop with the parent SSH session.
- Phase A supervisor parser test: `tests/staging/test_preview_api_supervisor.py`; exercise only the pure config/path/environment builder, never child processes or sockets.
- Disposable owner-isolation runtime workspaces: `/home/bluemogul/recovery/mission-control-unified-runtime/owner-tests/$RUN_ID/`.
- Separate unified UI preview workspaces: `/home/bluemogul/recovery/mission-control-unified-runtime/unified-preview/$PREVIEW_ID/`.
- Keep every runtime database, attachment, backup, and profile outside the source clone and beneath its approved external runtime workspace.
- Phase A offline regressions: `tests/staging/test_workspace_isolation.py`, `tests/staging/test_owner_scope_helper.py`, `tests/staging/test_owner_http_driver.py`, and `tests/staging/test_preview_api_supervisor.py`; all supervisor tests exercise pure builders only, never launch processes or open sockets.
- Phase B HTTP regression source: `tests/staging/test_mission_owner_isolation.py`; execute it only through `run_owner_http.py` after Phase B authorization.

Source-specific harness constraint: baseline `0b6e494` provides the Python `server/server.py` and `proxy/auth.py` Proxy-Assertion path, but no `tests/m2_staging_harness.py`, `FakeSupabaseAuth`, or `MockDispatcher`. Do not add unsupported imports or substitute another backend. Use the in-memory synthetic Proxy-Assertion driver and `/bin/true`; if the source baseline changes or this boundary cannot be proven, stop and request a revised security review.

Runtime boundaries:

- Existing production M2 listener: `127.0.0.1:8800` — do not call or modify.
- Existing staging baseline: `127.0.0.1:8802` — leave running and unchanged.
- New unified staging M2 listener: `127.0.0.1:8803` if free; otherwise choose another verified free loopback port, never 8800/8802.
- HermyHQ staging UI: a verified free loopback port on h02 (planned 3010); reach it through SSH tunnel.
- Tunnel M2 staging from h02 to trade-02 on a separate h02 loopback port (planned 18803); the UI proxy uses only that local forwarded port.

## Task 1: Isolate the M2 staging source and prove the owner-isolation bug (RED)

**Files:**
- Create isolated M2 stage copy at `/home/bluemogul/recovery/mission-control-unified-staging/`.
- Create Phase A offline tests `tests/staging/test_workspace_isolation.py` and `tests/staging/test_owner_scope_helper.py` in that clone.
- Author Phase B `tests/staging/test_mission_owner_isolation.py` and `tests/staging/run_owner_http.py` as source only, plus the offline `tests/staging/test_owner_http_driver.py`; execute the API supervisor only after separate Phase B authorization. Do not run an API test or start a service in Phase A.
- Modify workspace defaults only in the independent clone; do not modify the shared M2 checkout or its `server/server.py`.
- Phase A tests use external scratch paths, import flat modules in fresh subprocesses, and must not initialize SQLite or start a server/browser.

**Interfaces:**
- `OperatorClient.request(method: str, path: str, body: dict | None = None) -> tuple[int, dict]` signs a fresh Proxy-Assertion for its configured synthetic `sub` and `operator_id` on every request; it does not print or persist the assertion.
- The Phase B `tests/staging/run_owner_http.py` driver creates `M2_TEST_BASE_URL`, a fresh `MC_PROXY_SECRET`, distinct synthetic owner `sub` values, and per-run auth tokens in memory; it passes only an explicit sanitized environment to the isolated server/test subprocess and never writes credentials/assertions to disk or output. The two tokens derive different 16-hex operator IDs via the M2 SHA-256 convention.
- `UNIFIED_M2_WORKSPACE` is a fresh run-specific directory beneath `/home/bluemogul/recovery/mission-control-unified-runtime/`, outside both source clones. Reject the root itself, paths outside it, and symlink escapes before imports; every effective workspace, database, attachment, backup, and profile path must resolve beneath the selected workspace before DB initialization.

- [ ] **Step 1: Capture the exact staging source baseline.** Record the existing M2 branch/commit, tracked `git diff --name-only`, untracked runtime source paths, and SHA-256 hashes of the files copied into the new staging clone. Verify the target directory does not exist and the source commit is exactly `0b6e494`; create a full independent clone with its own object store, then a local staging branch and copy only the reviewed runtime delta:

```bash
set -euo pipefail
test ! -e /home/bluemogul/recovery/mission-control-unified-staging
git clone --no-hardlinks --no-checkout \
  /home/bluemogul/recovery/blue-mogul-mission-control-20261010 \
  /home/bluemogul/recovery/mission-control-unified-staging
git -C /home/bluemogul/recovery/mission-control-unified-staging remote remove origin
if git -C /home/bluemogul/recovery/mission-control-unified-staging show-ref --verify --quiet refs/heads/dev/mission-command-unified-m2-staging; then
  printf 'Unexpected local staging branch exists; stop.' >&2
  exit 1
fi
git -C /home/bluemogul/recovery/mission-control-unified-staging checkout \
  -b dev/mission-command-unified-m2-staging 0b6e494
test "$(git -C /home/bluemogul/recovery/mission-control-unified-staging rev-parse --short HEAD)" = 0b6e494

test ! -e /home/bluemogul/recovery/mission-control-unified-staging/proxy
mkdir -p /home/bluemogul/recovery/mission-control-unified-staging/proxy
cp -p /home/bluemogul/recovery/blue-mogul-mission-control-20261010/server/server.py \
  /home/bluemogul/recovery/mission-control-unified-staging/server/server.py
for MODULE in __init__.py auth.py bridge.py mapping.py; do
  test -f "/home/bluemogul/recovery/blue-mogul-mission-control-20261010/proxy/$MODULE"
  cp -p "/home/bluemogul/recovery/blue-mogul-mission-control-20261010/proxy/$MODULE" \
    "/home/bluemogul/recovery/mission-control-unified-staging/proxy/$MODULE"
done
mkdir -p /home/bluemogul/recovery/mission-control-unified-staging/tests
test ! -e /home/bluemogul/recovery/mission-control-unified-staging/tests/test_proxy_auth.py
test ! -e /home/bluemogul/recovery/mission-control-unified-staging/tests/test_proxy_bridge.py
cp -p /home/bluemogul/recovery/blue-mogul-mission-control-20261010/tests/test_proxy_auth.py \
  /home/bluemogul/recovery/mission-control-unified-staging/tests/test_proxy_auth.py
cp -p /home/bluemogul/recovery/blue-mogul-mission-control-20261010/tests/test_proxy_bridge.py \
  /home/bluemogul/recovery/mission-control-unified-staging/tests/test_proxy_bridge.py
mkdir -p /home/bluemogul/recovery/mission-control-unified-staging/staging \
  /home/bluemogul/recovery/mission-control-unified-staging/tests/staging
{
  git -C /home/bluemogul/recovery/blue-mogul-mission-control-20261010 branch --show-current
  git -C /home/bluemogul/recovery/blue-mogul-mission-control-20261010 rev-parse --short HEAD
  git -C /home/bluemogul/recovery/blue-mogul-mission-control-20261010 diff --name-only
  git -C /home/bluemogul/recovery/blue-mogul-mission-control-20261010 status --short --untracked-files=all
  sha256sum \
    /home/bluemogul/recovery/blue-mogul-mission-control-20261010/server/server.py \
    /home/bluemogul/recovery/mission-control-unified-staging/server/server.py \
    /home/bluemogul/recovery/blue-mogul-mission-control-20261010/proxy/*.py \
    /home/bluemogul/recovery/mission-control-unified-staging/proxy/*.py \
    /home/bluemogul/recovery/blue-mogul-mission-control-20261010/tests/test_proxy_auth.py \
    /home/bluemogul/recovery/mission-control-unified-staging/tests/test_proxy_auth.py \
    /home/bluemogul/recovery/blue-mogul-mission-control-20261010/tests/test_proxy_bridge.py \
    /home/bluemogul/recovery/mission-control-unified-staging/tests/test_proxy_bridge.py
} > /home/bluemogul/recovery/mission-control-unified-staging/staging/source-manifest.txt
```

Before this command, the target path is checked absent. After clone, verify the local branch is absent before creating it; stop on any unexpected state. In the source manifest, require the tracked runtime delta to match the reviewed `server/server.py` change and the untracked runtime inputs to be the specific `proxy/` and focused proxy test files; if additional runtime files appear, stop and review them rather than copying broadly. Save source/target hashes and the full tracked/untracked manifest in `staging/source-manifest.txt`. Never copy `.env*`, tokens, runtime databases, attachments, screenshots, or the current hard-coded-secret launcher. Inspect every selected `proxy/*.py` and test file for embedded credentials before copying; stop if any real secret appears and redact only within the independent clone after scope approval. Static-audit the nine path-owning modules (`server.py`, `attachments.py`, `avatars.py`, `backup.py`, `hermes_chat.py`, `missions.py`, `roster.py`, `settings.py`, `store.py`) and confirm imports have no DB/network/server side effects; the audit found `migrate_prompt17.py` has a hard-coded DB path and must never be imported or run.

- [ ] **Step 2: Write a workspace-isolation regression before changing path defaults.** Create `tests/staging/test_workspace_isolation.py`:

```python
import os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRATCH_ROOT = Path("/home/bluemogul/recovery/mission-control-unified-runtime").resolve()
WORKSPACE = Path(os.environ["UNIFIED_M2_WORKSPACE"]).resolve()
assert WORKSPACE != SCRATCH_ROOT and WORKSPACE.is_relative_to(SCRATCH_ROOT)
WORKSPACE.mkdir(parents=True, exist_ok=True)
PROFILE_DIR = WORKSPACE / "profiles"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)
assert not any(PROFILE_DIR.iterdir())
os.environ["MC_WORKSPACE"] = str(WORKSPACE)
os.environ["HERMES_PROFILES_DIR"] = str(PROFILE_DIR)
os.environ["HERMES_BIN"] = "/bin/true"
sys.path.insert(0, str(ROOT / "server"))
import server as srv
import attachments, avatars, backup, hermes_chat, missions, roster, settings, store

MODULES = (srv, attachments, avatars, backup, hermes_chat, missions, roster, settings, store)
for module in MODULES:
    workspace = Path(module.WORKSPACE).resolve()
    data_dir = Path(module.DATA_DIR).resolve()
    db_path = Path(module.DB_PATH).resolve()
    assert workspace == WORKSPACE
    assert data_dir.is_relative_to(WORKSPACE)
    assert db_path.is_relative_to(WORKSPACE)
    assert db_path.name == "mission-control.db"
    for attr in ("ATTACHMENTS_DIR", "BACKUP_DIR"):
        if hasattr(module, attr):
            assert Path(getattr(module, attr)).resolve().is_relative_to(WORKSPACE)
    assert not db_path.exists()
assert Path(avatars.HERMES_PROFILES_DIR).resolve() == PROFILE_DIR
```

Run in a fresh Python process with `UNIFIED_M2_WORKSPACE` pointing beneath `/home/bluemogul/recovery/mission-control-unified-runtime/path-tests/`. This test must not initialize SQLite or start an HTTP server. Import flat `server` first, then the remaining modules; never import `server.paths` as a package.

```bash
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
env -i PATH="$PATH" HOME="$HOME" \
  UNIFIED_M2_WORKSPACE="/home/bluemogul/recovery/mission-control-unified-runtime/path-tests/$RUN_ID" \
  python3 tests/staging/test_workspace_isolation.py
```

Expected RED: modules whose `WORKSPACE` ignores `MC_WORKSPACE` resolve outside the scratch root. If the static audit finds an import side effect, stop and redesign the pure path check before running this test.

- [ ] **Step 3: Make workspace paths fail-closed in the isolated copy, then add the launcher.** In the copy only, replace active `WORKSPACE` defaults in `server.py`, `attachments.py`, `avatars.py`, `backup.py`, `hermes_chat.py`, `missions.py`, `roster.py`, `settings.py`, and `store.py` with `Path(os.environ["MC_WORKSPACE"]).resolve()`—no production-path fallback. `migrate_prompt17.py` remains excluded. Then add `staging/unified_m2.py`:

```python
import os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRATCH_ROOT = Path("/home/bluemogul/recovery/mission-control-unified-runtime").resolve()
WORKSPACE = Path(os.environ["UNIFIED_M2_WORKSPACE"]).resolve()
if WORKSPACE == SCRATCH_ROOT or not WORKSPACE.is_relative_to(SCRATCH_ROOT):
    raise SystemExit("UNIFIED_M2_WORKSPACE must be a run-specific child of the approved scratch root")
WORKSPACE.mkdir(parents=True, exist_ok=True)
PROFILE_DIR = WORKSPACE / "profiles"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)
if any(PROFILE_DIR.iterdir()):
    raise SystemExit("staging Hermes profile directory must be empty")
os.environ["MC_WORKSPACE"] = str(WORKSPACE)
os.environ["MC_TEST_MODE"] = "0"
os.environ["HERMES_PROFILES_DIR"] = str(PROFILE_DIR)
os.environ["HERMES_BIN"] = "/bin/true"
sys.path.insert(0, str(ROOT / "server"))
import server as srv
import attachments, avatars, backup, hermes_chat, missions, roster, settings, store

MODULES = (srv, attachments, avatars, backup, hermes_chat, missions, roster, settings, store)
for module in MODULES:
    if Path(module.WORKSPACE).resolve() != WORKSPACE:
        raise SystemExit(f"workspace escape in module {module.__name__}")
    for attr in ("DATA_DIR", "DB_PATH"):
        path = Path(getattr(module, attr)).resolve()
        if not path.is_relative_to(WORKSPACE):
            raise SystemExit(f"{attr} escape in module {module.__name__}")
    if Path(module.DB_PATH).name != "mission-control.db":
        raise SystemExit(f"unexpected database filename in module {module.__name__}")
    for attr in ("ATTACHMENTS_DIR", "BACKUP_DIR"):
        if hasattr(module, attr) and not Path(getattr(module, attr)).resolve().is_relative_to(WORKSPACE):
            raise SystemExit(f"{attr} escape in module {module.__name__}")
if Path(avatars.HERMES_PROFILES_DIR).resolve() != PROFILE_DIR:
    raise SystemExit("Hermes profiles are not confined to the empty staging directory")
if hermes_chat.HERMES_BIN != "/bin/true":
    raise SystemExit("Hermes execution must remain stubbed")

srv.HOST = "127.0.0.1"
srv.PORT = int(os.environ["UNIFIED_M2_PORT"])
if srv.PORT in (8800, 8802) or not 1024 <= srv.PORT <= 65535:
    raise SystemExit("refusing reserved/invalid M2 staging port")
srv.MC_TEST_MODE = "0"
hermes_chat.HERMES_BIN = "/bin/true"
if __name__ == "__main__":
    srv.init_db()
    srv.run()
```

Create `staging/unified_m2.env.example` with only these non-secret defaults:

```dotenv
MC_TEST_MODE=0
UNIFIED_M2_PORT=8803
```

`UNIFIED_M2_WORKSPACE` is set per-run beneath the approved external scratch root. The example contains no auth values; no stage credential file is created or loaded.

The Phase B supervisor generates the Proxy-Assertion HMAC secret and synthetic operator identity tokens in memory and launches the isolated server with an explicit sanitized environment allowlist. Do not read `.env`, production auth variables, Supabase service-role keys, or live Hermes profiles. Include `MC_AUTH_TOKEN`/`MC_SERVICE_TOKEN` only if source tracing proves they are required, and then use fresh synthetic values generated in memory. Clear inherited `MC_*` and `SUPABASE_*` values. The launcher sets `HERMES_BIN=/bin/true` and `HERMES_PROFILES_DIR` to a verified-empty directory under the isolated workspace; never mount or copy live Hermes profiles. Its explicit startup path guards must pass before `srv.init_db()` or `srv.run()`; do not use Python `assert` for these guards. Bind only to loopback; never store runtime databases, attachments, test keys, or assertions inside the source clone or runtime workspace.

`staging/serve_preview_api.py` accepts exactly one JSON config on SSH stdin with `port`, `workspace`, `proxy_secret`, and `runtime_root`; it validates types, port exclusions, canonical path containment, and the env allowlist before launching the API child. Its pure `build_child_env(config) -> dict[str, str]` returns only `PATH`, `HOME`, `MC_PROXY_SECRET`, `MC_TEST_MODE=0`, `UNIFIED_M2_PORT`, `UNIFIED_M2_WORKSPACE`, `HERMES_BIN=/bin/true`, and `HERMES_PROFILES_DIR`. The Phase A parser test uses fake values and verifies no process, socket, database, or file is created. The remote supervisor prints a redacted ready marker only and stops the API child when its SSH parent exits.

- [ ] **Step 4: Run the workspace-isolation regression GREEN and commit the path-only change.** Run the same clean-process test with a fresh `UNIFIED_M2_WORKSPACE`; require every path check to pass and confirm no database file was created by this test. Review the path-only diff, run `git diff --check`, then commit the isolated workspace-root changes separately from the owner-authorization fix:

```bash
git -C /home/bluemogul/recovery/mission-control-unified-staging add \
  server/server.py server/attachments.py server/avatars.py server/backup.py \
  server/hermes_chat.py server/missions.py server/roster.py server/settings.py \
  server/store.py staging/unified_m2.py staging/unified_m2.env.example \
  staging/source-manifest.txt tests/staging/test_workspace_isolation.py
git -C /home/bluemogul/recovery/mission-control-unified-staging commit \
  -m "staging: fail closed on M2 workspace paths"
```

- [ ] **Step 5: Write the failing Phase A owner-helper test before changing the owner check.** Create `tests/staging/test_owner_scope_helper.py`; this test calls the authorization helper directly and opens no database or listener:

```python
import os, sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRATCH_ROOT = Path("/home/bluemogul/recovery/mission-control-unified-runtime").resolve()
WORKSPACE = Path(os.environ["UNIFIED_M2_WORKSPACE"]).resolve()
if WORKSPACE == SCRATCH_ROOT or not WORKSPACE.is_relative_to(SCRATCH_ROOT):
    raise SystemExit("test workspace outside approved scratch root")
WORKSPACE.mkdir(parents=True, exist_ok=True)
os.environ["MC_WORKSPACE"] = str(WORKSPACE)
os.environ["MC_TEST_MODE"] = "0"
os.environ["HERMES_PROFILES_DIR"] = str(WORKSPACE / "profiles")
os.environ["HERMES_BIN"] = "/bin/true"
sys.path.insert(0, str(ROOT / "server"))
import server as srv
from proxy.auth import derive_operator_id

OWNER_A = derive_operator_id("synthetic-owner-a-test")
OWNER_B = derive_operator_id("synthetic-owner-b-test")
MISSION = {"mission_id": "offline-owner-fixture", "creator": OWNER_A}
if OWNER_A == OWNER_B:
    raise SystemExit("test operators must derive distinct IDs")
db_path = Path(srv.DB_PATH).resolve()
if not db_path.is_relative_to(WORKSPACE) or db_path.exists():
    raise SystemExit("offline helper test must use an absent database path under its scratch workspace")

class OwnerReadGuardTest(unittest.TestCase):
    def test_owner_is_allowed(self):
        srv._authorize_mission_read("operator", OWNER_A, MISSION)

    def test_second_operator_is_denied(self):
        with self.assertRaises(srv.ApiError):
            srv._authorize_mission_read("operator", OWNER_B, MISSION)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 6: Run this helper test RED in a fresh process.** Phase A uses only the helper test; do not start the API, a Next.js listener, or a browser.

```bash
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
env -i PATH="$PATH" HOME="$HOME" \
  UNIFIED_M2_WORKSPACE="/home/bluemogul/recovery/mission-control-unified-runtime/owner-tests/helper-red-$RUN_ID" \
  python3 tests/staging/test_owner_scope_helper.py
```

Expected RED: the unittest reports that `ApiError` was not raised for operator B; no SQLite file is created and no listener starts.

- [ ] **Step 7: Define the Phase B HTTP owner-read regression for later authorized staging.** Create `tests/staging/test_mission_owner_isolation.py`; write the code now, but do not execute it until separate Phase B authorization:

```python
import json, os, urllib.error, urllib.request
from proxy.auth import create_proxy_assertion, derive_operator_id

BASE = os.environ["M2_TEST_BASE_URL"]
PROXY_SECRET = os.environ["MC_PROXY_SECRET"]

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, "redirect denied in loopback test", headers, fp)

OPENER = urllib.request.build_opener(NoRedirect())

class OperatorClient:
    def __init__(self, sub, operator_id):
        self.sub, self.operator_id = sub, operator_id
    def request(self, method, path, body=None):
        assertion = create_proxy_assertion(self.sub, self.operator_id, PROXY_SECRET)
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(BASE + path, data=data, method=method, headers={
            "Authorization": "Proxy-Assertion " + assertion,
            "Content-Type": "application/json",
        })
        try:
            with OPENER.open(req, timeout=5) as response:
                return response.status, json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read() or b"{}")

def test_owner_scope_detail_audit_ledger():
    owner_a = OperatorClient(os.environ["STAGING_OWNER_A_SUB"], derive_operator_id(os.environ["STAGING_OWNER_A_AUTH_TOKEN"]))
    owner_b = OperatorClient(os.environ["STAGING_OWNER_B_SUB"], derive_operator_id(os.environ["STAGING_OWNER_B_AUTH_TOKEN"]))
    assert owner_a.operator_id != owner_b.operator_id
    status, created = owner_a.request("POST", "/api/missions", {
        "title":"Owner isolation regression", "assignee":"stage-agent-a",
        "description":"isolated staging fixture", "priority":"normal"})
    assert status == 201
    mission_id = created["mission"]["mission_id"]
    for suffix in ("", "/audit", "/ledger"):
        path = f"/api/missions/{mission_id}{suffix}"
        assert owner_a.request("GET", path)[0] == 200
        assert owner_b.request("GET", path)[0] == 403
    status, owner_b_list = owner_b.request("GET", "/api/missions")
    assert status == 200
    assert all(row["mission_id"] != mission_id for row in owner_b_list["missions"])

if __name__ == "__main__":
    test_owner_scope_detail_audit_ledger()
```

The file above is test source only; never invoke it directly. Create `tests/staging/run_owner_http.py` as the only Phase B entry point. It generates a random Proxy-Assertion key, two synthetic subjects, and two distinct synthetic auth tokens using Python `secrets` in memory; clears inherited `MC_*`/`SUPABASE_*` values rather than reading them; creates a `tempfile.TemporaryDirectory` under the approved external runtime root; inserts only the isolated clone root on `sys.path` for the test module; starts `staging/unified_m2.py` bound only to `127.0.0.1`; waits for its loopback health response; sets only the generated in-memory test variables and invokes `test_owner_scope_detail_audit_ledger()` via `runpy`; then restores the parent environment and terminates/waits for that exact server process in `finally`. Send no environment files to either process, do not print secrets/assertions, redirect server logs to `DEVNULL`, and delete the disposable workspace at exit. Expose `build_api_env(workspace: Path, port: int, proxy_secret: str, path: str, home: str) -> dict[str, str]`, returning only `PATH`, `HOME`, `MC_PROXY_SECRET`, `MC_TEST_MODE=0`, `UNIFIED_M2_PORT`, `UNIFIED_M2_WORKSPACE`, `HERMES_BIN=/bin/true`, and `HERMES_PROFILES_DIR`; if source tracing shows another required variable, use a fresh synthetic value and document it explicitly. The Phase A `test_owner_http_driver.py` passes fake values to this pure builder, injects dummy inherited `MC_*`/`SUPABASE_*` variables, and asserts the output has only the allowlisted keys/values and no secret persistence; it never calls the launcher, subprocess, socket, or API.

**Optional safety extension, pending separate owner authorization and independent review:** If assign/cancel controls are to be enabled, add this second test using the same `OperatorClient` helper and distinct owner identities. Do not enable the controls until the isolated guard passes this test and an independent reviewer approves the exact change. If any gate is missing, omit the mutation-guard change and keep those UI controls disabled.

```python
def test_owner_scope_assign_cancel():
    owner_a = OperatorClient(os.environ["STAGING_OWNER_A_SUB"], derive_operator_id(os.environ["STAGING_OWNER_A_AUTH_TOKEN"]))
    owner_b = OperatorClient(os.environ["STAGING_OWNER_B_SUB"], derive_operator_id(os.environ["STAGING_OWNER_B_AUTH_TOKEN"]))
    assert owner_a.operator_id != owner_b.operator_id
    status, created = owner_a.request("POST", "/api/missions", {
        "title":"Owner transition regression", "assignee":"stage-agent-a",
        "description":"isolated staging fixture", "priority":"normal"})
    assert status == 201
    mission_id = created["mission"]["mission_id"]
    assert owner_b.request("POST", f"/api/missions/{mission_id}/assign", {"assignee":"stage-agent-b"})[0] == 403
    assert owner_b.request("POST", f"/api/missions/{mission_id}/cancel", {"reason":"foreign owner"})[0] == 403
    assert owner_a.request("POST", f"/api/missions/{mission_id}/assign", {"assignee":"stage-agent-a"})[0] == 200
    assert owner_a.request("POST", f"/api/missions/{mission_id}/cancel", {"reason":"owner cleanup"})[0] == 200
```

The Phase B HTTP regression and optional mutation test source above are written now but remain unexecuted until a separate Phase B authorization. Do not start a service or issue Mission Control requests in Phase A.

- [ ] **Step 8: Confirm the owner field and handler path.** Trace mission creation's `creator` assignment into `handle_mission_get`, `handle_mission_audit`, and `handle_mission_ledger`. Confirm `operator_id` is the value persisted as creator. This is a source-only trace; trace assign/cancel only if the optional mutation-owner extension is authorized.

- [ ] **Step 9: Commit the RED offline owner-helper test and deferred Phase B API test source.**

```bash
git -C /home/bluemogul/recovery/mission-control-unified-staging add \
  tests/staging/test_owner_scope_helper.py tests/staging/test_mission_owner_isolation.py
git -C /home/bluemogul/recovery/mission-control-unified-staging commit \
  -m "test: specify M2 owner isolation with distinct operators"
```

Never stage files from the shared M2 checkout.

## Task 2: Add the minimal staging-only owner guard (GREEN)

**Files:**
- Modify only `/home/bluemogul/recovery/mission-control-unified-staging/server/server.py`.
- Phase A test: `/home/bluemogul/recovery/mission-control-unified-staging/tests/staging/test_owner_scope_helper.py`.
- Phase B HTTP test: `/home/bluemogul/recovery/mission-control-unified-staging/tests/staging/test_mission_owner_isolation.py` (not run until separate authorization).

**Interfaces:**
- Operator read authorization receives `actor_type`, `operator_id`, and the mission row; it returns only when `mission.creator == operator_id`, otherwise raises the existing `ApiError(403, ...)` shape.
- Creator checks for operator assign/cancel are a proposed safety extension, not a baseline requirement; keep those UI controls disabled unless the owner approves and the staging guard/test is implemented.
- Existing agent-vs-operator H1/H2 checks, session/CSRF checks, Proxy-Assertion verification, rate limits, and dispatch denial remain unchanged.

- [ ] **Step 1: Add the creator-scope assertion to the existing read helper.** Do not weaken or bypass `_check_proxy_auth`, `_check_session_auth`, or CSRF validation. Detail, per-mission audit, and ledger already call `_authorize_mission_read`; the shared operator read branch is the narrow point to enforce creator scope.

```python
if actor_type == "operator":
    if mission.get("creator") != operator_id:
        raise ApiError(403, "Forbidden — mission belongs to another operator")
    return
```

**Optional safety extension, pending separate owner authorization and independent review:** If assign/cancel controls are to be enabled, add the same creator guard before those operator transitions:

```python
if action in ("assign", "cancel"):
    if actor_type != "operator":
        raise ApiError(403, f"Forbidden — only operators can {action} missions")
    if mission.get("creator") != operator_id:
        raise ApiError(403, "Forbidden — mission belongs to another operator")
    return
```

Keep the existing agent-only acknowledge/start/complete/block branch unchanged. Leave dispatch unreachable from the UI proxy and do not call it in tests. If separate owner authorization, two-operator tests, or independent review is missing, leave assign/cancel handlers unchanged and keep the corresponding UI controls disabled.

- [ ] **Step 2: Run Phase A tests offline in a fresh process.** Do not start the M2 API, Next.js, browser, or any Mission Control service. Run the helper regression with a new scratch workspace, then run only the reviewed, side-effect-free proxy/auth unit suites using stage-only synthetic values. If either proxy test reads a protected token file, opens a socket, or touches a database, stop and replace it with a scoped offline test rather than running it.

```bash
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
HELPER_WORKSPACE="/home/bluemogul/recovery/mission-control-unified-runtime/owner-tests/helper-green-$RUN_ID"
env -i PATH="$PATH" HOME="$HOME" \
  UNIFIED_M2_WORKSPACE="$HELPER_WORKSPACE" \
  python3 tests/staging/test_owner_scope_helper.py
UNIT_WORKSPACE="/home/bluemogul/recovery/mission-control-unified-runtime/proxy-tests/$RUN_ID"
mkdir -p "$UNIT_WORKSPACE/profiles"
# Fixed test-only fixture strings, not credentials and not accepted by any live listener.
env -i PATH="$PATH" HOME="$HOME" MC_WORKSPACE="$UNIT_WORKSPACE" \
  HERMES_PROFILES_DIR="$UNIT_WORKSPACE/profiles" HERMES_BIN=/bin/true MC_TEST_MODE=0 \
  MC_PROXY_SECRET=offline-unit-only MC_AUTH_TOKEN=offline-unit-auth \
  MC_SERVICE_TOKEN=offline-unit-service MC_ALLOW_BEARER_AUTH=1 \
  python3 tests/test_proxy_auth.py
env -i PATH="$PATH" HOME="$HOME" python3 tests/test_proxy_bridge.py
```

Expected: helper unit test passes for owner A and rejects owner B; proxy/auth and bridge tests pass without connecting to any M2 listener or opening a database.

- [ ] **Step 3: Re-run the no-server path preflight.** In a fresh Python process, require every workspace/data/database/attachment/backup path beneath the selected external `UNIFIED_M2_WORKSPACE`, require the database file to remain absent, confirm the Hermes profile directory is empty, and `HERMES_BIN` is `/bin/true`. Review the launcher guards statically: bind host is exactly `127.0.0.1` and port 8800/8802 or out-of-range ports terminate before `init_db()`. Do not start a listener or inspect system ports in Phase A.

```bash
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
env -i PATH="$PATH" HOME="$HOME" \
  UNIFIED_M2_WORKSPACE="/home/bluemogul/recovery/mission-control-unified-runtime/path-tests/final-$RUN_ID" \
  python3 tests/staging/test_workspace_isolation.py
```

- [ ] **Step 4: Commit the staging-only owner-read guard.** If the optional mutation extension is separately authorized and reviewed, commit its guard/tests separately after its two-operator suite passes. Keep all commits local to the independent M2 clone; never copy changes back to the shared checkout.

```bash
git -C /home/bluemogul/recovery/mission-control-unified-staging add server/server.py
git -C /home/bluemogul/recovery/mission-control-unified-staging commit \
  -m "fix: scope M2 mission reads to creator"
```

## Task 3: Add staging-only auth and a constrained M2 proxy in HermyHQ

**Files:**
- Create `src/lib/auth.staging.ts`, `src/lib/staging-m2-proxy.ts`, and `src/lib/staging-policy.ts`.
- Modify `src/app/api/auth/[...nextauth]/route.ts`, `src/app/login/page.tsx`, and `src/middleware.ts` in the isolated HermyHQ clone only.
- Create `src/app/api/staging-m2/[...path]/route.ts`, `tests/staging/staging-m2-proxy.test.ts`, and `tests/staging/test_preview_supervisor.py`.
- Create `scripts/run_unified_preview.py` to generate test-only auth/proxy keys in memory, pass an allowlisted one-run configuration over an SSH stdin stream to the remote M2 supervisor, open the loopback-only forward, and start/stop Next.js in one cleanup-protected foreground process.
- Add only the non-secret `.env.staging.example`; do not create or load `.env.local` or any credential file.

Create `.env.staging.example` with non-secret routing defaults only:

```dotenv
STAGING_MODE=1
NEXTAUTH_URL=http://localhost:3010
M2_STAGING_URL=http://127.0.0.1:18803
```

Do not include production URLs or any token/secret field in this template.

**Precondition (execute only after separate implementation authorization):** create an independent UI clone with its own `.git` object store, based exactly on deployed revision `ad9e00d`; install dependencies from that clone's lockfile. Never use a linked worktree, hardlinks, symlinks, bind mounts, production `node_modules`, or the live checkout.

```bash
set -euo pipefail
test ! -e /home/bluemogul/worktrees/hermyhq-mission-command-staging
git clone --no-hardlinks --no-checkout /opt/hermy-hq /home/bluemogul/worktrees/hermyhq-mission-command-staging
git -C /home/bluemogul/worktrees/hermyhq-mission-command-staging remote remove origin
git -C /home/bluemogul/worktrees/hermyhq-mission-command-staging checkout \
  -b dev/mission-command-unified-staging ad9e00d
test "$(git -C /home/bluemogul/worktrees/hermyhq-mission-command-staging rev-parse --short HEAD)" = ad9e00d
cd /home/bluemogul/worktrees/hermyhq-mission-command-staging && npm ci
```

`scripts/run_unified_preview.py` is the only preview entry point. After Phase B authorization it verifies the selected M2/UI/forward ports are free; generates `NEXTAUTH_SECRET`, the Proxy-Assertion key, and owner-A/owner-B/agent identities in memory; starts `ssh -N -L 127.0.0.1:18803:127.0.0.1:${M2_PORT}` as a managed child; sends one allowlisted JSON config via SSH stdin to the remote `staging/serve_preview_api.py`; and runs Next.js bound to `127.0.0.1:3010` with the same ephemeral identity/key map. The remote supervisor validates the workspace beneath the external runtime root, starts the M2 copy with `MC_TEST_MODE=0`, `/bin/true`, and an empty profile directory, emits only a redacted ready marker, and remains alive until the parent stops it. The parent stops Next.js, the tunnel, and remote API in `finally`. It creates no `.env.local`, writes no auth material, and never prints the SSH config, secrets, assertions, or session cookies. If the SSH-stream supervisor cannot be made fail-closed, do not fall back to a persistent credential file; stop and request a revised security review.

The UI uses `M2_STAGING_URL=http://127.0.0.1:18803`. For the owner's Windows preview, open a separate PowerShell tunnel to h02 with `ssh -N -L 3010:127.0.0.1:3010 bluemogul@5.78.116.116`; browse `http://localhost:3010`. The preview runner is Phase B only and must not run under the documentation/planning authorization.

**Interfaces:**
- Staging auth is selected only when `STAGING_MODE=1`; it never loads Google OAuth credentials. A loopback-only, no-password identity picker supplies owner A, owner B, and agent with distinct synthetic `sub` values; owner A/B map to distinct operator IDs. `scripts/run_unified_preview.py` generates `NEXTAUTH_SECRET` and identities in memory for one run only.
- `export type StageIdentityConfig = { identities: Array<{ sub: string; role: "owner" | "agent"; authToken: string }> }` and `resolveStagingIdentity(session: Session | null, config: StageIdentityConfig): { operatorId: string; role: "owner" | "agent" } | null` are defined in `src/lib/auth.staging.ts`; the config is process-memory/server-only and the resolver derives operator IDs with SHA-256(token) truncated to 16 hex characters, matching M2 `derive_operator_id`. No `.env` file or real password is used.
- `classifyStagingRequest(method: string, path: string): "staging-m2" | "live-get" | "deny"` is implemented in `src/lib/staging-policy.ts`.
- `handleStagingM2Request(request: Request, session: Session | null, fetchImpl: typeof fetch): Promise<Response>` is implemented in `src/lib/staging-m2-proxy.ts`; it validates the session, identity map, permission, and CSRF before calling `fetchImpl`, then signs a 30-second, one-use Proxy-Assertion server-side.
- In `scripts/run_unified_preview.py`, define `@dataclass(frozen=True) class PreviewIdentity: sub: str; role: Literal["owner", "agent"]; auth_token: str` and `@dataclass(frozen=True) class PreviewConfig: nextauth_url: str; nextauth_secret: str; m2_staging_url: str; proxy_secret: str; owner_a: PreviewIdentity; owner_b: PreviewIdentity; agent: PreviewIdentity`. `build_preview_env(config: PreviewConfig) -> dict[str, str]` returns only `STAGING_MODE`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `M2_STAGING_URL`, `MC_PROXY_SECRET`, and the three identities' `SUB`/`ROLE`/`AUTH_TOKEN` values. The offline `test_preview_supervisor.py` proves the environment is an explicit allowlist, contains only supplied per-run test keys, and excludes inherited production OAuth/MC/Supabase values. The actual launcher never reads dotenv files or prints secret values.

- [ ] **Step 1: Write policy tests first.** Add tests proving production-backed writes, Hermes dispatch, and chat-send are denied before `fetch`; only the explicit M2 stage route set is proxied.

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Session } from "next-auth";
import { resolveStagingIdentity, type StageIdentityConfig } from "../../src/lib/auth.staging";
import { classifyStagingRequest } from "../../src/lib/staging-policy";
import { handleStagingM2Request } from "../../src/lib/staging-m2-proxy";

test("staging denies production task writes", () => {
  assert.equal(classifyStagingRequest("POST", "/api/mc/tasks/12/start"), "deny");
});

test("staging denies Hermes dispatch and chat send", () => {
  assert.equal(classifyStagingRequest("POST", "/api/hermes/dispatch"), "deny");
  assert.equal(classifyStagingRequest("POST", "/api/staging-m2/missions/abc/dispatch"), "deny");
  assert.equal(classifyStagingRequest("POST", "/api/staging-m2/chat"), "deny");
});

test("only approved production GETs remain read-only", () => {
  assert.equal(classifyStagingRequest("GET", "/api/mc/dashboard"), "live-get");
  assert.equal(classifyStagingRequest("POST", "/api/mc/dashboard"), "deny");
});

test("two staging operators map to distinct M2 operator identities", () => {
  const config: StageIdentityConfig = { identities: [
    { sub: "stage-owner-a", role: "owner", authToken: "synthetic-owner-a-test" },
    { sub: "stage-owner-b", role: "owner", authToken: "synthetic-owner-b-test" },
  ] };
  const ownerA = resolveStagingIdentity({ user: { sub: "stage-owner-a" } } as unknown as Session, config);
  const ownerB = resolveStagingIdentity({ user: { sub: "stage-owner-b" } } as unknown as Session, config);
  const derive = (token: string) => createHash("sha256").update(token).digest("hex").slice(0, 16);
  assert.ok(ownerA && ownerB);
  assert.equal(ownerA.role, "owner");
  assert.equal(ownerB.role, "owner");
  assert.equal(ownerA.operatorId, derive(config.identities[0].authToken));
  assert.equal(ownerB.operatorId, derive(config.identities[1].authToken));
  assert.notEqual(ownerA.operatorId, ownerB.operatorId);
});

test("denied production writes never call upstream fetch", async () => {
  let fetchCalls = 0;
  const session = { user: { sub: "stage-owner-a" } } as unknown as Session;
  const response = await handleStagingM2Request(
    new Request("http://staging/api/hermes/dispatch", { method: "POST" }),
    session,
    async () => { fetchCalls += 1; return new Response("{}", { status: 200 }); },
  );
  assert.equal(response.status, 403);
  assert.equal(fetchCalls, 0);
});
```

- [ ] **Step 2: Run the tests RED before writing `classifyStagingRequest`.**

Run: `node --import tsx --test tests/staging/staging-m2-proxy.test.ts`
Expected: FAIL at the missing staging auth/policy/proxy module before any network server starts; no production request is sent.

- [ ] **Step 3: Add the staging-only auth path.** Make the NextAuth route select `auth.staging.ts` only in the isolated staging build; preserve production `auth.ts` and the live Google provider. The staging login page uses HermyHQ tokens/components, contains no production OAuth button or production secret, and gives owner A, owner B, and agent test accounts distinct staging subjects. Build `StageIdentityConfig` only on the server from the ephemeral process environment supplied by `scripts/run_unified_preview.py` (`STAGING_OWNER_A_SUB`, `STAGING_OWNER_A_AUTH_TOKEN`, `STAGING_OWNER_B_SUB`, `STAGING_OWNER_B_AUTH_TOKEN`, `STAGING_AGENT_SUB`, and `STAGING_AGENT_AUTH_TOKEN`); never load these from a file or serialize auth tokens into a browser bundle.

- [ ] **Step 4: Implement the M2 route allowlist and security checks.** GET only: missions list/detail, agent status, per-mission audit/ledger, global audit if permissioned. POST only: mission create; enable assign/cancel only if the optional owner-scoped transition guard is separately authorized, passes two-operator tests, and receives independent review; otherwise deny those controls. Dispatch/chat are denied before upstream fetch. Mutation requests require a session, role permission, a CSRF token bound to the session subject, and a Proxy-Assertion with the expected audience/issuer, a 30-second expiry, and one-use `jti`.

- [ ] **Step 5: Run policy tests GREEN, then test authenticated HTTP behavior against only the isolated M2 port.** Missing session → 401; unmapped subject → 403; missing/invalid CSRF → 403; expired/replayed assertion → 401; approved M2 read/write → expected status; production write/dispatch/chat → 403 without upstream network call.

- [ ] **Step 6: Keep all staging secrets outside files, Git, and logs.** `scripts/run_unified_preview.py` generates the stage proxy key, NextAuth secret, and distinct owner/agent identities in memory and injects them only into the allowlisted preview processes. Do not create/load `.env.local`, place keys in build args, or write token values to tests, console output, screenshots, or Nextcloud. If a separately verified least-privilege production GET credential is used, inject it only into the UI process through the approved secret manager; otherwise leave production feeds unavailable.

- [ ] **Step 7: Commit the staging auth/proxy slice after its tests pass.** Stage only the listed implementation files, policy tests, and non-secret `.env.staging.example`; no runtime credential file is created or staged.

```bash
git -C /home/bluemogul/worktrees/hermyhq-mission-command-staging add \
  src/lib/auth.staging.ts src/lib/staging-m2-proxy.ts src/lib/staging-policy.ts \
  src/app/api/auth/[...nextauth]/route.ts src/app/login/page.tsx src/middleware.ts \
  src/app/api/staging-m2/[...path]/route.ts tests/staging/staging-m2-proxy.test.ts \
  .env.staging.example
git -C /home/bluemogul/worktrees/hermyhq-mission-command-staging commit \
  -m "feat: add isolated Mission Command staging auth proxy"
```

## Task 4: Preserve live analytics safely and add source labels

**Files:**
- Create `src/components/staging-banner.tsx`.
- Modify `src/lib/staging-policy.ts`, `src/components/conditional-layout.tsx`, `src/components/sidebar.tsx`, `src/app/api/mc/[...path]/route.ts`, and only route handlers required to deny staging writes.
- Tests: `tests/staging/staging-m2-proxy.test.ts` and staging HTTP smoke tests.

- [ ] **Step 1: Label data sources.** Render a persistent staging banner. Preserve original analytics as `LIVE · READ ONLY`; label only M2 records as `STAGING · TEST DATA`. Do not merge staging agent counts or test missions into live dashboard aggregates.

- [ ] **Step 2: Audit each existing page's GET endpoint before enabling it in staging.** Permit only the observed production-backed GET path in the allowlist. Verify the credential itself has read-only/least-privilege permissions; route-method restrictions alone do not reduce a broad token's privileges. If no verified read-only credential exists or a route needs a POST to fetch data, do not proxy it; render the feed unavailable and stop for owner direction.

- [ ] **Step 3: Deny mutations to production in staging.** Add an early guard so non-auth POST/PUT/PATCH/DELETE requests to production-backed APIs return 403 before upstream fetch. Specifically prove `/api/mc/tasks/<id>/{start,approve,reject}` and `/api/hermes/dispatch` cannot reach production. The separate `/api/staging-m2/*` route is the sole mutation channel and always targets the isolated stage M2 URL.

- [ ] **Step 4: Verify denial with a mocked fetch, not a production request.** Assert the response is 403 and the upstream fetch spy has zero calls. Run: `node --import tsx --test tests/staging/staging-m2-proxy.test.ts`.

- [ ] **Step 5: Confirm an unavailable least-privilege production GET credential blocks that data feed.** Do not copy a broad token into staging without owner direction; render a clear read-only-data unavailable state rather than falling back to write-capable access.

- [ ] **Step 6: Commit the staging read-only boundary and source labels after mocked-fetch tests pass.**

```bash
git -C /home/bluemogul/worktrees/hermyhq-mission-command-staging add \
  src/components/staging-banner.tsx src/lib/staging-policy.ts \
  src/components/conditional-layout.tsx src/components/sidebar.tsx \
  src/app/api/mc/[...path]/route.ts tests/staging/staging-m2-proxy.test.ts
git -C /home/bluemogul/worktrees/hermyhq-mission-command-staging commit \
  -m "feat: enforce read-only production analytics in staging"
```

## Task 5: Build the native Missions page in the original HermyHQ shell.

**Files:**
- Create `src/app/missions/page.tsx`.
- Create `src/components/missions/mission-status-pill.tsx`, `mission-form.tsx`, `mission-table.tsx`, and `mission-detail-panel.tsx`.
- Create `src/lib/mission-view-model.ts` and `tests/staging/mission-view-model.test.ts`.
- Modify `src/components/sidebar.tsx` to add `/missions` to the existing Operate group and mobile tabs.
- Reuse `src/components/ui/kit.tsx`, `src/components/mc/ui.tsx`, and current CSS variables; do not import or copy the prototype's bare stylesheet.

- [ ] **Step 1: Write the status/source-label test before the view-model helper.**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { toMissionViewModel } from "../../src/lib/mission-view-model";

test("M2 status is shown verbatim and marked as staging data", () => {
  const view = toMissionViewModel({
    mission_id: "mission-stage-1",
    title: "Test mission",
    assignee: "stage-agent-a",
    status: "assigned",
    priority: "normal",
  });
  assert.equal(view.statusLabel, "assigned");
  assert.equal(view.sourceLabel, "STAGING · TEST DATA");
});
```

Run: `node --import tsx --test tests/staging/mission-view-model.test.ts`
Expected RED: `Cannot find module` or missing exported `toMissionViewModel`.

- [ ] **Step 2: Implement the minimal view-model contract.** Define `export type M2Mission = { mission_id: string; title: string; assignee: string; status: string; priority: string }` and export `toMissionViewModel(mission: M2Mission): { id: string; title: string; assignee: string; statusLabel: string; priority: string; sourceLabel: "STAGING · TEST DATA" }` from `src/lib/mission-view-model.ts`; copy `mission.status` without remapping.

- [ ] **Step 3: Run the view-model test GREEN.**

Run: `node --import tsx --test tests/staging/mission-view-model.test.ts`
Expected: PASS with status `assigned` unchanged and source label exactly `STAGING · TEST DATA`.

- [ ] **Step 4: Implement read states first.** Fetch the stage mission list/detail via `/api/staging-m2/*`, render exact M2 status values, owner attribution, assignee, priority, and update timestamps. Display empty/loading/error states with existing `EmptyState`, `Skeleton`, `Panel`, and `PageHeader` primitives.

- [ ] **Step 5: Add staging-only create controls.** Use the CSRF-aware proxy client. Add assign/cancel controls only if the optional staging owner-scoped transition guard is separately authorized, passes two-operator tests, and receives independent review; otherwise keep them disabled and note this as an open staging feature. Require explicit cancel confirmation when enabled. Disable actions for read-only/agent roles. Do not add approve/reject UI and do not expose dispatch/chat controls.

- [ ] **Step 6: Add audit/ledger history.** Fetch the per-mission endpoints only after selecting a mission; render chronological history and actor attribution. The M2 backend returns 403 for another operator's mission; show a non-enumerating access error without leaking the mission payload.

- [ ] **Step 7: Add bounded refresh.** Poll the mission list and selected details every 10 seconds with `cache: "no-store"`, clear timers on unmount, expose a manual refresh button, and show last-updated time. Do not add or imply an SSE endpoint.

- [ ] **Step 8: Verify original route preservation.** Assert Dashboard, Org, Agents, Activity, Cost, Client Pulse, Tasks, Goals, Projects, Memory Wiki, and external Chat navigation are still present; only the new Missions item is added. Verify Activity remains the original page and is not replaced by staging audit data.

- [ ] **Step 9: Commit the native Missions page slice after its tests pass.**

```bash
git -C /home/bluemogul/worktrees/hermyhq-mission-command-staging add \
  src/app/missions/page.tsx src/components/missions/ \
  src/lib/mission-view-model.ts tests/staging/mission-view-model.test.ts \
  src/components/sidebar.tsx
git -C /home/bluemogul/worktrees/hermyhq-mission-command-staging commit \
  -m "feat: add staging Missions to original HermyHQ shell"
```

## Task 6: Phase A offline verification and Phase B staging acceptance

**Files/artifacts:**
- Phase A unit tests under `tests/staging/` in both independent clones; no API/browser service in Phase A.
- Phase B HTTP regression `tests/staging/test_mission_owner_isolation.py`, executed only after separate owner authorization.
- Twelve screenshots and manifest under `docs/screenshots/unified-mission-command/` in the staging artifact workspace.
- New scoped security report at `docs/security-reviews/2026-10-15-unified-mission-command-staging-security.md`; do not edit or replace prior VERITAS reports.
- Phase B redacted screenshots/report mirror: `Dev/bm-dev/artifacts/mission-control-m2/`, GET+SHA256 verified.

- [ ] **Step 1: Finish Phase A frontend gates without starting a server.**

Run in the independent UI clone:

```bash
npm run lint
npx tsc --noEmit
env -i PATH="$PATH" HOME="$HOME" STAGING_MODE=1 \
  NEXTAUTH_URL=http://localhost:3010 NEXTAUTH_SECRET=offline-build-only \
  M2_STAGING_URL=http://127.0.0.1:18803 npm run build
```

Expected: lint has no new errors, TypeScript exits 0, and the staging-configured build succeeds without production OAuth or broad production credentials. `offline-build-only` is a public, build-only fixture, never a runtime secret. If the build demands production credentials or performs upstream requests, stop and fix the staging build boundary; do not supply production values. Do not run `npm start`, create a listener, or open a browser during Phase A.

- [ ] **Step 2: Complete Phase A independent review and stop for Phase B authorization.** Independently review the exact local M2/UI diffs, offline path/helper tests, auth/proxy tests, and preserved VERITAS scope. If any path guard fails, any test accesses a live path, or review fails, stop and report. Only after Phase A passes, request a separate owner approval to start the isolated M2 API/UI and browser. No such approval is granted by this plan; if it is absent, stop before any listener, request, or browser use.

- [ ] **Step 3: After Phase B authorization, run the two-operator HTTP regression through the in-memory supervisor.** The test supervisor rejects ports 8800/8802, requires the selected loopback port to be free, generates all signing material and synthetic identities in memory, uses `/bin/true` and `MC_TEST_MODE=0`, starts the isolated API against a new disposable workspace, runs the route test, then stops the exact child process and deletes the workspace in `finally`. Never load an `.env` file or point the test at the preview workspace.

```bash
python3 tests/staging/run_owner_http.py --port 8803 --runtime-root /home/bluemogul/recovery/mission-control-unified-runtime/owner-tests
```

Required result: owner A creates and reads detail/audit/ledger; owner B, with a different subject and derived operator ID, receives 403 for each read and cannot see A's mission in its list. The supervisor prints only redacted statuses, never secrets/assertions, and makes requests only to `127.0.0.1` on the selected loopback port.

If the optional assign/cancel extension was separately authorized and implemented, run the extra regression through the same disposable-workspace supervisor:

```bash
python3 tests/staging/run_owner_http.py --port 8803 --runtime-root /home/bluemogul/recovery/mission-control-unified-runtime/owner-tests --test-owner-transitions
```

Verify B's mutations return 403 before ledger changes and A's own actions succeed. Controls stay disabled until these tests pass and the independent review approves the exact guard.

- [ ] **Step 4: Start the separate UI preview only after the HTTP regression passes and Phase B remains authorized.** `scripts/run_unified_preview.py` is the only entry point. It checks ports 8800/8802 are rejected and verifies the selected API, forward, and UI loopback ports are free; it creates a fresh preview workspace beneath the external runtime root; generates `NEXTAUTH_SECRET`, the Proxy-Assertion key, owner A/B tokens, and agent identity in memory; streams the allowlisted M2 process configuration over SSH stdin to `staging/serve_preview_api.py`; starts an SSH forward and Next.js bound to loopback; and supervises all children in one `try/finally`. The remote M2 supervisor validates all resolved data/DB/attachment/backup/profile paths before initialization, forces `MC_TEST_MODE=0` and `/bin/true`, uses an empty profile directory, logs no secrets, and stops when its SSH supervisor exits. The UI uses a no-password, local staging identity picker for owner A, owner B, and agent. No credential file is created or loaded. If a production analytics feed has no independently verified least-privilege credential available via the approved secret manager, leave it unavailable.

After the code runner passes offline unit tests and independent review, start it only after separate Phase B approval:

```bash
python3 scripts/run_unified_preview.py --m2-host 95.216.28.107 --api-port 8803 --forward-port 18803 --ui-port 3010 --runtime-root /home/bluemogul/recovery/mission-control-unified-runtime/unified-preview
```

The runner remains in the foreground and prints only redacted readiness/status. For the owner's Windows preview, open a separate PowerShell tunnel to h02 with `ssh -N -L 3010:127.0.0.1:3010 bluemogul@5.78.116.116`; browse `http://localhost:3010`. Never add a public listener.

- [ ] **Step 5: Verify the no-dispatch boundary.** Unit-test that production writes, M2 dispatch, and chat-send are denied before `fetch`; confirm `/bin/true` and the empty Hermes profile directory. Do not call any dispatch/chat-send route.

- [ ] **Step 6: Run authenticated browser checks with the local, no-password staging identity picker.** Select owner A, owner B, and agent fixtures one at a time; verify sign-out/session reset, distinct mapped operator IDs, owner B denial for owner A's detail/audit/ledger, and agent role restrictions. Also verify original navigation, live-read labels, Missions staging label, and CSRF. The identity picker exists only in the loopback staging build and accepts no passwords or production OAuth; if any real credential prompt appears, stop and report instead of entering credentials.

- [ ] **Step 7: Capture exactly 12 screenshots.** Use safe browser capture at desktop 1920×1080, tablet 768×1024, and mobile 375×667 for Dashboard, Missions, Agents, and Activity. Do not run `staging/capture_screenshots.js`; it emits CSRF/session-cookie material and supplies a password in a shell argument. Store a route/viewport manifest.

- [ ] **Step 8: Run responsive checks.** At each viewport assert no horizontal overflow; test sidebar drawer open/close and route navigation; confirm source badges and enabled/disabled controls are visible, keyboard reachable, and truthful.

- [ ] **Step 9: Independently review the exact Phase B diff and VERITAS evidence.** Confirm the review references the exact M2 clone/commit, owner-isolation tests, and UI commit. Keep the production exposure identified in the spec unresolved; do not probe or modify port 8800.

- [ ] **Step 10: Verify release boundaries.** Re-read both independent clone statuses; confirm only intended local dev-branch files changed, M2 uses its external scratch workspace and loopback port, production 8800 and existing staging 8802 remain unchanged, and no push/merge/deploy occurred.

- [ ] **Step 11: Finalize and mirror redacted acceptance evidence.** Confirm exactly 12 screenshots and manifest; redact credentials, cookies, CSRF material, private data, and production DB contents. Upload screenshots/report to `Dev/bm-dev/artifacts/mission-control-m2/` with unique revision filenames and GET+SHA256 verification. Commit the security report and manifest locally; do not push.

```bash
git -C /home/bluemogul/worktrees/hermyhq-mission-command-staging add docs/security-reviews/2026-10-15-unified-mission-command-staging-security.md docs/screenshots/unified-mission-command/manifest.json
git -C /home/bluemogul/worktrees/hermyhq-mission-command-staging commit -m "test: record unified Mission Command staging acceptance"
```

## Future stop conditions

- If the M2 source snapshot cannot be isolated without modifying the shared checkout, stop and report before editing.
- If owner A/B assertions cannot be represented by distinct operator IDs, stop; do not declare owner isolation validated.
- If production analytics require a broad production credential in staging, stop and request owner direction.
- If any staging route can reach a production mutation or Hermes dispatch, stop and fix the boundary before browser acceptance.
- This plan is for documentation/planning approval only. Implementation requires a separate explicit user authorization after this plan is reviewed. Production release remains a later, separate authorization.
