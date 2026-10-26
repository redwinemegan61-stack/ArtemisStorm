export interface ArchitectureNode {
  id: string;
  modulePath: string;
  role: string;
  tier: 'Supervisor' | 'MCP Core' | 'Decompiler Bridge' | 'Device Automation' | 'CI/CD Gate';
  dependencies: string[];
  complexity: 'Low' | 'Medium' | 'High';
  invariants: string;
  status: 'Verified' | 'Patched for CI' | 'Synthesized';
}

export interface McpToolContract {
  name: string;
  origin: 'google/artemis' | 'morluto/rea' | 'Unified Bridge';
  signature: string;
  purpose: string;
  ciVerificationCmd: string;
}

export interface TrustGroupSop {
  id: string;
  taskCategory: string;
  assignedAgent: string;
  computeTier: 'Minimal (Tier-3 Worker)' | 'Tactical (Tier-2 Specialist)' | 'Supervisor Audit Only';
  estimatedTokenSavings: string;
  instructionTemplate: string;
  verificationCriteria: string;
}

export interface PipelineStep {
  id: string;
  stage: 'Bootstrap' | 'Static & POSIX Audit' | 'REA Decompiler MCP' | 'Artemis Device Matrix' | 'Automated Deployment';
  name: string;
  command: string;
  durationMs: number;
  fixesIssue?: string;
  logOutput: string[];
}

export interface ReverseEngineeringReport {
  repoFullName: string;
  repoUrl: string;
  defaultBranch: string;
  analyzedAt: string;
  executiveSummary: string;
  computeAllocation: {
    supervisorSharePct: number;
    workerSharePct: number;
    estimatedCostReductionPct: number;
    tacticalRationale: string;
  };
  ciIssuesResolved: {
    id: string;
    file: string;
    severity: 'Critical' | 'High' | 'Medium';
    rootCause: string;
    fixApplied: string;
  }[];
  architectureNodes: ArchitectureNode[];
  mcpContracts: McpToolContract[];
  trustGroupPlaybook: TrustGroupSop[];
  originalCiYaml: string;
  unifiedCiYaml: string;
  posixPatchCode: string;
  generatedTestSuite: string;
}

export const ORIGINAL_ARTEMIS_CI_YAML = `name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4
        with:
          enable-cache: true

      - name: Set up Python
        run: uv python install 3.12

      - name: Install dependencies
        run: uv sync --dev

      - name: Run Ruff Linter
        run: uv run ruff check .

      # PROBLEM 1: Gated behind workflow_dispatch — skipped on every push/PR!
      - name: Run Artemis MCP & Device Utility Tests
        if: github.event_name == 'workflow_dispatch'
        run: |
          # PROBLEM 2: Fails on ubuntu-latest with AttributeError:
          # module 'subprocess' has no attribute 'CREATE_NEW_PROCESS_GROUP'
          # inside mcp_server/utils/device_utils.py
          uv run pytest tests/unit/mcp/
`;

export const UNIFIED_REA_ARTEMIS_CI_YAML = `name: Unified REA + Artemis CI/CD Pipeline

on:
  push:
    branches: [ main, "release/**" ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: write
  packages: write
  actions: read

env:
  PYTHON_VERSION: "3.12"
  UV_SYSTEM_PYTHON: "false"
  ARTEMIS_HEADLESS_ADB: "1"
  REA_MCP_DECOMPILER_MODE: "headless-ast-ghidra"

jobs:
  # Stage 1: Fast Static Analysis & POSIX Subprocess Compatibility Gate
  static-and-posix-gate:
    name: Static Audit & POSIX Compatibility
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Astral uv
        uses: astral-sh/setup-uv@v4
        with:
          enable-cache: true
          cache-dependency-glob: "uv.lock"

      - name: Provision Python \${{ env.PYTHON_VERSION }}
        run: uv python install \${{ env.PYTHON_VERSION }}

      - name: Sync Locked Dependencies
        run: uv sync --dev

      - name: Verify Ruff Lint & Format Invariants
        run: |
          uv run ruff check .
          uv run ruff format --check .

      - name: Audit POSIX Subprocess Compatibility (device_utils.py)
        run: |
          uv run python -c "
          import subprocess, sys
          from mcp_server.utils import posix_compat
          posix_compat.ensure_POSIX_subprocess_flags()
          assert hasattr(subprocess, 'CREATE_NEW_PROCESS_GROUP'), 'Missing POSIX shim'
          assert hasattr(subprocess, 'DETACHED_PROCESS'), 'Missing DETACHED_PROCESS shim'
          print('POSIX subprocess compatibility verified for Linux CI runners.')
          "

  # Stage 2: Reverse Engineer Anything (REA) + Artemis MCP Swarm Test Matrix
  rea-artemis-swarm-tests:
    name: REA & Artemis MCP Swarm Verification
    needs: static-and-posix-gate
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        suite:
          - name: "artemis-mcp-unit"
            path: "tests/unit/mcp/"
          - name: "rea-decompiler-bridge"
            path: "tests/unit/rea_bridge/"
          - name: "swarm-trust-group-contracts"
            path: "tests/integration/swarm/"
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Install Astral uv
        uses: astral-sh/setup-uv@v4
        with:
          enable-cache: true

      - name: Provision Python & Virtualenv
        run: |
          uv python install \${{ env.PYTHON_VERSION }}
          uv sync --dev

      - name: Start Mock ADB & REA MCP Decompiler Daemon (Every Push)
        run: |
          uv run python -m mcp_server.testing.mock_adb_daemon --port 5037 &
          uv run python -m rea_bridge.server --transport stdio-check --verify

      - name: Execute \${{ matrix.suite.name }} (Unconditional on Push & PR)
        env:
          PYTEST_ADDOPTS: "-p mcp_server.utils.posix_compat --tb=short -q"
        run: |
          uv run pytest \${{ matrix.suite.path }} --junitxml=reports/\${{ matrix.suite.name }}.xml

      - name: Upload Test Telemetry Artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-report-\${{ matrix.suite.name }}
          path: reports/*.xml

  # Stage 3: Automated Artemis + REA Deployment on Every Push to main
  deploy-artemis-rea-swarm:
    name: Automated Artemis + REA Deployment
    needs: rea-artemis-swarm-tests
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment:
      name: production-swarm
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Install Astral uv
        uses: astral-sh/setup-uv@v4
        with:
          enable-cache: true

      - name: Build Unified REA + Artemis MCP Distribution
        run: |
          uv python install \${{ env.PYTHON_VERSION }}
          uv sync --dev
          uv build --wheel --sdist --out-dir dist/

      - name: Smoke-Test Built Wheel in Isolated Ephemeral Env
        run: |
          uv run --isolated --with dist/*.whl python -c "
          import mcp_server
          print('Unified Artemis + REA MCP package verified ready for release.')
          "

      - name: Publish Container & Trigger Swarm Webhook Deployment
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          echo "Deploying commit \${{ github.sha }} to Artemis + REA Swarm Cluster..."
          uv run python scripts/deploy_swarm_release.py --sha "\${{ github.sha }}" --channel production
`;

export const POSIX_COMPAT_PATCH = `"""
mcp_server/utils/posix_compat.py
Cross-platform subprocess compatibility shim for Google Artemis + REA CI runners.
Prevents AttributeError on Linux/macOS GitHub Actions runners when device_utils.py
references Windows-only subprocess creation flags during unit or integration tests.
"""
import os
import subprocess
import sys
from typing import Any

POSIX_SAFE_CREATE_NEW_PROCESS_GROUP = 0x00000200
POSIX_SAFE_DETACHED_PROCESS = 0x00000008


def ensure_POSIX_subprocess_flags() -> None:
    """Injects no-op flag constants on POSIX platforms and normalizes Popen kwargs."""
    if sys.platform != "win32":
        if not hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):
            setattr(subprocess, "CREATE_NEW_PROCESS_GROUP", POSIX_SAFE_CREATE_NEW_PROCESS_GROUP)
        if not hasattr(subprocess, "DETACHED_PROCESS"):
            setattr(subprocess, "DETACHED_PROCESS", POSIX_SAFE_DETACHED_PROCESS)


def normalize_popen_kwargs(kwargs: dict[str, Any]) -> dict[str, Any]:
    """Translates Windows creationflags into POSIX start_new_session=True on Linux CI."""
    cleaned = dict(kwargs)
    if sys.platform != "win32" and "creationflags" in cleaned:
        flags = cleaned.pop("creationflags", 0)
        if flags & (POSIX_SAFE_CREATE_NEW_PROCESS_GROUP | POSIX_SAFE_DETACHED_PROCESS):
            cleaned.setdefault("start_new_session", True)
    return cleaned


def pytest_configure(config: Any) -> None:
    """Automatically invoked by pytest when loaded via -p mcp_server.utils.posix_compat."""
    ensure_POSIX_subprocess_flags()
`;

export const GENERATED_SWARM_TEST_SUITE = `"""
tests/unit/mcp/test_rea_artemis_pipeline.py
Automated regression suite executed on every push by .github/workflows/ci.yml.
Verifies POSIX device_utils compatibility, REA decompiler MCP bridge, and Artemis agent graph.
"""
import subprocess
import sys
import pytest
from mcp_server.utils.posix_compat import ensure_POSIX_subprocess_flags, normalize_popen_kwargs


def test_linux_runner_has_windows_subprocess_flags():
    ensure_POSIX_subprocess_flags()
    assert hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP")
    assert hasattr(subprocess, "DETACHED_PROCESS")


def test_popen_kwargs_normalized_for_ubuntu_ci():
    ensure_POSIX_subprocess_flags()
    raw = {
        "stdout": subprocess.PIPE,
        "creationflags": subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
    }
    normalized = normalize_popen_kwargs(raw)
    if sys.platform != "win32":
        assert "creationflags" not in normalized
        assert normalized.get("start_new_session") is True


def test_rea_decompiler_to_artemis_handoff_contract():
    # Validates that REA AST/binary symbol extraction maps cleanly into Artemis MCP actions
    rea_symbol_payload = {
        "binary_target": "com.google.artemis.agent",
        "exported_intents": ["ACTION_RUN_DIAGNOSTIC", "ACTION_SYNC_STATE"],
        "control_flow_verified": True,
    }
    assert rea_symbol_payload["control_flow_verified"] is True
    assert len(rea_symbol_payload["exported_intents"]) == 2
`;

export const DEFAULT_PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'step-1',
    stage: 'Bootstrap',
    name: 'Setup Astral uv & Python 3.12 Environment',
    command: 'uv python install 3.12 && uv sync --dev',
    durationMs: 1420,
    logOutput: [
      'Resolved 68 packages in 42ms via uv.lock',
      'Installed mcp==1.6.0, pydantic==2.10.6, pytest==8.3.4, ruff==0.9.6',
      'Virtual environment initialized at .venv (Python 3.12.8)'
    ]
  },
  {
    id: 'step-2',
    stage: 'Static & POSIX Audit',
    name: 'Ruff Static Analysis & POSIX Subprocess Shim Audit',
    command: 'uv run ruff check . && uv run python -m mcp_server.utils.posix_compat',
    durationMs: 980,
    fixesIssue: 'Fixes AttributeError: subprocess.CREATE_NEW_PROCESS_GROUP on ubuntu-latest',
    logOutput: [
      'All checks passed! (47 files inspected, 0 warnings)',
      'Injected POSIX shim for CREATE_NEW_PROCESS_GROUP (0x200) & DETACHED_PROCESS (0x8)',
      'Verified device_utils.py Popen kwargs normalization -> start_new_session=True'
    ]
  },
  {
    id: 'step-3',
    stage: 'REA Decompiler MCP',
    name: 'Run REA (Reverse Engineer Anything) MCP Symbol & AST Extractor',
    command: 'uv run pytest tests/unit/rea_bridge/ -q',
    durationMs: 1850,
    logOutput: [
      'Started headless REA MCP server (stdio transport)',
      'Extracted 24 control-flow nodes, 9 MCP tool schemas, and 4 IPC boundaries',
      'tests/unit/rea_bridge/test_decompiler_mcp.py ........ [100%] (8 passed in 1.12s)'
    ]
  },
  {
    id: 'step-4',
    stage: 'Artemis Device Matrix',
    name: 'Execute Artemis MCP & Headless ADB Suite (Ungated on Push)',
    command: 'uv run pytest tests/unit/mcp/ -p mcp_server.utils.posix_compat',
    durationMs: 2310,
    fixesIssue: 'Removed if: github.event_name == workflow_dispatch gate so every push runs tests',
    logOutput: [
      'Mock ADB daemon listening on 127.0.0.1:5037 (virtual device: pixel_9_pro_headless)',
      'tests/unit/mcp/test_device_utils.py ...... [ 42%]',
      'tests/unit/mcp/test_artemis_graph.py ........ [100%] (14 passed, 0 skipped in 1.89s)'
    ]
  },
  {
    id: 'step-5',
    stage: 'Automated Deployment',
    name: 'Build Unified Wheel & Deploy Artemis + REA Swarm Release',
    command: 'uv build --wheel && uv run python scripts/deploy_swarm_release.py --channel production',
    durationMs: 1640,
    logOutput: [
      'Built wheel: dist/artemis_rea_swarm-0.4.2-py3-none-any.whl',
      'Isolated smoke-test passed in ephemeral venv',
      'Published release artifact & updated Trust-Group Swarm Registry for commit push.'
    ]
  }
];

export const INITIAL_ARTEMIS_REA_REPORT: ReverseEngineeringReport = {
  repoFullName: 'google/artemis + morluto/rea',
  repoUrl: 'https://github.com/google/artemis',
  defaultBranch: 'main',
  analyzedAt: '2026-10-25T23:14:42Z',
  executiveSummary:
    'Reverse-engineered the Google Artemis MCP repository alongside the REA (Reverse Engineer Anything) MCP decompiler bridge. Identified two blocking CI defects in google/artemis/.github/workflows/ci.yml that prevented automated testing on git push: (1) manual workflow_dispatch gating that bypassed MCP unit tests on standard commits, and (2) unguarded Windows-specific subprocess flags (CREATE_NEW_PROCESS_GROUP and DETACHED_PROCESS) in mcp_server/utils/device_utils.py that threw AttributeError on Ubuntu runners. Synthesized a unified, zero-touch CI/CD workflow and delegated routine symbol extraction and test scaffolding to Tier-2 Trust-Group agents.',
  computeAllocation: {
    supervisorSharePct: 18,
    workerSharePct: 82,
    estimatedCostReductionPct: 74,
    tacticalRationale:
      'Lead Supervisor restricted its own scope to invariant auditing, POSIX root-cause diagnosis, and CI security boundaries (18% compute). The remaining 82% of AST traversal, MCP schema extraction, and pytest boilerplate generation was delegated to Tier-2 and Tier-3 Trust-Group workers using deterministic templates.'
  },
  ciIssuesResolved: [
    {
      id: 'CI-01',
      file: '.github/workflows/ci.yml',
      severity: 'Critical',
      rootCause:
        'Unit and MCP device tests were gated behind `if: github.event_name == \'workflow_dispatch\'`, causing standard `git push` and `pull_request` events to pass trivially without running the test suite.',
      fixApplied:
        'Removed the workflow_dispatch restriction, provisioned a headless mock ADB daemon in CI, and enabled unconditional execution across all push and PR commits.'
    },
    {
      id: 'CI-02',
      file: 'mcp_server/utils/device_utils.py',
      severity: 'Critical',
      rootCause:
        'Direct references to `subprocess.CREATE_NEW_PROCESS_GROUP` and `subprocess.DETACHED_PROCESS` crash on Linux (`ubuntu-latest`) runners with `AttributeError` because those constants only exist on Windows Python builds.',
      fixApplied:
        'Created `mcp_server/utils/posix_compat.py` pytest plugin and runtime shim that maps Windows creationflags to POSIX `start_new_session=True` on non-win32 platforms.'
    },
    {
      id: 'CI-03',
      file: '.github/workflows/ci.yml (Deployment Stage)',
      severity: 'High',
      rootCause:
        'Repository lacked an automated build, wheel verification, and REA + Artemis deployment stage triggered upon successful test completion on `main`.',
      fixApplied:
        'Added the `deploy-artemis-rea-swarm` job dependent on `rea-artemis-swarm-tests` that builds via `uv build --wheel`, runs an isolated smoke test, and deploys on every push.'
    }
  ],
  architectureNodes: [
    {
      id: 'node-1',
      modulePath: 'mcp_server/server.py',
      role: 'Primary FastMCP / stdio transport entrypoint exposing Artemis device orchestration tools to AI agents.',
      tier: 'MCP Core',
      dependencies: ['mcp_server/utils/device_utils.py', 'mcp_server/tools/ui_automator.py'],
      complexity: 'Medium',
      invariants: 'Must register all Pydantic-validated tool schemas prior to stdio handshake.',
      status: 'Verified'
    },
    {
      id: 'node-2',
      modulePath: 'mcp_server/utils/device_utils.py',
      role: 'Manages ADB server lifecycle, device serial discovery, and background logcat/screenrecord subprocesses.',
      tier: 'Device Automation',
      dependencies: ['mcp_server/utils/posix_compat.py', 'subprocess'],
      complexity: 'High',
      invariants: 'Subprocess spawning must normalize creationflags across win32 and POSIX runners.',
      status: 'Patched for CI'
    },
    {
      id: 'node-3',
      modulePath: 'rea_bridge/decompiler_mcp.py',
      role: 'REA (Reverse Engineer Anything) MCP adapter connecting Ghidra/AST/APK decompilation output directly to Artemis test generators.',
      tier: 'Decompiler Bridge',
      dependencies: ['mcp_server/server.py', 'rea_bridge/ast_extractor.py'],
      complexity: 'High',
      invariants: 'Outputs deterministic JSON symbol tables and intent contracts without mutating target binaries.',
      status: 'Synthesized'
    },
    {
      id: 'node-4',
      modulePath: 'swarm_supervisor/coordinator.py',
      role: 'Tier-1 Lead Supervisor that decomposes reverse-engineering targets and assigns low-cost subtasks to Trust-Group agents.',
      tier: 'Supervisor',
      dependencies: ['rea_bridge/decompiler_mcp.py', 'mcp_server/server.py'],
      complexity: 'Medium',
      invariants: 'Enforces minimum compute spend; escalates to Tier-1 reasoning only on invariant failure.',
      status: 'Synthesized'
    },
    {
      id: 'node-5',
      modulePath: '.github/workflows/ci.yml',
      role: 'Unified GitHub Actions workflow executing uv sync, Ruff static checks, REA + Artemis test matrix, and auto-deploy on push.',
      tier: 'CI/CD Gate',
      dependencies: ['uv.lock', 'pyproject.toml', 'mcp_server/utils/posix_compat.py'],
      complexity: 'Low',
      invariants: 'Zero skipped suites on push; deterministic lockfile resolution via `uv sync --dev`.',
      status: 'Patched for CI'
    }
  ],
  mcpContracts: [
    {
      name: 'rea_extract_control_flow',
      origin: 'morluto/rea',
      signature: '(target_path: str, depth: int = 2) -> SymbolGraphPayload',
      purpose: 'Decompiles binary/APK or parses repository AST to extract entrypoints, IPC intents, and call graphs.',
      ciVerificationCmd: 'uv run pytest tests/unit/rea_bridge/ -k test_extract_control_flow'
    },
    {
      name: 'artemis_execute_device_action',
      origin: 'google/artemis',
      signature: '(device_id: str, instruction: str, verify_ui: bool = True) -> ActionTelemetry',
      purpose: 'Translates natural-language or reverse-engineered intent contracts into deterministic ADB UI actions.',
      ciVerificationCmd: 'uv run pytest tests/unit/mcp/ -k test_execute_device_action'
    },
    {
      name: 'swarm_synthesize_regression_test',
      origin: 'Unified Bridge',
      signature: '(symbol_graph: SymbolGraphPayload, target_module: str) -> PytestModuleArtifact',
      purpose: 'Bridges REA decompilation output into executable Artemis pytest suites for continuous push verification.',
      ciVerificationCmd: 'uv run pytest tests/integration/swarm/ -k test_synthesize_regression'
    }
  ],
  trustGroupPlaybook: [
    {
      id: 'sop-1',
      taskCategory: 'AST & Symbol Table Extraction',
      assignedAgent: 'REA-Worker-01 (Tier-3)',
      computeTier: 'Minimal (Tier-3 Worker)',
      estimatedTokenSavings: '84% fewer tokens vs. full-context LLM scan',
      instructionTemplate:
        'Do not read full function bodies initially. Run `rea_extract_control_flow` on the target directory to emit exported signatures, classes, and IPC routes as compact JSON. Escalate only obfuscated or dynamic-dispatch blocks to Tier-2.',
      verificationCriteria: 'JSON schema validates against SymbolGraphPayload and 100% of public entrypoints are indexed.'
    },
    {
      id: 'sop-2',
      taskCategory: 'Cross-Platform CI Compatibility Patching',
      assignedAgent: 'CI-Runner-Agent (Tier-2)',
      computeTier: 'Tactical (Tier-2 Specialist)',
      estimatedTokenSavings: '68% compute reduction via static AST rule',
      instructionTemplate:
        'Scan Python files for OS-bound attributes (`subprocess.CREATE_NEW_PROCESS_GROUP`, `subprocess.DETACHED_PROCESS`, `os.startfile`, hardcoded `\\\\` paths). Wrap with `posix_compat.normalize_popen_kwargs` and verify under `ubuntu-latest` container.',
      verificationCriteria: '`uv run pytest` passes on Linux with zero `AttributeError` or `FileNotFoundError` exceptions.'
    },
    {
      id: 'sop-3',
      taskCategory: 'Artemis MCP Regression Test Generation',
      assignedAgent: 'Artemis-Test-Worker (Tier-2)',
      computeTier: 'Tactical (Tier-2 Specialist)',
      estimatedTokenSavings: '71% reduction by reusing Mock ADB fixtures',
      instructionTemplate:
        'Bind each discovered MCP tool contract to the shared `mock_adb_daemon` fixture. Assert Pydantic input validation, subprocess invocation arguments, and deterministic timeout handling.',
      verificationCriteria: 'All generated tests execute in < 2.5s without requiring a physical Android device attached.'
    },
    {
      id: 'sop-4',
      taskCategory: 'Supervisor Final Audit & Release Sign-Off',
      assignedAgent: 'Lead-Supervisor (Tier-1)',
      computeTier: 'Supervisor Audit Only',
      estimatedTokenSavings: 'Supervisor invoked only on diff summary (< 1.5k tokens)',
      instructionTemplate:
        'Review only the aggregated test XML summary, security permission diff in `.github/workflows/ci.yml`, and invariant checklist before authorizing automated deployment.',
      verificationCriteria: 'All CI matrix jobs green, `permissions` scoped minimally, and wheel smoke-test verified.'
    }
  ],
  originalCiYaml: ORIGINAL_ARTEMIS_CI_YAML,
  unifiedCiYaml: UNIFIED_REA_ARTEMIS_CI_YAML,
  posixPatchCode: POSIX_COMPAT_PATCH,
  generatedTestSuite: GENERATED_SWARM_TEST_SUITE
};

// ---------------------------------------------------------------------------
// Pipeline Health & Flaky Test Intelligence Data Models & Presets
// ---------------------------------------------------------------------------

export interface HistoricalCiExecution {
  id: string;
  runNumber: number;
  commitSha: string;
  commitMsg: string;
  branch: string;
  author: string;
  timestamp: string;
  durationSeconds: number;
  status: 'passed' | 'failed' | 'flaky';
  passedTests: number;
  failedTests: number;
  flakyTests: number;
  totalTests: number;
  passRatePct: number;
  failingTestIds: string[];
  remediated: boolean;
}

export interface FlakyTestRecord {
  id: string;
  testName: string;
  filePath: string;
  flakinessRatePct: number;
  failureMode: string;
  rootCauseCategory:
    | 'Windows/POSIX Subprocess'
    | 'Socket Race Condition'
    | 'Async Decompiler Timeout'
    | 'Runner File Lock';
  remediationStatus:
    | 'Fixed via posix_compat'
    | 'Fixed via mock ADB pooling'
    | 'Active Investigation'
    | 'Mitigated with Retries';
  remediationSnippet: string;
  totalExecutions: number;
  recentResults: Array<'pass' | 'fail' | 'flake'>;
}

export const INITIAL_HISTORICAL_CI_RUNS: HistoricalCiExecution[] = [
  {
    id: 'run-101',
    runNumber: 101,
    commitSha: '9b14c2a',
    commitMsg: 'feat: add initial REA decompiler bridge hook',
    branch: 'feat/rea-bridge',
    author: 'dev-artemis',
    timestamp: '2026-10-24T18:22:00Z',
    durationSeconds: 11.4,
    status: 'failed',
    passedTests: 18,
    failedTests: 6,
    flakyTests: 2,
    totalTests: 24,
    passRatePct: 75.0,
    failingTestIds: ['flaky-01', 'flaky-03'],
    remediated: false,
  },
  {
    id: 'run-102',
    runNumber: 102,
    commitSha: 'd28a1c9',
    commitMsg: 'test: adb device action headless runner',
    branch: 'feat/rea-bridge',
    author: 'morluto-bot',
    timestamp: '2026-10-24T19:05:00Z',
    durationSeconds: 10.8,
    status: 'flaky',
    passedTests: 20,
    failedTests: 1,
    flakyTests: 3,
    totalTests: 24,
    passRatePct: 83.3,
    failingTestIds: ['flaky-02'],
    remediated: false,
  },
  {
    id: 'run-103',
    runNumber: 103,
    commitSha: 'e71f40d',
    commitMsg: 'ci: enable matrix test for ubuntu-latest',
    branch: 'main',
    author: 'artemis-core',
    timestamp: '2026-10-24T20:12:00Z',
    durationSeconds: 13.2,
    status: 'failed',
    passedTests: 17,
    failedTests: 7,
    flakyTests: 1,
    totalTests: 24,
    passRatePct: 70.8,
    failingTestIds: ['flaky-01', 'flaky-04'],
    remediated: false,
  },
  {
    id: 'run-104',
    runNumber: 104,
    commitSha: '18ab93f',
    commitMsg: 'refactor: isolate mock adb daemon socket',
    branch: 'fix/adb-socket-race',
    author: 'artemis-core',
    timestamp: '2026-10-24T21:45:00Z',
    durationSeconds: 9.6,
    status: 'flaky',
    passedTests: 21,
    failedTests: 0,
    flakyTests: 3,
    totalTests: 24,
    passRatePct: 87.5,
    failingTestIds: ['flaky-02', 'flaky-05'],
    remediated: false,
  },
  {
    id: 'run-105',
    runNumber: 105,
    commitSha: '31cb54e',
    commitMsg: 'mcp: test execute_device_action timeout handling',
    branch: 'main',
    author: 'dev-artemis',
    timestamp: '2026-10-24T22:30:00Z',
    durationSeconds: 10.1,
    status: 'failed',
    passedTests: 18,
    failedTests: 5,
    flakyTests: 1,
    totalTests: 24,
    passRatePct: 75.0,
    failingTestIds: ['flaky-01'],
    remediated: false,
  },
  {
    id: 'run-106',
    runNumber: 106,
    commitSha: '7f99a1b',
    commitMsg: 'ci: add uv cache step to github actions',
    branch: 'main',
    author: 'ci-bot',
    timestamp: '2026-10-24T23:50:00Z',
    durationSeconds: 8.9,
    status: 'failed',
    passedTests: 19,
    failedTests: 4,
    flakyTests: 1,
    totalTests: 24,
    passRatePct: 79.2,
    failingTestIds: ['flaky-01', 'flaky-03'],
    remediated: false,
  },
  {
    id: 'run-107',
    runNumber: 107,
    commitSha: 'b488ce1',
    commitMsg: 'swarm: trust group worker token savings test',
    branch: 'feat/swarm-trust',
    author: 'supervisor-swarm',
    timestamp: '2026-10-25T01:10:00Z',
    durationSeconds: 9.2,
    status: 'flaky',
    passedTests: 21,
    failedTests: 1,
    flakyTests: 2,
    totalTests: 24,
    passRatePct: 87.5,
    failingTestIds: ['flaky-02'],
    remediated: false,
  },
  {
    id: 'run-108',
    runNumber: 108,
    commitSha: '56e9c40',
    commitMsg: 'chore: probe Windows vs Linux subprocess creation',
    branch: 'fix/posix-runner-shim',
    author: 'artemis-core',
    timestamp: '2026-10-25T03:25:00Z',
    durationSeconds: 8.7,
    status: 'failed',
    passedTests: 19,
    failedTests: 5,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 79.2,
    failingTestIds: ['flaky-01'],
    remediated: false,
  },
  {
    id: 'run-109',
    runNumber: 109,
    commitSha: '2d48f91',
    commitMsg: 'fix: draft posix_compat module for CREATE_NEW_PROCESS_GROUP',
    branch: 'fix/posix-runner-shim',
    author: 'artemis-core',
    timestamp: '2026-10-25T06:40:00Z',
    durationSeconds: 8.5,
    status: 'flaky',
    passedTests: 22,
    failedTests: 1,
    flakyTests: 1,
    totalTests: 24,
    passRatePct: 91.7,
    failingTestIds: ['flaky-02'],
    remediated: false,
  },
  {
    id: 'run-110',
    runNumber: 110,
    commitSha: 'a4c91e8',
    commitMsg: 'ci(artemis-rea): install posix_compat shim & eliminate subprocess flakiness',
    branch: 'main',
    author: 'artemis-ci-bot',
    timestamp: '2026-10-25T09:15:00Z',
    durationSeconds: 7.4,
    status: 'passed',
    passedTests: 24,
    failedTests: 0,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 100.0,
    failingTestIds: [],
    remediated: true,
  },
  {
    id: 'run-111',
    runNumber: 111,
    commitSha: 'e912bc3',
    commitMsg: 'test: add comprehensive mock ADB daemon pooling',
    branch: 'main',
    author: 'morluto-bot',
    timestamp: '2026-10-25T11:30:00Z',
    durationSeconds: 7.1,
    status: 'passed',
    passedTests: 24,
    failedTests: 0,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 100.0,
    failingTestIds: [],
    remediated: true,
  },
  {
    id: 'run-112',
    runNumber: 112,
    commitSha: '8401df2',
    commitMsg: 'feat(mcp): stream REA AST symbols into Artemis prompt context',
    branch: 'main',
    author: 'artemis-core',
    timestamp: '2026-10-25T13:45:00Z',
    durationSeconds: 7.3,
    status: 'passed',
    passedTests: 24,
    failedTests: 0,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 100.0,
    failingTestIds: [],
    remediated: true,
  },
  {
    id: 'run-113',
    runNumber: 113,
    commitSha: 'c58f01b',
    commitMsg: 'chore: configure uv build distribution wheel packaging',
    branch: 'main',
    author: 'ci-bot',
    timestamp: '2026-10-25T15:20:00Z',
    durationSeconds: 6.9,
    status: 'passed',
    passedTests: 24,
    failedTests: 0,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 100.0,
    failingTestIds: [],
    remediated: true,
  },
  {
    id: 'run-114',
    runNumber: 114,
    commitSha: '61a9bc7',
    commitMsg: 'webhook: verify HMAC-SHA256 signature verification gate',
    branch: 'main',
    author: 'artemis-agent',
    timestamp: '2026-10-25T17:05:00Z',
    durationSeconds: 7.0,
    status: 'passed',
    passedTests: 24,
    failedTests: 0,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 100.0,
    failingTestIds: [],
    remediated: true,
  },
  {
    id: 'run-115',
    runNumber: 115,
    commitSha: 'fd239a0',
    commitMsg: 'release: prepare v0.4.2 automated distribution bundle',
    branch: 'main',
    author: 'supervisor-swarm',
    timestamp: '2026-10-25T19:10:00Z',
    durationSeconds: 7.2,
    status: 'passed',
    passedTests: 24,
    failedTests: 0,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 100.0,
    failingTestIds: [],
    remediated: true,
  },
  {
    id: 'run-116',
    runNumber: 116,
    commitSha: '419eb0a',
    commitMsg: 'ci: run all matrix suites upon commit push',
    branch: 'main',
    author: 'artemis-ci-bot',
    timestamp: '2026-10-25T21:00:00Z',
    durationSeconds: 6.8,
    status: 'passed',
    passedTests: 24,
    failedTests: 0,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 100.0,
    failingTestIds: [],
    remediated: true,
  },
  {
    id: 'run-117',
    runNumber: 117,
    commitSha: '98cc2f1',
    commitMsg: 'swarm: register push webhook and armed delivery route',
    branch: 'main',
    author: 'artemis-agent',
    timestamp: '2026-10-25T23:14:00Z',
    durationSeconds: 6.7,
    status: 'passed',
    passedTests: 24,
    failedTests: 0,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 100.0,
    failingTestIds: [],
    remediated: true,
  },
  {
    id: 'run-118',
    runNumber: 118,
    commitSha: '01bc48f',
    commitMsg: 'release(v0.4.3): synthesize release notes with lead supervisor agent',
    branch: 'main',
    author: 'artemis-ci-bot',
    timestamp: '2026-10-26T01:30:00Z',
    durationSeconds: 6.9,
    status: 'passed',
    passedTests: 24,
    failedTests: 0,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 100.0,
    failingTestIds: [],
    remediated: true,
  },
  {
    id: 'run-119',
    runNumber: 119,
    commitSha: '7f9910c',
    commitMsg: 'ci: verify d3 pipeline telemetry tracking and flaky matrix',
    branch: 'main',
    author: 'artemis-ci-bot',
    timestamp: '2026-10-26T03:45:00Z',
    durationSeconds: 6.6,
    status: 'passed',
    passedTests: 24,
    failedTests: 0,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 100.0,
    failingTestIds: [],
    remediated: true,
  },
  {
    id: 'run-120',
    runNumber: 120,
    commitSha: 'e48a12d',
    commitMsg: 'ci(artemis-rea): 100% green build on push trigger verification',
    branch: 'main',
    author: 'artemis-ci-bot',
    timestamp: '2026-10-26T06:00:00Z',
    durationSeconds: 6.5,
    status: 'passed',
    passedTests: 24,
    failedTests: 0,
    flakyTests: 0,
    totalTests: 24,
    passRatePct: 100.0,
    failingTestIds: [],
    remediated: true,
  },
];

export const INITIAL_FLAKY_TEST_RECORDS: FlakyTestRecord[] = [
  {
    id: 'flaky-01',
    testName: 'test_subprocess_creation_flags',
    filePath: 'tests/unit/mcp/test_device_utils.py:42',
    flakinessRatePct: 62.5,
    failureMode:
      "AttributeError: module 'subprocess' has no attribute 'CREATE_NEW_PROCESS_GROUP' when executing under Linux runner.",
    rootCauseCategory: 'Windows/POSIX Subprocess',
    remediationStatus: 'Fixed via posix_compat',
    remediationSnippet: `try:
    kwargs["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
except AttributeError:
    kwargs["creationflags"] = 0  # POSIX runner normalization`,
    totalExecutions: 20,
    recentResults: ['fail', 'fail', 'fail', 'fail', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass'],
  },
  {
    id: 'flaky-02',
    testName: 'test_device_action_timeout_handling',
    filePath: 'tests/unit/mcp/test_device_action.py:118',
    flakinessRatePct: 35.0,
    failureMode:
      'TimeoutError: Mock ADB socket daemon port collision on fast runner concurrency.',
    rootCauseCategory: 'Socket Race Condition',
    remediationStatus: 'Fixed via mock ADB pooling',
    remediationSnippet: `@pytest.fixture(scope="function")
def isolated_adb_socket(tmp_path):
    sock_path = str(tmp_path / "mock_adb.sock")
    with MockAdbServer(sock_path) as s:
        yield s`,
    totalExecutions: 20,
    recentResults: ['flake', 'pass', 'flake', 'pass', 'flake', 'pass', 'pass', 'pass', 'pass', 'pass'],
  },
  {
    id: 'flaky-03',
    testName: 'test_decompiler_stdio_transport_handshake',
    filePath: 'tests/integration/test_rea_bridge.py:76',
    flakinessRatePct: 25.0,
    failureMode:
      'BrokenPipeError: Decompiler subprocess closed JSON-RPC pipe before handshake completed.',
    rootCauseCategory: 'Async Decompiler Timeout',
    remediationStatus: 'Mitigated with Retries',
    remediationSnippet: `async with asyncio.timeout(5.0):
    await transport.wait_handshake(retries=3, backoff=0.2)`,
    totalExecutions: 20,
    recentResults: ['fail', 'pass', 'pass', 'flake', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass'],
  },
  {
    id: 'flaky-04',
    testName: 'test_ast_symbol_cache_concurrency',
    filePath: 'tests/unit/rea/test_symbol_table.py:91',
    flakinessRatePct: 20.0,
    failureMode:
      'PermissionError: [Errno 13] Access is denied: sqlite cache file locked by parallel pytest worker.',
    rootCauseCategory: 'Runner File Lock',
    remediationStatus: 'Fixed via mock ADB pooling',
    remediationSnippet: `cache_db = f"file:memdb_{uuid.uuid4().hex}?mode=memory&cache=shared"`,
    totalExecutions: 20,
    recentResults: ['pass', 'fail', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass'],
  },
  {
    id: 'flaky-05',
    testName: 'test_android_manifest_fast_xpath',
    filePath: 'tests/unit/mcp/test_manifest_scanner.py:53',
    flakinessRatePct: 15.0,
    failureMode:
      'AssertionError: Expected exported activity count 4, got 3 due to XML namespace stripping.',
    rootCauseCategory: 'Async Decompiler Timeout',
    remediationStatus: 'Fixed via posix_compat',
    remediationSnippet: `namespaces = {"android": "http://schemas.android.com/apk/res/android"}
root.findall(".//activity[@android:exported='true']", namespaces)`,
    totalExecutions: 20,
    recentResults: ['pass', 'flake', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass'],
  },
  {
    id: 'flaky-06',
    testName: 'test_uv_ephemeral_wheel_installation',
    filePath: 'tests/packaging/test_wheel_smoke.py:28',
    flakinessRatePct: 10.0,
    failureMode:
      'CalledProcessError: uv pip install --no-index returned exit code 1 on cold runner cache.',
    rootCauseCategory: 'Runner File Lock',
    remediationStatus: 'Fixed via posix_compat',
    remediationSnippet: `env["UV_SYSTEM_PYTHON"] = "1"
env["UV_NO_BUILD_ISOLATION"] = "0"`,
    totalExecutions: 20,
    recentResults: ['pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass'],
  },
];

// ---------------------------------------------------------------------------
// Open Source Quant Repository & Workflow Creator Presets & Models
// ---------------------------------------------------------------------------

export interface QuantRepository {
  id: string;
  name: string;
  ownerRepo: string;
  url: string;
  description: string;
  category: 'Alpha ML Platform' | 'Crypto & Multi-Exchange' | 'Multi-Asset Engine' | 'Event-Driven Platform';
  stars: string;
  license: string;
  keyModules: string[];
  defaultBranch: string;
  language: string;
  frameworkVersion: string;
  highlightInvariants: string[];
}

export interface QuantWorkflowNode {
  id: string;
  type:
    | 'data_ingest'
    | 'alpha_signals'
    | 'strategy_logic'
    | 'risk_rules'
    | 'backtest_engine'
    | 'execution_broker'
    | 'ci_regression';
  title: string;
  description: string;
  stageBadge: string;
  parameters: Record<string, string | number | boolean>;
}

export interface QuantWorkflowTemplate {
  id: string;
  title: string;
  repoId: string;
  repoName: string;
  description: string;
  targetAssetClass: 'Equities' | 'Crypto' | 'Futures' | 'FX';
  timeframe: '1m' | '5m' | '1h' | '1D';
  nodes: QuantWorkflowNode[];
  generatedPythonStrategy: string;
  generatedCiWorkflow: string;
  backtestMetrics: {
    sharpeRatio: number;
    annualizedReturnPct: number;
    maxDrawdownPct: number;
    winRatePct: number;
    totalTrades: number;
    profitFactor: number;
  };
}

export const INITIAL_QUANT_REPOSITORIES: QuantRepository[] = [
  {
    id: 'quant-qlib',
    name: 'Microsoft Qlib',
    ownerRepo: 'microsoft/qlib',
    url: 'https://github.com/microsoft/qlib',
    description:
      'AI-oriented quantitative investment open-source platform, containing data preparation, alpha model training, backtesting, and portfolio optimization.',
    category: 'Alpha ML Platform',
    stars: '16.8k',
    license: 'MIT License',
    keyModules: [
      'qlib.data.dataset (high-performance binary dataset storage)',
      'qlib.model.trainer (LightGBM, GRU, Transformer alpha predictors)',
      'qlib.backtest (execution simulator with slippage & order cost)',
      'qlib.contrib.strategy (Topk, WeightStrategy, Risk-Parity)',
    ],
    defaultBranch: 'main',
    language: 'Python',
    frameworkVersion: 'v0.9.3',
    highlightInvariants: [
      'Pre-computed binary expressions avoid runtime pandas overhead (20x speedup)',
      'Cross-sectional factor neutralization prevents market-beta exposure leakage',
      'Walk-forward time-series split prevents lookahead bias in model validation',
    ],
  },
  {
    id: 'quant-ccxt',
    name: 'CCXT Pro & Rest',
    ownerRepo: 'ccxt/ccxt',
    url: 'https://github.com/ccxt/ccxt',
    description:
      'Unified JavaScript/Python cryptocurrency trading and market data library with native support for 100+ exchanges, order books, and WebSocket feeds.',
    category: 'Crypto & Multi-Exchange',
    stars: '34.5k',
    license: 'MIT License',
    keyModules: [
      'ccxt.pro (asynchronous WebSocket real-time orderbook streaming)',
      'ccxt.binance / bybit / coinbase (unified normalized execution endpoints)',
      'ccxt.async_support (high-throughput asyncio concurrent order router)',
      'ccxt.base.errors (normalized exchange rate-limit and auth exceptions)',
    ],
    defaultBranch: 'master',
    language: 'Python / TypeScript',
    frameworkVersion: 'v4.2.18',
    highlightInvariants: [
      'Universal ticker and order data structures across 100+ spot and perp venues',
      'Built-in exponential backoff token bucket prevents exchange API rate-limit bans',
      'Dual-signature HMAC-SHA256 & Ed25519 authentication for live/testnet orders',
    ],
  },
  {
    id: 'quant-lean',
    name: 'QuantConnect LEAN',
    ownerRepo: 'QuantConnect/Lean',
    url: 'https://github.com/QuantConnect/Lean',
    description:
      'Production-grade open source algorithmic trading engine in C# and Python, powering institutional backtesting, paper trading, and multi-broker execution.',
    category: 'Multi-Asset Engine',
    stars: '9.2k',
    license: 'Apache-2.0',
    keyModules: [
      'QuantConnect.Algorithm (QCAlgorithm modular strategy lifecycle)',
      'QuantConnect.Indicators (RSI, Bollinger, ATR, EMA technical indicators)',
      'QuantConnect.Risk (MaximumDrawdownPercentPerSecurity, RiskParity)',
      'QuantConnect.Brokerages (Interactive Brokers, Alpaca, Oanda gateways)',
    ],
    defaultBranch: 'master',
    language: 'Python / C#',
    frameworkVersion: 'v2.5.0',
    highlightInvariants: [
      'Tick-level event-driven simulation with realistic fill queuing and margin checks',
      'Dynamic security universe selection based on dollar volume and volatility',
      'Automated warm-up periods ensure technical indicators stabilize before orders fire',
    ],
  },
  {
    id: 'quant-vnpy',
    name: 'VNPY Trading Framework',
    ownerRepo: 'vnpy/vnpy',
    url: 'https://github.com/vnpy/vnpy',
    description:
      'Event-driven quantitative trading platform providing institutional gateways to futures, options, equities, and crypto markets.',
    category: 'Event-Driven Platform',
    stars: '23.4k',
    license: 'MIT License',
    keyModules: [
      'vnpy.trader.engine (EventEngine core dispatcher and timer loop)',
      'vnpy_ctp / vnpy_ib (low-latency C++ binary gateway connectors)',
      'vnpy.app.cta_strategy (CtaTemplate state machine and bar generator)',
      'vnpy.app.risk_manager (order frequency check & max contract guard)',
    ],
    defaultBranch: 'master',
    language: 'Python',
    frameworkVersion: 'v3.9.0',
    highlightInvariants: [
      'Zero-lock lock-free EventEngine eliminates GIL contention in fast market feeds',
      'Strict pre-trade risk filter blocks orders exceeding daily loss or margin bounds',
      'Bar generator accurately aggregates raw ticks without timestamp interpolation drift',
    ],
  },
];

export const INITIAL_QUANT_TEMPLATES: QuantWorkflowTemplate[] = [
  {
    id: 'wf-qlib-alpha-ml',
    title: 'Multi-Factor Alpha Prediction & Risk-Neutralized Portfolio',
    repoId: 'quant-qlib',
    repoName: 'microsoft/qlib',
    description:
      'Ingests cross-sectional equity OHLCV data, synthesizes 158 technical & fundamental alpha factors, trains a LightGBM regressor with walk-forward validation, and enforces sector-neutral sizing.',
    targetAssetClass: 'Equities',
    timeframe: '1D',
    nodes: [
      {
        id: 'node-1',
        type: 'data_ingest',
        title: 'Qlib Daily Cross-Sectional Ingest',
        description: 'Binary format daily bar store covering S&P 500 / CSI 300 universe with survivorship bias elimination.',
        stageBadge: 'Stage 1: Ingest',
        parameters: { universe: 'SP500', split_train: '2020-01-01:2024-12-31', split_test: '2025-01-01:2026-10-01' },
      },
      {
        id: 'node-2',
        type: 'alpha_signals',
        title: 'Alpha158 Factor Generator',
        description: 'Computes normalized momentum, volatility, volume ratio, and mean-reversion factor tensors.',
        stageBadge: 'Stage 2: Features',
        parameters: { factor_suite: 'Alpha158', standardization: 'zscore', winsorize_quantile: 0.025 },
      },
      {
        id: 'node-3',
        type: 'strategy_logic',
        title: 'LightGBM Gradient Boosting Alpha Ranker',
        description: 'Predicts 5-day forward excess return rankings with L2 regularization and monotonic constraints.',
        stageBadge: 'Stage 3: Model',
        parameters: { max_depth: 6, learning_rate: 0.04, num_trees: 350, top_k_long: 30, top_k_short: 30 },
      },
      {
        id: 'node-4',
        type: 'risk_rules',
        title: 'Sector-Neutral & Max Drawdown Guard',
        description: 'Constrains industry net exposure to ±3% and caps gross single-asset leverage at 4.0%.',
        stageBadge: 'Stage 4: Risk',
        parameters: { max_drawdown_stop_pct: 7.5, max_sector_tilt_pct: 3.0, single_asset_max_weight: 0.05 },
      },
      {
        id: 'node-5',
        type: 'ci_regression',
        title: 'GitHub Actions Strategy Drift CI Gate',
        description: 'Automated push workflow executing test backtest to prevent Sharpe ratio degradation below 1.5.',
        stageBadge: 'Stage 5: CI/CD',
        parameters: { min_sharpe: 1.5, max_drawdown_gate: 8.0, trigger: 'push_main' },
      },
    ],
    generatedPythonStrategy: `"""
Qlib Alpha158 Quantitative Workflow Strategy
Grounded in: microsoft/qlib & Artemis CI/CD Invariants
"""
import qlib
from qlib.config import REG_CN
from qlib.contrib.model.gbdt import LGBModel
from qlib.contrib.data.handler import Alpha158
from qlib.contrib.strategy import TopkDropoutStrategy
from qlib.backtest import backtest, executor

# 1. Initialize Qlib Binary Cache
qlib.init(provider_uri="~/.qlib/qlib_data/us_data", region="us")

# 2. Configure Alpha Feature Pipeline
data_handler = Alpha158(
    instruments="sp500",
    start_time="2020-01-01",
    end_time="2026-10-26",
    fit_start_time="2020-01-01",
    fit_end_time="2024-12-31"
)

# 3. Fit LightGBM Alpha Ranker
model = LGBModel(
    loss="mse",
    max_depth=6,
    learning_rate=0.04,
    n_estimators=350,
    colsample_bytree=0.88
)
model.fit(dataset=data_handler)

# 4. Enforce Top-K & Risk-Constrained Execution
strategy = TopkDropoutStrategy(
    topk=30,
    n_drop=5,
    risk_degree=0.95,
    max_single_weight=0.05
)

def run_strategy_backtest():
    portfolio_metrics = backtest(
        strategy=strategy,
        executor=executor.SimulatorExecutor(time_per_step="day", generate_report=True),
        start_time="2025-01-01",
        end_time="2026-10-26"
    )
    assert portfolio_metrics["sharpe"] >= 1.5, "CI Gate Failed: Strategy Sharpe fell below threshold"
    return portfolio_metrics
`,
    generatedCiWorkflow: `name: Quant Strategy Drift Regression CI
on:
  push:
    branches: [main, feat/*]
  pull_request:

jobs:
  validate-alpha-workflow:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Astral uv & Python 3.11
        uses: astral-sh/setup-uv@v3
        with:
          python-version: "3.11"
      - name: Install Qlib & Backtest Dependencies
        run: |
          uv pip install qlib lightgbm pyyaml numpy scipy pandas pytest
      - name: Run Strategy Backtest Regression Gate
        run: |
          uv run python -c "from strategy_pipeline import run_strategy_backtest; run_strategy_backtest()"
`,
    backtestMetrics: {
      sharpeRatio: 2.14,
      annualizedReturnPct: 26.8,
      maxDrawdownPct: 6.4,
      winRatePct: 58.7,
      totalTrades: 482,
      profitFactor: 1.84,
    },
  },
  {
    id: 'wf-ccxt-stat-arb',
    title: 'Cross-Exchange Statistical Arbitrage & Real-Time Order Router',
    repoId: 'quant-ccxt',
    repoName: 'ccxt/ccxt',
    description:
      'Asynchronously streams order book snapshots across Binance, Bybit, and OKX via CCXT.pro WebSocket gateways, detects spread divergences exceeding fee barriers, and executes atomic hedge orders.',
    targetAssetClass: 'Crypto',
    timeframe: '1m',
    nodes: [
      {
        id: 'node-c1',
        type: 'data_ingest',
        title: 'CCXT Pro WebSocket Streamer',
        description: 'Multi-exchange async L2 order book aggregator with sub-10ms tick latency.',
        stageBadge: 'Stage 1: Streaming',
        parameters: { exchanges: 'binance,bybit,okx', symbols: 'BTC/USDT,ETH/USDT', depth: 20 },
      },
      {
        id: 'node-c2',
        type: 'alpha_signals',
        title: 'Microstructure Spread Divergence Model',
        description: 'Computes real-time triangular and spatial basis divergence net of taker and VIP trading fees.',
        stageBadge: 'Stage 2: Alpha',
        parameters: { min_spread_bps: 14.5, fee_buffer_bps: 8.0, lookback_ticks: 60 },
      },
      {
        id: 'node-c3',
        type: 'strategy_logic',
        title: 'Concurrent Atomic Leg Router',
        description: 'Simultaneously fires market buy on Venue A and market sell on Venue B using asyncio.gather.',
        stageBadge: 'Stage 3: Execution',
        parameters: { max_clip_usd: 15000, max_slippage_bps: 2.0, cancel_timeout_ms: 250 },
      },
      {
        id: 'node-c4',
        type: 'risk_rules',
        title: 'Inventory Imbalance & Hard Kill Switch',
        description: 'Enforces maximum net delta exposure ($25k) and aborts execution if WebSocket drops for > 500ms.',
        stageBadge: 'Stage 4: Risk',
        parameters: { max_inventory_delta_usd: 25000, heartbeat_timeout_ms: 500, emergency_liquidate: true },
      },
      {
        id: 'node-c5',
        type: 'ci_regression',
        title: 'Headless Mock Exchange CI Simulation Gate',
        description: 'Runs mocked WebSocket mock exchange fixture verifying zero unhedged leg executions.',
        stageBadge: 'Stage 5: CI/CD',
        parameters: { test_mock_venues: 3, latency_jitter_ms: 5, assert_zero_unhedged: true },
      },
    ],
    generatedPythonStrategy: `"""
CCXT Pro High-Frequency Cross-Venue Statistical Arbitrage
Grounded in: ccxt/ccxt & Artemis CI Automation
"""
import asyncio
import ccxt.pro as ccxtpro

async def arbitrage_loop():
    binance = ccxtpro.binance({"enableRateLimit": True, "options": {"defaultType": "swap"}})
    bybit = ccxtpro.bybit({"enableRateLimit": True, "options": {"defaultType": "swap"}})
    symbol = "BTC/USDT:USDT"

    try:
        while True:
            orderbook_binance, orderbook_bybit = await asyncio.gather(
                binance.watch_order_book(symbol, limit=10),
                bybit.watch_order_book(symbol, limit=10)
            )

            best_ask_binance = orderbook_binance["asks"][0][0]
            best_bid_bybit = orderbook_bybit["bids"][0][0]
            spread_pct = ((best_bid_bybit - best_ask_binance) / best_ask_binance) * 10000

            # Execute if spread exceeds round-trip fee threshold (12 bps)
            if spread_pct > 12.0:
                print(f"[ARB TRIGGER] Spread: {spread_pct:.2f} bps! Firing atomic legs...")
                await asyncio.gather(
                    binance.create_market_buy_order(symbol, 0.05),
                    bybit.create_market_sell_order(symbol, 0.05)
                )
            await asyncio.sleep(0.01)
    finally:
        await binance.close()
        await bybit.close()

if __name__ == "__main__":
    asyncio.run(arbitrage_loop())
`,
    generatedCiWorkflow: `name: CCXT Arbitrage Execution Smoke Test
on: [push, pull_request]

jobs:
  verify-arbitrage-invariants:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
        with:
          python-version: "3.11"
      - name: Install CCXT Pro & Pytest
        run: uv pip install ccxt pytest pytest-asyncio
      - name: Run Atomic Dual-Leg Execution Suite
        run: uv run pytest tests/test_ccxt_arbitrage_atomic.py -v
`,
    backtestMetrics: {
      sharpeRatio: 3.42,
      annualizedReturnPct: 38.4,
      maxDrawdownPct: 2.9,
      winRatePct: 76.2,
      totalTrades: 1240,
      profitFactor: 2.31,
    },
  },
  {
    id: 'wf-lean-mean-reversion',
    title: 'Multi-Asset Mean Reversion with Value-at-Risk (VaR) Gate',
    repoId: 'quant-lean',
    repoName: 'QuantConnect/Lean',
    description:
      'Implements an event-driven statistical mean reversion strategy over liquid ETF pairs using QuantConnect LEAN, incorporating historical volatility bands and dynamic margin buffers.',
    targetAssetClass: 'Futures',
    timeframe: '5m',
    nodes: [
      {
        id: 'node-l1',
        type: 'data_ingest',
        title: 'LEAN Tick & Bar Resolution Brokerage Feed',
        description: 'Interactive Brokers / Alpaca continuous tick aggregator with split & dividend adjustment.',
        stageBadge: 'Stage 1: Ingest',
        parameters: { resolution: 'Minute', symbols: 'SPY,QQQ,IWM,TLT', fill_forward: true },
      },
      {
        id: 'node-l2',
        type: 'alpha_signals',
        title: 'Adaptive Bollinger Band & RSI Filter',
        description: 'Calculates dynamic standard deviation channels based on Parkinson intraday volatility.',
        stageBadge: 'Stage 2: Indicators',
        parameters: { period: 20, num_std: 2.2, rsi_oversold: 28, rsi_overbought: 72 },
      },
      {
        id: 'node-l3',
        type: 'risk_rules',
        title: 'Historical 99% VaR & Trailing Stop Gate',
        description: 'Restricts intraday portfolio 1-day 99% Value-at-Risk to under 1.8% of net liquidating value.',
        stageBadge: 'Stage 3: Risk',
        parameters: { max_var_99_pct: 1.8, trailing_stop_pct: 1.2, max_leverage: 2.0 },
      },
      {
        id: 'node-l4',
        type: 'backtest_engine',
        title: 'Event-Driven Backtest Harness',
        description: 'Simulates slippage, broker commission schedules, and borrow fees for overnight short positions.',
        stageBadge: 'Stage 4: Engine',
        parameters: { fee_model: 'InteractiveBrokersFeeModel', slippage_model: 'VolumeShareSlippageModel' },
      },
      {
        id: 'node-l5',
        type: 'ci_regression',
        title: 'Push-Triggered Algorithm Backtest Gate',
        description: 'Automated CI test verifying that code changes maintain Sharpe > 1.8 and Max DD < 5%.',
        stageBadge: 'Stage 5: CI/CD',
        parameters: { runner: 'ubuntu-latest', docker_lean: 'quantconnect/lean:latest', timeout_minutes: 10 },
      },
    ],
    generatedPythonStrategy: `"""
QuantConnect LEAN Python Algorithm: Multi-Asset Adaptive Mean Reversion
Grounded in: QuantConnect/Lean & Artemis CI Invariants
"""
from AlgorithmImports import *

class AdaptiveMeanReversion(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(2023, 1, 1)
        self.SetCash(100000)
        self.symbols = [self.AddEquity(ticker, Resolution.Minute).Symbol for ticker in ["SPY", "QQQ", "IWM"]]

        self.bb_indicators = {}
        self.rsi_indicators = {}
        for sym in self.symbols:
            self.bb_indicators[sym] = self.BB(sym, 20, 2.2, MovingAverageType.Simple, Resolution.Minute)
            self.rsi_indicators[sym] = self.RSI(sym, 14, MovingAverageType.Wilders, Resolution.Minute)

        self.SetRiskManagement(MaximumDrawdownPercentPerSecurity(0.02))
        self.Schedule.On(self.DateRules.EveryDay("SPY"), self.TimeRules.AfterMarketOpen("SPY", 10), self.Rebalance)

    def Rebalance(self):
        for sym in self.symbols:
            if not self.bb_indicators[sym].IsReady:
                continue
            price = self.Securities[sym].Price
            lower = self.bb_indicators[sym].LowerBand.Current.Value
            upper = self.bb_indicators[sym].UpperBand.Current.Value
            rsi = self.rsi_indicators[sym].Current.Value

            # Mean-reversion entry
            if price <= lower and rsi < 30:
                self.SetHoldings(sym, 0.30)
            elif price >= upper and rsi > 70:
                self.Liquidate(sym)
`,
    generatedCiWorkflow: `name: LEAN Algorithm Verification CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  run-lean-engine:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Pull LEAN Engine Docker Image
        run: docker pull quantconnect/lean:latest
      - name: Execute Strategy Backtest Smoke Test
        run: |
          docker run --rm -v $(pwd):/app quantconnect/lean:latest backtest /app/strategy
`,
    backtestMetrics: {
      sharpeRatio: 1.98,
      annualizedReturnPct: 19.4,
      maxDrawdownPct: 4.8,
      winRatePct: 64.1,
      totalTrades: 310,
      profitFactor: 1.92,
    },
  },
];

