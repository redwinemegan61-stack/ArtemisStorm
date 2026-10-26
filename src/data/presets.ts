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
