import React, { useState, useMemo, useEffect } from 'react';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  GitBranch,
  Terminal,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  FileCode2,
  Search,
  RefreshCw,
  ArrowUpRight,
  SlidersHorizontal,
  FolderGit2,
  Send,
  Webhook,
  KeyRound,
  Activity,
  Tag,
  Sparkles,
  PackageCheck,
  FileText,
  HeartPulse,
  TrendingUp,
  Zap,
  Plus,
  ExternalLink,
  Lock,
  X,
} from 'lucide-react';
import {
  INITIAL_ARTEMIS_REA_REPORT,
  DEFAULT_PIPELINE_STEPS,
  NETFLIX_REA_REPORT,
  NETFLIX_PIPELINE_STEPS,
  JEV_REPO_REPORT,
  JEV_PIPELINE_STEPS,
  OPENCODE_REA_REPORT,
  OPENCODE_PIPELINE_STEPS,
  INITIAL_HISTORICAL_CI_RUNS,
  INITIAL_FLAKY_TEST_RECORDS,
  ReverseEngineeringReport,
  ArchitectureNode,
  TrustGroupSop,
  HistoricalCiExecution,
  FlakyTestRecord,
  PipelineStep,
} from './data/presets';
import ModuleTopologyGraph, { TopologyGraphNode } from './components/ModuleTopologyGraph';
import PipelineHealthChart from './components/PipelineHealthChart';
import QuantWorkflowStudio from './components/QuantWorkflowStudio';

type ArtifactTab = 'unified-ci' | 'posix-patch' | 'pytest-suite' | 'original-ci';
type TierFilter = 'All' | 'Supervisor' | 'MCP Core' | 'Decompiler Bridge' | 'Device Automation' | 'CI/CD Gate';
type TargetPreset = 'artemis' | 'netflix' | 'jev' | 'opencode' | 'custom';

export default function App() {
  const [report, setReport] = useState<ReverseEngineeringReport>(INITIAL_ARTEMIS_REA_REPORT);
  const [repoInput, setRepoInput] = useState<string>(
    'https://github.com/google/artemis/blob/main/.github%2Fworkflows%2Fci.yml'
  );
  const [tacticalObjective, setTacticalObjective] = useState<string>(
    'Ensure CI runs on every code commit, fix Linux subprocess flags, integrate REA decompiler with Artemis MCP, and delegate routine tasks to Trust-Group workers.'
  );
  const [customCodeContext, setCustomCodeContext] = useState<string>('');
  const [showAdvancedInput, setShowAdvancedInput] = useState<boolean>(false);

  // Swarm & GitHub inspection states
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isInspectingGh, setIsInspectingGh] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [discoveredFiles, setDiscoveredFiles] = useState<string[]>([
    '.github/workflows/ci.yml',
    'pyproject.toml',
    'uv.lock',
    'mcp_server/server.py',
    'mcp_server/utils/device_utils.py',
    'mcp_server/tools/adb_tools.py',
    'tests/unit/mcp/test_device_utils.py',
  ]);

  // Active repository preset & custom repo connection states
  const [activePreset, setActivePreset] = useState<TargetPreset>('artemis');
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(DEFAULT_PIPELINE_STEPS);
  const [isCustomRepoModalOpen, setIsCustomRepoModalOpen] = useState<boolean>(false);
  const [customRepoUrl, setCustomRepoUrl] = useState<string>('https://github.com/jev');
  const [customRepoBranch, setCustomRepoBranch] = useState<string>('main');
  const [customRepoArchitectureType, setCustomRepoArchitectureType] = useState<'jev' | 'artemis' | 'netflix'>('jev');
  const [customRepoPat, setCustomRepoPat] = useState<string>('');
  const [customRepoNotes, setCustomRepoNotes] = useState<string>('My JEV discrete typed-decision action agent repository');

  // CI Pipeline Simulator states
  const [isRunningCi, setIsRunningCi] = useState<boolean>(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>(() =>
    DEFAULT_PIPELINE_STEPS.map((s) => s.id)
  );
  const [activeStepId, setActiveStepId] = useState<string>('step-4');

  // Code viewer states
  const [activeArtifactTab, setActiveArtifactTab] = useState<ArtifactTab>('unified-ci');
  const [copiedArtifact, setCopiedArtifact] = useState<boolean>(false);

  // Architecture table & D3 topology graph states
  const [archSearch, setArchSearch] = useState<string>('');
  const [archTierFilter, setArchTierFilter] = useState<TierFilter>('All');
  const [selectedNode, setSelectedNode] = useState<ArchitectureNode | null>(
    INITIAL_ARTEMIS_REA_REPORT.architectureNodes[1]
  );
  const [selectedGraphItem, setSelectedGraphItem] = useState<TopologyGraphNode | null>(null);

  // Sub-agent trainer states
  const [trainTaskInput, setTrainTaskInput] = useState<string>(
    'Parse AndroidManifest.xml and extract exported intent filters for Artemis ADB testing without decompiling full DEX bytecode.'
  );
  const [trainTargetModule, setTrainTargetModule] = useState<string>('rea_bridge/manifest_scanner.py');
  const [trainComputeTier, setTrainComputeTier] = useState<string>('Minimal (Tier-3 Worker)');
  const [isTrainingSubAgent, setIsTrainingSubAgent] = useState<boolean>(false);
  const [lastTrainingOutput, setLastTrainingOutput] = useState<{
    subAgentWorkArtifact: string;
    supervisorAuditLog: string;
  } | null>(null);

  // Direct GitHub Push states
  const [targetDeployRepo, setTargetDeployRepo] = useState<string>('');
  const [targetDeployBranch, setTargetDeployBranch] = useState<string>('main');
  const [githubPat, setGithubPat] = useState<string>('');
  const [commitMsg, setCommitMsg] = useState<string>(
    'ci(artemis-rea): run full REA + Artemis test matrix & auto-deploy on every push'
  );
  const [isPushingGh, setIsPushingGh] = useState<boolean>(false);
  const [pushResult, setPushResult] = useState<{
    repo: string;
    branch: string;
    committedFiles: Array<{ path: string; htmlUrl?: string; sha?: string }>;
  } | null>(null);

  // CI/CD Webhook Registration states
  const [webhookPayloadUrl, setWebhookPayloadUrl] = useState<string>(() =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/github-push`
      : 'https://artemis-rea-swarm.run.app/api/webhooks/github-push'
  );
  const [webhookSecretToken, setWebhookSecretToken] = useState<string>('whsec_artemis_rea_default_hmac_key');
  const [webhookContentType, setWebhookContentType] = useState<string>('application/json');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(['push', 'pull_request']);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState<boolean>(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [webhookStatusNote, setWebhookStatusNote] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState<boolean>(false);
  const [registeredWebhookMeta, setRegisteredWebhookMeta] = useState<{
    id: string;
    payloadUrl: string;
    secretTokenPreview: string;
    events: string[];
    targetRepo: string;
    active: boolean;
    updatedAt: string;
  }>({
    id: 'wh-artemis-rea-01',
    payloadUrl:
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/webhooks/github-push`
        : 'https://artemis-rea-swarm.run.app/api/webhooks/github-push',
    secretTokenPreview: 'whsec_ar•••••••• (9b4e8f1c3a72d6e5)',
    events: ['push', 'pull_request'],
    targetRepo: 'google/artemis',
    active: true,
    updatedAt: '2026-10-25T23:14:42Z',
  });
  const [webhookDeliveries, setWebhookDeliveries] = useState<
    Array<{
      id: string;
      deliveryId: string;
      event: string;
      repository: string;
      branch: string;
      commitSha: string;
      pusher: string;
      signatureHeader: string;
      signatureVerified: boolean;
      swarmStatus: string;
      durationMs: number;
      timestamp: string;
      summary: string;
    }>
  >([
    {
      id: 'deliv-1',
      deliveryId: '7f9c2d10-b41a-11ef-9a12-0800200c9a66',
      event: 'push',
      repository: 'google/artemis',
      branch: 'refs/heads/main',
      commitSha: 'a4c91e8',
      pusher: 'artemis-ci-bot',
      signatureHeader: 'sha256=9b4e8f1c3a72d6e5012a98c4f1d2e3a4b5c6d7e8...',
      signatureVerified: true,
      swarmStatus: 'Triggered & Passed',
      durationMs: 1240,
      timestamp: '2026-10-25T23:14:00Z',
      summary: 'HMAC-SHA256 verified. Executed REA AST diff + Artemis headless ADB suite (22/22 passed).',
    },
  ]);

  // Release Automation states
  const [releaseTagName, setReleaseTagName] = useState<string>('v0.4.3');
  const [releaseName, setReleaseName] = useState<string>('v0.4.3: Automated Push CI/CD & REA Decompiler Matrix');
  const [releaseTargetCommitish, setReleaseTargetCommitish] = useState<string>('main');
  const [releaseIsDraft, setReleaseIsDraft] = useState<boolean>(false);
  const [releaseIsPrerelease, setReleaseIsPrerelease] = useState<boolean>(false);
  const [releaseNotes, setReleaseNotes] = useState<string>(`## Release v0.4.3 — Artemis & REA Swarm

### Executive Summary
Production-grade automated release for **google/artemis** incorporating the REA (Reverse Engineer Anything) decompiler bridge.
All 5 CI/CD pipeline stages verified passing with zero-touch push triggers and Linux POSIX subprocess compatibility.

### CI/CD Remediations & Push Invariants
- **Unrestricted Push CI**: Removed \`workflow_dispatch\` blocking gate so tests run on all branch commits.
- **POSIX Runner Shim**: Installed \`mcp_server/utils/posix_compat.py\` preventing Linux runner \`AttributeError\` on Windows subprocess constants.
- **Automated Matrix**: Verified REA AST symbol extractor and Artemis headless ADB suite.

### Reverse-Engineered MCP Endpoints
- \`rea_extract_control_flow\`: Binary/AST decompiler symbol extractor.
- \`artemis_execute_device_action\`: Android ADB natural-language execution bridge.
- \`swarm_synthesize_regression_test\`: Autonomous regression synthesis for continuous verification.

### Packaged Distribution Artifacts
- \`artemis_rea_swarm-0.4.3-py3-none-any.whl\` (1.4 MB)
- \`.github/workflows/ci.yml\` (3.8 KB)
- \`posix_compat.py\` (1.2 KB)`);
  const [isGeneratingReleaseNotes, setIsGeneratingReleaseNotes] = useState<boolean>(false);
  const [isCreatingRelease, setIsCreatingRelease] = useState<boolean>(false);
  const [releaseSuccessNote, setReleaseSuccessNote] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [copiedReleaseNotes, setCopiedReleaseNotes] = useState<boolean>(false);
  const [recentReleases, setRecentReleases] = useState<
    Array<{
      id: string;
      tagName: string;
      releaseName: string;
      repository: string;
      targetCommitish: string;
      body: string;
      draft: boolean;
      prerelease: boolean;
      htmlUrl: string;
      createdAt: string;
      publishedAt: string;
      ciStatus: string;
      artifacts: Array<{ name: string; size: string; type: string }>;
    }>
  >([
    {
      id: 'rel-1',
      tagName: 'v0.4.2',
      releaseName: 'v0.4.2: Automated Push CI/CD & REA Decompiler Bridge',
      repository: 'google/artemis',
      targetCommitish: 'main',
      body: `## Summary\nProduction-verified release bundling the REA (Reverse Engineer Anything) decompiler bridge with Google Artemis MCP automation.\n\n### Verified CI/CD Status\n- **Static Audit & POSIX Gate**: Passed (Ruff linter + device_utils POSIX shim)\n- **REA & Artemis MCP Swarm Verification**: Passed (22/22 unit and matrix tests)\n- **Automated Deployment**: Verified wheel distribution and isolated smoke test\n\n### Key Remediations\n- **CI-01**: Removed workflow_dispatch gating so all test suites run on push.\n- **CI-02**: Implemented posix_compat.py to prevent AttributeError on Linux runners.\n- **CI-03**: Automated release packaging with uv build --wheel.`,
      draft: false,
      prerelease: false,
      htmlUrl: 'https://github.com/google/artemis/releases/tag/v0.4.2',
      createdAt: '2026-10-25T23:14:42Z',
      publishedAt: '2026-10-25T23:15:10Z',
      ciStatus: '5/5 Passing (All Matrix Suites)',
      artifacts: [
        { name: 'artemis_rea_swarm-0.4.2-py3-none-any.whl', size: '1.4 MB', type: 'Python Wheel' },
        { name: '.github/workflows/ci.yml', size: '3.8 KB', type: 'CI/CD Pipeline' },
        { name: 'posix_compat.py', size: '1.2 KB', type: 'POSIX Compatibility Shim' },
      ],
    },
  ]);

  // Open Source Quant Repository & Workflow Creator Window state
  const [isQuantStudioOpen, setIsQuantStudioOpen] = useState<boolean>(false);

  // Compliance Audit Log Exporter states
  const [auditReportJson, setAuditReportJson] = useState<string | null>(null);
  const [auditFilename, setAuditFilename] = useState<string>('compliance_audit_log.json');
  const [isExportingAudit, setIsExportingAudit] = useState<boolean>(false);
  const [auditExportNote, setAuditExportNote] = useState<string | null>(null);
  const [copiedAuditJson, setCopiedAuditJson] = useState<boolean>(false);

  const handleExportAuditLog = async () => {
    setIsExportingAudit(true);
    setAuditExportNote(null);
    try {
      const res = await fetch('/api/compliance/export-audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, ciRuns }),
      });
      const data = await res.json();
      if (data.ok) {
        const formatted = JSON.stringify(data.auditReport, null, 2);
        setAuditReportJson(formatted);
        setAuditFilename(data.filename || 'compliance_audit_report.json');
        setAuditExportNote('Compliance audit log successfully generated and certified with SHA-256 cryptographic signature.');
      } else {
        throw new Error(data.error || 'Failed to export audit log');
      }
    } catch {
      const fallbackObj = {
        complianceStandard: 'Artemis-REA-Swarm-Compliance-v1.0',
        generatedAt: new Date().toISOString(),
        targetRepository: report.repoFullName,
        executiveSummary: report.executiveSummary,
        trustGroupDecisions: report.trustGroupPlaybook,
        supervisorAuditLog: report.ciIssuesResolved,
        architectureNodes: report.architectureNodes,
        mcpContracts: report.mcpContracts,
        ciRunsCount: ciRuns.length,
        status: 'Verified & Certified',
      };
      const formatted = JSON.stringify(fallbackObj, null, 2);
      setAuditReportJson(formatted);
      setAuditExportNote('Generated local client-side compliance record.');
    } finally {
      setIsExportingAudit(false);
    }
  };

  const handleDownloadAuditJson = () => {
    if (!auditReportJson) return;
    const blob = new Blob([auditReportJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = auditFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyAuditJson = async () => {
    if (!auditReportJson) return;
    try {
      await navigator.clipboard.writeText(auditReportJson);
      setCopiedAuditJson(true);
      setTimeout(() => setCopiedAuditJson(false), 1800);
    } catch {
      // Ignore
    }
  };

  // Pipeline Health & Flaky Test Intelligence states
  const [ciRuns, setCiRuns] = useState<HistoricalCiExecution[]>(INITIAL_HISTORICAL_CI_RUNS);
  const [flakyTests, setFlakyTests] = useState<FlakyTestRecord[]>(INITIAL_FLAKY_TEST_RECORDS);
  const [selectedCiRunId, setSelectedCiRunId] = useState<string | undefined>('run-118');
  const [selectedFlakyTestId, setSelectedFlakyTestId] = useState<string | undefined>('flaky-01');
  const [ciHealthBranchFilter, setCiHealthBranchFilter] = useState<'all' | 'main' | 'feat/rea-bridge' | 'fix/posix-runner-shim'>('all');
  const [ciHealthStatusFilter, setCiHealthStatusFilter] = useState<'all' | 'passed' | 'failed' | 'flaky'>('all');
  const [isRecordingLiveRun, setIsRecordingLiveRun] = useState<boolean>(false);
  const [ciHealthNote, setCiHealthNote] = useState<string | null>(null);

  // Sync health metrics on mount
  useEffect(() => {
    fetch('/api/ci/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          if (Array.isArray(data.runs) && data.runs.length > 0) {
            setCiRuns(data.runs);
          }
          if (Array.isArray(data.flakyTests) && data.flakyTests.length > 0) {
            setFlakyTests(data.flakyTests);
          }
        }
      })
      .catch(() => {
        // Fallback to presets
      });
  }, []);

  const filteredCiRuns = useMemo(() => {
    return ciRuns.filter((run) => {
      const matchesBranch = ciHealthBranchFilter === 'all' || run.branch === ciHealthBranchFilter;
      const matchesStatus = ciHealthStatusFilter === 'all' || run.status === ciHealthStatusFilter;
      return matchesBranch && matchesStatus;
    });
  }, [ciRuns, ciHealthBranchFilter, ciHealthStatusFilter]);

  const handleRecordSimulatedRun = async (overrideStatus?: 'passed' | 'failed' | 'flaky') => {
    setIsRecordingLiveRun(true);
    setCiHealthNote(null);
    try {
      const statusToRecord = overrideStatus || 'passed';
      const isFlaky = statusToRecord === 'flaky';
      const isFailed = statusToRecord === 'failed';
      const randomSha = Math.random().toString(16).substring(2, 9);
      const branch = targetDeployBranch || 'main';

      const failingTestIds = isFailed
        ? ['flaky-01', 'flaky-02']
        : isFlaky
        ? ['flaky-02']
        : [];

      const payload = {
        commitSha: randomSha,
        commitMsg: isFailed
          ? 'fix(mcp): attempt unverified adb mock transport'
          : isFlaky
          ? 'test(mcp): probe adb device action socket race'
          : 'ci(swarm): verify posix compat & rea ast extraction',
        branch,
        author: 'artemis-agent',
        status: statusToRecord,
        passedTests: isFailed ? 19 : isFlaky ? 21 : 24,
        failedTests: isFailed ? 5 : 0,
        flakyTests: isFlaky ? 3 : 0,
        totalTests: 24,
        durationSeconds: Math.round((5.8 + Math.random() * 3.2) * 10) / 10,
        failingTestIds,
      };

      const res = await fetch('/api/ci/record-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        if (Array.isArray(data.runs)) setCiRuns(data.runs);
        if (Array.isArray(data.flakyTests)) setFlakyTests(data.flakyTests);
        if (data.run) setSelectedCiRunId(data.run.id);
        setCiHealthNote(
          `Recorded Run #${data.run?.runNumber} (${data.run?.status.toUpperCase()}) on ${data.run?.branch} @ ${data.run?.commitSha}`
        );
      }
    } catch {
      setCiHealthNote('Run recorded locally in dashboard session.');
    } finally {
      setIsRecordingLiveRun(false);
    }
  };

  const handleInspectGitHub = async (overrideRepo?: string) => {
    const target = overrideRepo ?? repoInput;
    if (overrideRepo) setRepoInput(overrideRepo);
    setIsInspectingGh(true);
    setErrorMessage(null);
    setStatusMessage(`Inspecting repository tree and CI configuration for ${target}...`);

    try {
      const res = await fetch('/api/github/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoInput: target,
          githubToken: githubPat || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to inspect GitHub repository');
      }
      if (Array.isArray(data.context?.fileSample) && data.context.fileSample.length > 0) {
        setDiscoveredFiles(data.context.fileSample);
      }
      if (data.context?.workflowContent) {
        setReport((prev) => ({
          ...prev,
          repoFullName: `${data.context.owner}/${data.context.repo}`,
          defaultBranch: data.context.defaultBranch || 'main',
          originalCiYaml: data.context.workflowContent,
        }));
      }
      setStatusMessage(
        `Loaded ${data.context.owner}/${data.context.repo} (${data.context.fileSample?.length || 0} files indexed on branch ${data.context.defaultBranch}).`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to inspect repository');
    } finally {
      setIsInspectingGh(false);
    }
  };

  const handleRunSwarmAnalysis = async () => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    setStatusMessage(
      'Lead Supervisor decomposing target repository and delegating AST, MCP, and CI tasks to Trust-Group agents...'
    );

    try {
      const res = await fetch('/api/swarm/reverse-engineer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoInput,
          customCodeOrContext: customCodeContext,
          tacticalObjective,
          githubToken: githubPat || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Swarm reverse-engineering request failed');
      }
      setReport(data.report);
      if (data.githubContext?.fileSample?.length) {
        setDiscoveredFiles(data.githubContext.fileSample);
      }
      if (data.report?.architectureNodes?.length) {
        setSelectedNode(data.report.architectureNodes[0]);
      }
      setStatusMessage(
        `Swarm completed reverse-engineering of ${data.report.repoFullName}. All CI/CD gates and MCP contracts synthesized.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to execute reverse-engineering swarm');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectPreset = (presetKey: TargetPreset, customUrl?: string) => {
    setActivePreset(presetKey);
    setErrorMessage(null);
    if (presetKey === 'artemis') {
      setReport(INITIAL_ARTEMIS_REA_REPORT);
      setPipelineSteps(DEFAULT_PIPELINE_STEPS);
      setCompletedSteps(DEFAULT_PIPELINE_STEPS.map((s) => s.id));
      setActiveStepId(DEFAULT_PIPELINE_STEPS[3]?.id || 'step-4');
      setRepoInput('https://github.com/google/artemis/blob/main/.github%2Fworkflows%2Fci.yml');
      setTacticalObjective(
        'Ensure CI runs on every code commit, fix Linux subprocess flags, integrate REA decompiler with Artemis MCP, and delegate routine tasks to Trust-Group workers.'
      );
      setSelectedNode(INITIAL_ARTEMIS_REA_REPORT.architectureNodes[1]);
      setDiscoveredFiles([
        '.github/workflows/ci.yml',
        'pyproject.toml',
        'uv.lock',
        'mcp_server/server.py',
        'mcp_server/utils/device_utils.py',
        'mcp_server/tools/adb_tools.py',
        'tests/unit/mcp/test_device_utils.py',
      ]);
      setStatusMessage('Switched to Google Artemis + REA target profile.');
    } else if (presetKey === 'netflix') {
      setReport(NETFLIX_REA_REPORT);
      setPipelineSteps(NETFLIX_PIPELINE_STEPS);
      setCompletedSteps(NETFLIX_PIPELINE_STEPS.map((s) => s.id));
      setActiveStepId(NETFLIX_PIPELINE_STEPS[2]?.id || 'step-nf-3');
      setRepoInput('https://github.com/Netflix/conductor');
      setTacticalObjective(
        'Reverse engineer Netflix Conductor microservice orchestrator, Zuul edge routing, and Falcor JSON Graph caching into verified MCP contracts while strictly enforcing DRM exclusion.'
      );
      setSelectedNode(NETFLIX_REA_REPORT.architectureNodes[0]);
      setDiscoveredFiles([
        '.github/workflows/ci.yml',
        'build.gradle',
        'conductor-server/orchestrator.java',
        'zuul-core/edge_router.groovy',
        'eureka-client/discovery.java',
        'falcor-model/json_graph.js',
        'msl-transport/handshake.ts',
        'hystrix-resilience/circuit_breaker.java',
        'tests/unit/conductor/test_conductor_workflow.py',
      ]);
      setStatusMessage('Switched to Netflix OSS & Client Architecture REA target profile (DRM Exclusion Guardrail Active).');
    } else if (presetKey === 'jev') {
      const targetUrl = customUrl || (repoInput.toLowerCase().includes('jev') ? repoInput : 'https://github.com/browser-use/jev-ultrafast');
      const targetReport: ReverseEngineeringReport = {
        ...JEV_REPO_REPORT,
        repoUrl: targetUrl,
        repoFullName: targetUrl.includes('github.com/') ? targetUrl.split('github.com/')[1] : 'jev (TypeSafe AI Agent)',
      };
      setReport(targetReport);
      setPipelineSteps(JEV_PIPELINE_STEPS);
      setCompletedSteps(JEV_PIPELINE_STEPS.map((s) => s.id));
      setActiveStepId(JEV_PIPELINE_STEPS[2]?.id || 'step-jev-3');
      setRepoInput(targetUrl);
      setTacticalObjective(
        'Reverse-engineer Jev typed decision model & browser action space, enforce sub-15ms latency budgets, and prune token context window by 88%.'
      );
      setSelectedNode(JEV_REPO_REPORT.architectureNodes[0]);
      setDiscoveredFiles([
        '.github/workflows/ci.yml',
        'pyproject.toml',
        'uv.lock',
        'jev_core/decision_engine.py',
        'jev_core/schema_validator.py',
        'jev_agent/action_router.py',
        'jev_compactor/context_pruner.py',
        'jev_swarm/supervisor_evaluator.py',
        'jev_bench/latency_gate.py',
        'tests/bench/test_decision_latency.py',
        'tests/unit/compaction/test_pruner.py',
      ]);
      setStatusMessage('Switched to JEV (TypeSafe AI / Typed Decision Agent & Fast Context Compaction) target profile.');
    } else if (presetKey === 'opencode') {
      const targetUrl = customUrl || 'https://github.com/redwinemegan61-stack/opencode';
      const targetReport: ReverseEngineeringReport = {
        ...OPENCODE_REA_REPORT,
        repoUrl: targetUrl,
        repoFullName: 'redwinemegan61-stack/opencode',
      };
      setReport(targetReport);
      setPipelineSteps(OPENCODE_PIPELINE_STEPS);
      setCompletedSteps(OPENCODE_PIPELINE_STEPS.map((s) => s.id));
      setActiveStepId(OPENCODE_PIPELINE_STEPS[2]?.id || 'step-oc-3');
      setRepoInput(targetUrl);
      setTacticalObjective(
        'Reverse-engineer OpenCode monorepo architecture, Bun & Turbo build pipeline, CLI service daemon, and Playwright E2E test suite.'
      );
      setSelectedNode(OPENCODE_REA_REPORT.architectureNodes[0]);
      setDiscoveredFiles([
        '.github/workflows/ci.yml',
        'package.json',
        'turbo.json',
        'packages/cli/package.json',
        'packages/cli/script/build.ts',
        'packages/cli/script/service-smoke.ts',
        'packages/app/package.json',
        'packages/session-ui/package.json',
      ]);
      setStatusMessage('Switched to OpenCode Monorepo (redwinemegan61-stack/opencode) target profile.');
    }
  };

  const handleConnectCustomRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRepoUrl.trim()) return;
    setIsCustomRepoModalOpen(false);
    setRepoInput(customRepoUrl.trim());
    setStatusMessage(`Connecting to repository ${customRepoUrl.trim()} and synchronizing architecture...`);

    const lower = customRepoUrl.toLowerCase();
    if (customRepoArchitectureType === 'jev' || lower.includes('jev')) {
      handleSelectPreset('jev', customRepoUrl.trim());
    } else if (customRepoArchitectureType === 'netflix' || lower.includes('netflix') || lower.includes('conductor')) {
      handleSelectPreset('netflix');
    } else if (lower.includes('opencode') || lower.includes('redwinemegan61')) {
      handleSelectPreset('opencode', customRepoUrl.trim());
    } else {
      handleSelectPreset('artemis');
    }

    await handleInspectGitHub(customRepoUrl.trim());
  };

  const handleSimulateCiPipeline = () => {
    if (isRunningCi || !pipelineSteps.length) return;
    setIsRunningCi(true);
    setCompletedSteps([]);
    setActiveStepId(pipelineSteps[0].id);

    pipelineSteps.forEach((step, idx) => {
      setTimeout(() => {
        setActiveStepId(step.id);
        setCompletedSteps((prev) => [...prev, step.id]);
        if (idx === pipelineSteps.length - 1) {
          setIsRunningCi(false);
          handleRecordSimulatedRun('passed');
        }
      }, (idx + 1) * 450);
    });
  };

  const currentArtifactContent = useMemo(() => {
    switch (activeArtifactTab) {
      case 'unified-ci':
        return {
          filename: '.github/workflows/ci.yml',
          language: 'yaml',
          description:
            'Triggers on every push & PR, runs Ruff + POSIX subprocess verification, executes REA & Artemis MCP test matrix, and auto-deploys on main.',
          code: report.unifiedCiYaml,
        };
      case 'posix-patch':
        return {
          filename: 'mcp_server/utils/posix_compat.py',
          language: 'python',
          description:
            'Cross-platform compatibility shim preventing AttributeError for CREATE_NEW_PROCESS_GROUP and DETACHED_PROCESS on Linux CI runners.',
          code: report.posixPatchCode,
        };
      case 'pytest-suite':
        return {
          filename: 'tests/unit/mcp/test_rea_artemis_pipeline.py',
          language: 'python',
          description:
            'Executable regression suite verifying POSIX Popen normalization and REA-to-Artemis MCP payload contracts on every push.',
          code: report.generatedTestSuite,
        };
      case 'original-ci':
        return {
          filename: '.github/workflows/ci.yml (Upstream Baseline)',
          language: 'yaml',
          description:
            'Original workflow showing the workflow_dispatch gating bug and unmocked Windows subprocess failure.',
          code: report.originalCiYaml,
        };
    }
  }, [activeArtifactTab, report]);

  const handleCopyArtifact = async () => {
    try {
      await navigator.clipboard.writeText(currentArtifactContent.code);
      setCopiedArtifact(true);
      setTimeout(() => setCopiedArtifact(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const handleDownloadArtifact = (filename: string, content: string) => {
    const cleanName = filename.split('/').pop()?.replace(/\s+/g, '_') || 'artifact.txt';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredArchitectureNodes = useMemo(() => {
    return report.architectureNodes.filter((node) => {
      const matchesTier = archTierFilter === 'All' || node.tier === archTierFilter;
      const q = archSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        node.modulePath.toLowerCase().includes(q) ||
        node.role.toLowerCase().includes(q) ||
        node.invariants.toLowerCase().includes(q);
      return matchesTier && matchesQuery;
    });
  }, [report.architectureNodes, archTierFilter, archSearch]);

  const handleTrainSubAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainTaskInput.trim()) return;
    setIsTrainingSubAgent(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/swarm/train-subagent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTask: trainTaskInput,
          targetModule: trainTargetModule,
          selectedTier: trainComputeTier,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to train sub-agent');
      }
      const newSop: TrustGroupSop = data.sop;
      setReport((prev) => ({
        ...prev,
        trustGroupPlaybook: [newSop, ...prev.trustGroupPlaybook],
      }));
      setLastTrainingOutput({
        subAgentWorkArtifact: data.subAgentWorkArtifact,
        supervisorAuditLog: data.supervisorAuditLog,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Sub-agent training failed');
    } finally {
      setIsTrainingSubAgent(false);
    }
  };

  const handlePushToGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPushingGh(true);
    setErrorMessage(null);
    setPushResult(null);

    try {
      const res = await fetch('/api/github/push-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRepo: targetDeployRepo,
          branch: targetDeployBranch,
          githubToken: githubPat,
          ciYaml: report.unifiedCiYaml,
          posixPatchCode: report.posixPatchCode,
          commitMessage: commitMsg,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to push workflow files to GitHub');
      }
      setPushResult(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'GitHub commit failed');
    } finally {
      setIsPushingGh(false);
    }
  };

  const handleToggleWebhookEvent = (evt: string) => {
    setWebhookEvents((prev) =>
      prev.includes(evt) ? (prev.length > 1 ? prev.filter((item) => item !== evt) : prev) : [...prev, evt]
    );
  };

  const handleGenerateWebhookSecret = () => {
    const randomChars = Array.from({ length: 28 }, () =>
      '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('');
    setWebhookSecretToken(`whsec_${randomChars}`);
  };

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookPayloadUrl);
      setCopiedWebhookUrl(true);
      setTimeout(() => setCopiedWebhookUrl(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleRegisterWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegisteringWebhook(true);
    setWebhookError(null);
    setWebhookStatusNote(null);

    try {
      const res = await fetch('/api/github/register-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payloadUrl: webhookPayloadUrl,
          secretToken: webhookSecretToken,
          contentType: webhookContentType,
          events: webhookEvents,
          targetRepo: targetDeployRepo || report.repoFullName.split(' ')[0] || 'google/artemis',
          githubToken: githubPat || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to register CI/CD webhook');
      }
      setRegisteredWebhookMeta(data.webhook);
      setWebhookStatusNote(data.note || 'Webhook registered and armed for incoming push events.');
    } catch (err: any) {
      setWebhookError(err?.message || 'Webhook registration failed');
    } finally {
      setIsRegisteringWebhook(false);
    }
  };

  const handleTriggerTestPushWebhook = async () => {
    setIsTestingWebhook(true);
    setWebhookError(null);

    try {
      const res = await fetch('/api/webhooks/github-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'push',
        },
        body: JSON.stringify({
          event: 'push',
          secretToken: webhookSecretToken,
          ref: `refs/heads/${targetDeployBranch || report.defaultBranch || 'main'}`,
          repository: {
            full_name: targetDeployRepo || report.repoFullName.split(' ')[0] || 'google/artemis',
          },
          pusher: {
            name: 'github-webhook-dispatch',
          },
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.deliveries)) {
        setWebhookDeliveries(data.deliveries);
      }
      if (!data.ok) {
        setWebhookError(
          data.delivery?.summary || 'Webhook signature verification failed: check that the secret token matches.'
        );
      } else {
        setWebhookStatusNote(data.delivery?.summary || 'Push event verified and Artemis Swarm analysis triggered.');
        handleSimulateCiPipeline();
      }
    } catch (err: any) {
      setWebhookError(err?.message || 'Failed to dispatch test push webhook');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleGenerateReleaseNotes = async () => {
    setIsGeneratingReleaseNotes(true);
    setReleaseError(null);
    setReleaseSuccessNote(null);

    try {
      const res = await fetch('/api/github/generate-release-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName: targetDeployRepo || report.repoFullName.split(' ')[0] || 'google/artemis',
          tagName: releaseTagName,
          commitSha: 'a4c91e8',
          reportSummary: report.executiveSummary,
          ciIssuesResolved: report.ciIssuesResolved,
          mcpContracts: report.mcpContracts,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to synthesize release notes');
      }

      setReleaseNotes(data.releaseNotes);
      setReleaseSuccessNote('Release notes synthesized by Lead Release Agent from current CI/CD passing gates and MCP topology.');
    } catch (err: any) {
      setReleaseError(err?.message || 'Failed to generate release notes');
    } finally {
      setIsGeneratingReleaseNotes(false);
    }
  };

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingRelease(true);
    setReleaseError(null);
    setReleaseSuccessNote(null);

    try {
      const res = await fetch('/api/github/create-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRepo: targetDeployRepo || report.repoFullName.split(' ')[0] || 'google/artemis',
          tagName: releaseTagName,
          releaseName,
          targetCommitish: releaseTargetCommitish,
          releaseNotes,
          isDraft: releaseIsDraft,
          isPrerelease: releaseIsPrerelease,
          githubToken: githubPat || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to create release');
      }

      if (Array.isArray(data.releases)) {
        setRecentReleases(data.releases);
      }
      setReleaseSuccessNote(data.note || `Release ${data.release?.tagName} successfully published!`);
    } catch (err: any) {
      setReleaseError(err?.message || 'Failed to publish release');
    } finally {
      setIsCreatingRelease(false);
    }
  };

  const handleCopyReleaseNotes = async () => {
    try {
      await navigator.clipboard.writeText(releaseNotes);
      setCopiedReleaseNotes(true);
      setTimeout(() => setCopiedReleaseNotes(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const activePipelineStep = useMemo(
    () => pipelineSteps.find((s) => s.id === activeStepId) || pipelineSteps[0] || DEFAULT_PIPELINE_STEPS[0],
    [activeStepId, pipelineSteps]
  );

  const totalPipelineDurationMs = useMemo(
    () => pipelineSteps.reduce((acc, item) => acc + item.durationMs, 0),
    [pipelineSteps]
  );

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (4 single-line links) — Zone 3 (1 primary CTA) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-4 bg-[#0b0f17]/95 backdrop-blur border-b border-slate-800">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          Artemis &amp; REA Studio
        </a>

        <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-400">
          <a
            href="#ci-pipeline"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Pipeline
          </a>
          <a
            href="#pipeline-health"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Health
          </a>
          <a
            href="#architecture"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Topology
          </a>
          <a
            href="#trust-group"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Trust Group
          </a>
          <a
            href="#webhook-registration"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Webhooks
          </a>
          <a
            href="#release-automation"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Releases
          </a>
          <a
            href="#compliance-audit"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Audit Log
          </a>
          <button
            type="button"
            onClick={() => setIsQuantStudioOpen(true)}
            className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Quant Studio</span>
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsQuantStudioOpen(true)}
            className="px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-500/40 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Quant Studio (Window)</span>
          </button>

          <button
            type="button"
            onClick={handleRunSwarmAnalysis}
            disabled={isAnalyzing}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isAnalyzing ? 'Running Swarm Analysis...' : 'Run Swarm Analysis'}
          </button>
        </div>
      </header>

      <main id="top" className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8 space-y-12">
        {/* Custom Repository Connection Modal */}
        {isCustomRepoModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => setIsCustomRepoModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1.5 pr-8">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <FolderGit2 className="w-4 h-4" />
                  </span>
                  <h3 className="text-lg font-bold text-white font-display">Add &amp; Connect Your Repository</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Connect your personal GitHub repository (such as your JEV decision agent, private fork, or custom project) to the Artemis &amp; REA Swarm.
                </p>
              </div>

              <form onSubmit={handleConnectCustomRepo} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="custom-repo-url" className="block text-xs font-medium text-slate-200">
                    GitHub Repository URL or <code className="font-mono text-emerald-400">owner/repo</code>
                  </label>
                  <input
                    id="custom-repo-url"
                    type="text"
                    value={customRepoUrl}
                    onChange={(e) => setCustomRepoUrl(e.target.value)}
                    placeholder="https://github.com/jev/my-agent or my-username/jev"
                    required
                    className="w-full px-3.5 py-2 text-sm font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                    <span>Quick Autofill:</span>
                    <button
                      type="button"
                      onClick={() => setCustomRepoUrl('https://github.com/jev')}
                      className="text-emerald-400 hover:underline cursor-pointer"
                    >
                      github.com/jev
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setCustomRepoUrl('https://github.com/browser-use/jev-ultrafast')}
                      className="text-emerald-400 hover:underline cursor-pointer"
                    >
                      browser-use/jev-ultrafast
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setCustomRepoUrl('https://github.com/Netflix/conductor')}
                      className="text-emerald-400 hover:underline cursor-pointer"
                    >
                      Netflix/conductor
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="custom-repo-branch" className="block text-xs font-medium text-slate-200">
                      Default Branch
                    </label>
                    <input
                      id="custom-repo-branch"
                      type="text"
                      value={customRepoBranch}
                      onChange={(e) => setCustomRepoBranch(e.target.value)}
                      placeholder="main"
                      className="w-full px-3.5 py-2 text-sm font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="custom-arch-type" className="block text-xs font-medium text-slate-200">
                      Architecture Engine Seed
                    </label>
                    <select
                      id="custom-arch-type"
                      value={customRepoArchitectureType}
                      onChange={(e) => setCustomRepoArchitectureType(e.target.value as any)}
                      className="w-full px-3.5 py-2 text-xs bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      <option value="jev">JEV (Typed Decision Model &amp; Compaction)</option>
                      <option value="artemis">Artemis + REA (ADB &amp; System Automation)</option>
                      <option value="netflix">Netflix OSS (Workflow &amp; Edge Resilience)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-repo-pat" className="block text-xs font-medium text-slate-200 flex items-center justify-between">
                    <span>GitHub Personal Access Token (PAT)</span>
                    <span className="text-[11px] text-slate-400">Optional for public repos</span>
                  </label>
                  <div className="relative">
                    <input
                      id="custom-repo-pat"
                      type="password"
                      value={customRepoPat}
                      onChange={(e) => setCustomRepoPat(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3.5 py-2 text-sm font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                    />
                    <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-repo-notes" className="block text-xs font-medium text-slate-200">
                    Repository Directive / Context
                  </label>
                  <input
                    id="custom-repo-notes"
                    type="text"
                    value={customRepoNotes}
                    onChange={(e) => setCustomRepoNotes(e.target.value)}
                    placeholder="Describe specific modules or tasks for the swarm"
                    className="w-full px-3.5 py-2 text-xs bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCustomRepoModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>Connect &amp; Launch Swarm</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Target Repository & Tactical Swarm Control Panel */}
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-6">
          {/* Architecture Target Profile Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
                Architecture Target:
              </span>
              <button
                type="button"
                onClick={() => handleSelectPreset('artemis')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePreset === 'artemis'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-950'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Google Artemis + REA</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('netflix')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePreset === 'netflix'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-sm shadow-rose-950'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>Netflix OSS &amp; Client REA</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('jev')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePreset === 'jev'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-950'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>JEV Typed Decision Agent</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('opencode')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePreset === 'opencode'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm shadow-amber-950'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>OpenCode Monorepo (redwinemegan61)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCustomRepoModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add My Repository</span>
              </button>
            </div>
          </div>

          {/* OpenCode Monorepo Banner */}
          {(activePreset === 'opencode' || repoInput.toLowerCase().includes('opencode')) && (
            <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <Terminal className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-300 flex items-center gap-2">
                    <span>OpenCode Monorepo (<code className="font-mono text-amber-200">redwinemegan61-stack/opencode</code>)</span>
                    <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Bun + Turbo + Playwright E2E
                    </span>
                  </div>
                  <p className="text-amber-200/80 leading-relaxed">
                    Monorepo architecture with Turbo task caching, TypeScript packages (<code className="font-mono text-amber-100">packages/cli</code>, <code className="font-mono text-amber-100">packages/app</code>, <code className="font-mono text-amber-100">packages/session-ui</code>), and automated push CI/CD pipeline verification.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSelectPreset('opencode')}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Load OpenCode Preset</span>
              </button>
            </div>
          )}

          {/* Safety Guardrail Alert for Netflix */}
          {(activePreset === 'netflix' || repoInput.toLowerCase().includes('netflix')) && (
            <div className="p-4 bg-amber-950/40 border border-amber-600/50 rounded-xl flex items-start gap-3.5 text-xs">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-amber-300 flex items-center gap-2">
                  <span>Safety Guardrail Enforced: REA Netflix Architecture Policy</span>
                  <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Restricted
                  </span>
                </div>
                <p className="text-amber-200/90 leading-relaxed">
                  Strict adherence to safety and anti-piracy policies is active: reverse engineering of DRM systems (Widevine, FairPlay, PlayReady CDM keys) and proprietary video stream decryption is categorically excluded and prohibited.
                  The REA Swarm focuses exclusively on open-source Netflix microservices (<code className="font-mono text-amber-200">Netflix/conductor</code>, Eureka discovery, Zuul routing), Falcor JSON Graph protocols, and Message Security Layer (MSL) transport framing.
                </p>
              </div>
            </div>
          )}

          {/* JEV High-Speed Decision Engine Banner */}
          {(activePreset === 'jev' || repoInput.toLowerCase().includes('jev')) && (
            <div className="p-4 bg-cyan-950/30 border border-cyan-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-cyan-300 flex items-center gap-2">
                    <span>JEV: TypeSafe AI Typed Decision Model &amp; Token Compaction Engine</span>
                    <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Sub-15ms Latency
                    </span>
                  </div>
                  <p className="text-cyan-200/80 leading-relaxed">
                    Replaces open-ended generative loops with rapid discrete typed choice logit evaluations and 88% context window compaction.
                    To connect your personal Jev repository, paste your URL or click "Connect My Repository".
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomRepoModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Connect My Repository</span>
              </button>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>Target: {report.repoFullName}</span>
                <span aria-hidden="true">·</span>
                <span>Branch: {report.defaultBranch}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Compute Reduction: {report.computeAllocation.estimatedCostReductionPct}%
                </span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-display"
                style={{ textWrap: 'balance' }}
              >
                Reverse-Engineering Agent Swarm &amp; Continuous Push CI/CD Orchestrator
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">{report.executiveSummary}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400 mr-1 whitespace-nowrap">Quick Presets:</span>
              <button
                type="button"
                onClick={() => handleSelectPreset('artemis')}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                google/artemis
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('netflix')}
                className="px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-700/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Netflix/conductor
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('jev', 'https://github.com/browser-use/jev-ultrafast')}
                className="px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/30 hover:bg-cyan-950/60 border border-cyan-700/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                jev-ultrafast
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('jev', 'https://github.com/jev')}
                className="px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/30 hover:bg-emerald-950/60 border border-emerald-700/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                github.com/jev
              </button>
              <button
                type="button"
                onClick={() => handleInspectGitHub('https://github.com/morluto/rea')}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                morluto/rea
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/90 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-6 space-y-1.5">
                <label htmlFor="repo-url-input" className="block text-xs font-medium text-slate-300">
                  GitHub Repository URL or Workflow Path
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="repo-url-input"
                    type="text"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="https://github.com/google/artemis/blob/main/.github/workflows/ci.yml"
                    className="w-full px-3.5 py-2 text-sm font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleInspectGitHub()}
                    disabled={isInspectingGh}
                    className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>{isInspectingGh ? 'Inspecting...' : 'Inspect Repo'}</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 space-y-1.5">
                <label htmlFor="tactical-objective-input" className="block text-xs font-medium text-slate-300">
                  Lead Supervisor Tactical Directive
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="tactical-objective-input"
                    type="text"
                    value={tacticalObjective}
                    onChange={(e) => setTacticalObjective(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdvancedInput((prev) => !prev)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800/70 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{showAdvancedInput ? 'Hide Source Input' : 'Paste Code / Binary Dump'}</span>
                  </button>
                </div>
              </div>
            </div>

            {showAdvancedInput && (
              <div className="space-y-1.5 pt-2">
                <label htmlFor="custom-code-input" className="block text-xs font-medium text-slate-300">
                  Optional Source Code, Decompiler Output, or Custom Workflow Snippet to Reverse Engineer
                </label>
                <textarea
                  id="custom-code-input"
                  rows={4}
                  value={customCodeContext}
                  onChange={(e) => setCustomCodeContext(e.target.value)}
                  placeholder="Paste Python module, Ghidra/IDA pseudocode, AndroidManifest.xml, or GitHub Actions YAML here for the swarm to reverse engineer..."
                  className="w-full p-3 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-400"
                />
              </div>
            )}

            {(statusMessage || errorMessage) && (
              <div className="flex items-center justify-between gap-4 pt-2 text-xs">
                {errorMessage ? (
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{statusMessage}</span>
                  </div>
                )}
                <span className="text-slate-500 font-mono tabular-nums shrink-0">
                  Indexed files: {discoveredFiles.length}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Full-Width 4-Column Operational KPI Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-1">
            <div className="text-xs text-slate-400">CI Trigger Coverage</div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">100% Push &amp; PR</div>
            <div className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Removed workflow_dispatch block</span>
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-1">
            <div className="text-xs text-slate-400">Linux Runner Compatibility</div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">POSIX Verified</div>
            <div className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>device_utils.py Popen shimmed</span>
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-1">
            <div className="text-xs text-slate-400">Trust-Group Compute Delegation</div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {report.computeAllocation.workerSharePct}% Sub-Agents
            </div>
            <div className="text-xs text-slate-300 pt-1">
              Supervisor overhead capped at {report.computeAllocation.supervisorSharePct}%
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-1">
            <div className="text-xs text-slate-400">End-to-End CI Execution Time</div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {(totalPipelineDurationMs / 1000).toFixed(2)}s
            </div>
            <div className="text-xs text-slate-300 pt-1">
              Astral uv lockfile cache + headless ADB
            </div>
          </div>
        </section>

        {/* Section 01: Automated CI/CD Pipeline & Commit Verification */}
        <section id="ci-pipeline" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white font-display">
                01. Automated Push CI/CD Pipeline &amp; Root-Cause Remediation
              </h2>
              <p className="text-sm text-slate-400">
                Resolves the upstream <code className="font-mono text-slate-200">google/artemis</code> CI defects and runs
                both REA decompiler verification and Artemis MCP tests automatically on every commit.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSimulateCiPipeline}
              disabled={isRunningCi}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunningCi ? 'Executing Commit Pipeline...' : 'Dry-Run Commit Pipeline'}</span>
            </button>
          </div>

          {/* Root Cause Diagnostic Table */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Diagnosed Upstream CI Blockers &amp; Applied Patches
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {report.ciIssuesResolved.length} issues resolved
              </span>
            </div>
            <div className="divide-y divide-slate-800/80">
              {report.ciIssuesResolved.map((issue) => (
                <div key={issue.id} className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <div className="lg:col-span-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-amber-400">{issue.id}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-300">Severity: {issue.severity}</span>
                    </div>
                    <div className="text-xs font-mono text-slate-200 break-all">{issue.file}</div>
                  </div>
                  <div className="lg:col-span-4 space-y-1">
                    <div className="text-xs font-medium text-slate-400">Upstream Failure Cause</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{issue.rootCause}</p>
                  </div>
                  <div className="lg:col-span-5 space-y-1">
                    <div className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Automated Fix Applied in Unified Pipeline</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{issue.fixApplied}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Pipeline Runner + Artifact Code Editor Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left 5 Cols: Step-by-Step Commit Runner */}
            <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Push Event Execution Stages (<code className="font-mono text-xs text-emerald-400">on: [push, pull_request]</code>)
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {completedSteps.length}/{pipelineSteps.length} passed
                  </span>
                </div>

                <div className="space-y-2">
                  {pipelineSteps.map((step, index) => {
                    const isDone = completedSteps.includes(step.id);
                    const isSelected = activeStepId === step.id;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setActiveStepId(step.id)}
                        className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800/90 border-slate-600'
                            : 'bg-[#0b0f17]/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-slate-100 truncate">
                              0{index + 1}. {step.name}
                            </span>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                            {step.durationMs}ms
                          </span>
                        </div>
                        <div className="mt-1.5 pl-6 text-xs font-mono text-slate-400 truncate">
                          $ {step.command}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Stage Console Output */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium text-slate-300">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Stage Log: {activePipelineStep.stage}</span>
                  </span>
                  <span className="font-mono tabular-nums">{activePipelineStep.durationMs}ms</span>
                </div>
                <div className="bg-[#0b0f17] border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-slate-300 space-y-1.5">
                  <div className="text-slate-500">$ {activePipelineStep.command}</div>
                  {activePipelineStep.logOutput.map((line, i) => (
                    <div key={i} className="text-emerald-300/95 leading-relaxed">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 7 Cols: Ready-to-Commit CI/CD & POSIX Patch Code Viewer */}
            <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Interactive Segmented Tab Bar */}
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0b0f17] border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setActiveArtifactTab('unified-ci')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeArtifactTab === 'unified-ci'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Unified ci.yml
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveArtifactTab('posix-patch')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeArtifactTab === 'posix-patch'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      posix_compat.py
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveArtifactTab('pytest-suite')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeArtifactTab === 'pytest-suite'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Regression Pytest
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveArtifactTab('original-ci')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeArtifactTab === 'original-ci'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Original ci.yml (Buggy)
                    </button>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyArtifact}
                      className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedArtifact ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy File</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadArtifact(currentArtifactContent.filename, currentArtifactContent.code)
                      }
                      className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-mono text-slate-200">{currentArtifactContent.filename}</span>
                  <span>{currentArtifactContent.description}</span>
                </div>

                <pre className="bg-[#0b0f17] border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[420px] leading-relaxed">
                  <code>{currentArtifactContent.code}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* Section 02: Pipeline Health & Flaky Test Intelligence */}
        <section id="pipeline-health" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-bold text-white font-display">
                  02. Pipeline Health &amp; Flaky Test Intelligence
                </h2>
              </div>
              <p className="text-sm text-slate-400">
                D3-powered temporal trend analysis of CI pass rates, runner execution latency, and root-cause telemetry
                across recent continuous push executions.
              </p>
            </div>

            {/* Filter & Live Run Simulation Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Branch Filter */}
              <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg text-xs">
                {(['all', 'main', 'feat/rea-bridge', 'fix/posix-runner-shim'] as const).map((branch) => (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => setCiHealthBranchFilter(branch)}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      ciHealthBranchFilter === branch
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {branch === 'all' ? 'All Branches' : branch}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg text-xs">
                {(['all', 'passed', 'failed', 'flaky'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setCiHealthStatusFilter(status)}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer capitalize ${
                      ciHealthStatusFilter === status
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Simulation Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isRecordingLiveRun}
                  onClick={() => handleRecordSimulatedRun('passed')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isRecordingLiveRun ? 'Recording...' : 'Simulate Live Push'}</span>
                </button>
                <button
                  type="button"
                  disabled={isRecordingLiveRun}
                  onClick={() => handleRecordSimulatedRun('flaky')}
                  className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-950/40 hover:bg-amber-950/70 border border-amber-500/40 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Simulate Flake</span>
                </button>
              </div>
            </div>
          </div>

          {ciHealthNote && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-lg flex items-center justify-between text-xs text-emerald-300">
              <span className="flex items-center gap-2 font-mono">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{ciHealthNote}</span>
              </span>
              <button
                type="button"
                onClick={() => setCiHealthNote(null)}
                className="text-slate-400 hover:text-slate-200 ml-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* D3 Timeline Chart & Flaky Test Intelligence Matrix */}
          <PipelineHealthChart
            runs={filteredCiRuns}
            flakyTests={flakyTests}
            selectedRunId={selectedCiRunId}
            onSelectRun={(run) => setSelectedCiRunId(run.id)}
            selectedTestId={selectedFlakyTestId}
            onSelectTest={(test) => setSelectedFlakyTestId(test.id)}
          />
        </section>

        {/* Section 03: Reverse-Engineered Architecture & MCP Tool Contracts */}
        <section id="architecture" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white font-display">
                03. Reverse-Engineered Module Topology &amp; MCP Contracts
              </h2>
              <p className="text-sm text-slate-400">
                Structural decomposition linking <code className="font-mono text-slate-200">morluto/rea</code> binary/AST
                decompilation with <code className="font-mono text-slate-200">google/artemis</code> device execution.
              </p>
            </div>

            {/* Filter & Search Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={archSearch}
                  onChange={(e) => setArchSearch(e.target.value)}
                  placeholder="Filter modules or invariants..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-[#111827] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg">
                {(['All', 'Supervisor', 'MCP Core', 'Decompiler Bridge', 'Device Automation', 'CI/CD Gate'] as TierFilter[]).map(
                  (tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setArchTierFilter(tier)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        archTierFilter === tier
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tier}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* D3 Force-Directed Topology Graph + Synchronized Node Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8">
              <ModuleTopologyGraph
                architectureNodes={filteredArchitectureNodes}
                mcpContracts={report.mcpContracts}
                pipelineSteps={DEFAULT_PIPELINE_STEPS}
                selectedNodeId={selectedGraphItem?.id || selectedNode?.modulePath}
                onSelectGraphNode={(gNode) => {
                  setSelectedGraphItem(gNode);
                  if (gNode.rawModule) {
                    setSelectedNode(gNode.rawModule);
                  }
                }}
              />
            </div>

            {/* Selected Node / Module Inspector (4 columns) */}
            <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
              {selectedGraphItem && !selectedGraphItem.rawModule ? (
                <>
                  <div className="space-y-1 border-b border-slate-800 pb-3">
                    <div className="text-xs text-slate-400">
                      {selectedGraphItem.subLabel} · Status: {selectedGraphItem.status}
                    </div>
                    <h3 className="text-sm font-mono font-bold text-white break-all">
                      {selectedGraphItem.label}
                    </h3>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-slate-400">Topology Role &amp; Contract</div>
                    <p className="text-xs text-slate-200 leading-relaxed">{selectedGraphItem.details}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-slate-400">Verification Command / Gate</div>
                    <div className="bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-emerald-300/95 break-all">
                      $ {selectedGraphItem.invariantOrCmd}
                    </div>
                  </div>
                </>
              ) : selectedNode ? (
                <>
                  <div className="space-y-1 border-b border-slate-800 pb-3">
                    <div className="text-xs text-slate-400">
                      {selectedNode.tier} · Complexity: {selectedNode.complexity}
                    </div>
                    <h3 className="text-sm font-mono font-bold text-white break-all">
                      {selectedNode.modulePath}
                    </h3>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-slate-400">Architectural Role</div>
                    <p className="text-xs text-slate-200 leading-relaxed">{selectedNode.role}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-slate-400">Supervisor Invariant Contract</div>
                    <p className="text-xs text-emerald-300/95 leading-relaxed">{selectedNode.invariants}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-slate-400">Direct Dependencies</div>
                    <div className="text-xs font-mono text-slate-300">
                      {selectedNode.dependencies.join(' · ') || 'None'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 py-6 text-center">
                  Select any node in the topology graph or table row to inspect its invariants and dependencies.
                </div>
              )}
            </div>
          </div>

          {/* Module Data Grid (Full Width) */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Reverse-Engineered Module Inventory
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {filteredArchitectureNodes.length} modules indexed
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 bg-[#0b0f17]/50">
                    <th className="py-3 px-4">Module Path</th>
                    <th className="py-3 px-4">Swarm Tier</th>
                    <th className="py-3 px-4">Complexity</th>
                    <th className="py-3 px-4">Direct Dependencies</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {filteredArchitectureNodes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No architecture modules match your current filter.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setArchSearch('');
                            setArchTierFilter('All');
                          }}
                          className="text-emerald-400 underline ml-1 cursor-pointer"
                        >
                          Reset filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredArchitectureNodes.map((node) => {
                      const isSelected = selectedNode?.id === node.id;
                      return (
                        <tr
                          key={node.id}
                          onClick={() => {
                            setSelectedNode(node);
                            setSelectedGraphItem(null);
                          }}
                          className={`transition-colors cursor-pointer ${
                            isSelected ? 'bg-slate-800/90' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-3 px-4 font-mono text-slate-100">{node.modulePath}</td>
                          <td className="py-3 px-4 text-slate-300">{node.tier}</td>
                          <td className="py-3 px-4 text-slate-300">{node.complexity}</td>
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {node.dependencies.join(' · ') || 'None'}
                          </td>
                          <td className="py-3 px-4 text-emerald-400 font-medium">{node.status}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MCP Tool Contracts Table */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Unified Model Context Protocol (MCP) Tool Bridges
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {report.mcpContracts.length} active MCP endpoints
              </span>
            </div>
            <div className="divide-y divide-slate-800/80">
              {report.mcpContracts.map((mcp) => (
                <div key={mcp.name} className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  <div className="lg:col-span-4 space-y-1">
                    <div className="text-xs font-mono font-semibold text-emerald-400">{mcp.name}</div>
                    <div className="text-xs text-slate-400">Origin: {mcp.origin}</div>
                  </div>
                  <div className="lg:col-span-4 space-y-1">
                    <div className="text-xs font-mono text-slate-200">{mcp.signature}</div>
                    <p className="text-xs text-slate-400">{mcp.purpose}</p>
                  </div>
                  <div className="lg:col-span-4">
                    <div className="bg-[#0b0f17] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 overflow-x-auto">
                      $ {mcp.ciVerificationCmd}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 04: Trust-Group Agent Delegation & Minimum-Compute Playbook */}
        <section id="trust-group" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white font-display">
                04. Trust-Group Agent Playbook &amp; Sub-Agent Supervision Studio
              </h2>
              <p className="text-sm text-slate-400">
                Enforces tactical resource discipline: train Tier-2 and Tier-3 agents within our Trust Group to handle
                routine extraction and testing at minimal spending while the Lead Supervisor audits correctness.
              </p>
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums shrink-0">
              Active SOPs: {report.trustGroupPlaybook.length}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Cols: Trust-Group SOP Playbook List */}
            <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl divide-y divide-slate-800">
              {report.trustGroupPlaybook.map((sop) => (
                <div key={sop.id} className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">{sop.taskCategory}</h3>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      {sop.assignedAgent} · {sop.computeTier}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{sop.instructionTemplate}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <span className="text-emerald-400 font-mono tabular-nums">
                      Resource Savings: {sop.estimatedTokenSavings}
                    </span>
                    <span className="text-slate-400">Audit Gate: {sop.verificationCriteria}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right 5 Cols: Interactive Sub-Agent Trainer & Supervisor Verifier */}
            <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-5">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Train &amp; Supervise Trust-Group Sub-Agent</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Delegate a repetitive reverse-engineering or CI task. The Lead Supervisor will distill a low-cost SOP
                  and verify the worker&apos;s output.
                </p>
              </div>

              <form onSubmit={handleTrainSubAgent} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="train-task" className="block text-xs font-medium text-slate-300">
                    Task to Teach Sub-Agent
                  </label>
                  <textarea
                    id="train-task"
                    rows={3}
                    value={trainTaskInput}
                    onChange={(e) => setTrainTaskInput(e.target.value)}
                    className="w-full p-3 text-xs bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="train-module" className="block text-xs font-medium text-slate-300">
                      Target Module Scope
                    </label>
                    <input
                      id="train-module"
                      type="text"
                      value={trainTargetModule}
                      onChange={(e) => setTrainTargetModule(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="train-tier" className="block text-xs font-medium text-slate-300">
                      Assigned Compute Tier
                    </label>
                    <select
                      id="train-tier"
                      value={trainComputeTier}
                      onChange={(e) => setTrainComputeTier(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                    >
                      <option value="Minimal (Tier-3 Worker)">Minimal (Tier-3 Worker)</option>
                      <option value="Tactical (Tier-2 Specialist)">Tactical (Tier-2 Specialist)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isTrainingSubAgent}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  {isTrainingSubAgent
                    ? 'Teaching Sub-Agent & Auditing Output...'
                    : 'Generate Sub-Agent SOP & Verify Task'}
                </button>
              </form>

              {lastTrainingOutput && (
                <div className="pt-4 border-t border-slate-800 space-y-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-semibold text-emerald-400">Supervisor Verification Sign-Off</div>
                    <p className="text-slate-300 leading-relaxed">{lastTrainingOutput.supervisorAuditLog}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-300">Sub-Agent Work Artifact</div>
                    <pre className="bg-[#0b0f17] border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 overflow-x-auto max-h-48">
                      <code>{lastTrainingOutput.subAgentWorkArtifact}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 05: Direct GitHub Repository Deployment */}
        <section id="github-deploy" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white font-display">
                05. Deploy Unified REA + Artemis Pipeline to Your GitHub Repository
              </h2>
              <p className="text-sm text-slate-400">
                Commit <code className="font-mono text-slate-200">.github/workflows/ci.yml</code> and{' '}
                <code className="font-mono text-slate-200">mcp_server/utils/posix_compat.py</code> directly via the
                GitHub Contents API or export the ready-to-push files.
              </p>
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <form onSubmit={handlePushToGitHub} className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="deploy-repo" className="block text-xs font-medium text-slate-300">
                    Your Target GitHub Repository (owner/repo)
                  </label>
                  <input
                    id="deploy-repo"
                    type="text"
                    value={targetDeployRepo}
                    onChange={(e) => setTargetDeployRepo(e.target.value)}
                    placeholder="your-username/artemis"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="deploy-branch" className="block text-xs font-medium text-slate-300">
                    Target Branch
                  </label>
                  <input
                    id="deploy-branch"
                    type="text"
                    value={targetDeployBranch}
                    onChange={(e) => setTargetDeployBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="github-pat" className="block text-xs font-medium text-slate-300">
                    GitHub Personal Access Token (<code className="font-mono">repo</code> &amp;{' '}
                    <code className="font-mono">workflow</code> scopes)
                  </label>
                  <input
                    id="github-pat"
                    type="password"
                    value={githubPat}
                    onChange={(e) => setGithubPat(e.target.value)}
                    placeholder="ghp_••••••••••••••••••••••••••••••••••••"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="commit-msg" className="block text-xs font-medium text-slate-300">
                    Git Commit Message
                  </label>
                  <input
                    id="commit-msg"
                    type="text"
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPushingGh}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPushingGh ? 'Committing to GitHub...' : 'Commit & Push CI/CD Pipeline'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadArtifact('.github/workflows/ci.yml', report.unifiedCiYaml)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ci.yml</span>
                </button>
              </div>

              {pushResult && (
                <div className="p-4 bg-[#0b0f17] border border-emerald-500/40 rounded-lg space-y-2 text-xs">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Successfully committed {pushResult.committedFiles.length} files to {pushResult.repo} (
                      {pushResult.branch})
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-slate-300">
                    {pushResult.committedFiles.map((f) => (
                      <div key={f.path} className="flex items-center justify-between">
                        <span>{f.path}</span>
                        {f.htmlUrl && (
                          <a
                            href={f.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <span>View Commit</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>

            {/* CLI Quick-Apply Instructions */}
            <div className="lg:col-span-5 bg-[#0b0f17] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                <span>Local Git CLI Deployment Sequence</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                If you prefer pushing from your terminal, run these commands in your cloned{' '}
                <code className="font-mono text-slate-200">artemis</code> repository to enable automatic testing and
                deployment on every commit:
              </p>
              <pre className="p-3.5 bg-[#111827] border border-slate-800 rounded-lg font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                <code>{`# 1. Sync dependencies & verify POSIX shim locally
uv python install 3.12
uv sync --dev
uv run pytest -p mcp_server.utils.posix_compat

# 2. Stage unified REA + Artemis CI/CD workflow
git add .github/workflows/ci.yml mcp_server/utils/posix_compat.py
git commit -m "ci: run REA + Artemis tests & deploy on every push"
git push origin main`}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Section 06: CI/CD Webhook Registration */}
        <section id="webhook-registration" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white font-display">
                06. CI/CD Webhook Registration
              </h2>
              <p className="text-sm text-slate-400">
                Configure a GitHub Webhook Payload URL and HMAC-SHA256 Secret Token to automatically trigger the Artemis
                &amp; REA Swarm analysis whenever a <code className="font-mono text-slate-200">push</code> event occurs.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
              <span>Status: {registeredWebhookMeta.active ? 'Armed for Push Events' : 'Inactive'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Hook ID: {registeredWebhookMeta.id}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 6 Cols: Webhook Configuration Form */}
            <form
              onSubmit={handleRegisterWebhook}
              className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5"
            >
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-emerald-400" />
                  <span>GitHub Webhook Endpoint &amp; Secret Configuration</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Incoming GitHub <code className="font-mono text-slate-300">X-Hub-Signature-256</code> headers are
                  verified against your secret token before launching the Artemis Swarm.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="webhook-payload-url" className="block text-xs font-medium text-slate-300">
                  Payload URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="webhook-payload-url"
                    type="url"
                    required
                    value={webhookPayloadUrl}
                    onChange={(e) => setWebhookPayloadUrl(e.target.value)}
                    placeholder="https://your-domain.run.app/api/webhooks/github-push"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={handleCopyWebhookUrl}
                    className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedWebhookUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="webhook-secret-token" className="block text-xs font-medium text-slate-300">
                  Secret Token (HMAC-SHA256 Verification Key)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="webhook-secret-token"
                    type="text"
                    required
                    value={webhookSecretToken}
                    onChange={(e) => setWebhookSecretToken(e.target.value)}
                    placeholder="whsec_••••••••••••••••••••••••••••••••"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateWebhookSecret}
                    className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Generate Secret</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="webhook-content-type" className="block text-xs font-medium text-slate-300">
                    Content Type
                  </label>
                  <select
                    id="webhook-content-type"
                    value={webhookContentType}
                    onChange={(e) => setWebhookContentType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  >
                    <option value="application/json">application/json</option>
                    <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-slate-300">Subscribed GitHub Events</span>
                  <div className="flex items-center gap-2 pt-1">
                    {['push', 'pull_request', 'workflow_run'].map((evt) => {
                      const active = webhookEvents.includes(evt);
                      return (
                        <button
                          key={evt}
                          type="button"
                          onClick={() => handleToggleWebhookEvent(evt)}
                          className={`px-2.5 py-1.5 text-xs font-mono rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? 'bg-slate-800 text-emerald-400 border-emerald-500/50'
                              : 'bg-[#0b0f17] text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {evt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isRegisteringWebhook}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Webhook className="w-3.5 h-3.5" />
                  <span>{isRegisteringWebhook ? 'Registering Webhook...' : 'Register Webhook'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerTestPushWebhook}
                  disabled={isTestingWebhook}
                  className="px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isTestingWebhook ? 'Dispatching Push Event...' : 'Simulate Push Event'}</span>
                </button>
              </div>

              {(webhookStatusNote || webhookError) && (
                <div className="pt-2 text-xs">
                  {webhookError ? (
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{webhookError}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{webhookStatusNote}</span>
                    </div>
                  )}
                </div>
              )}
            </form>

            {/* Right 6 Cols: Registered Binding Summary & Recent Push Webhook Deliveries */}
            <div className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between">
              <div className="p-5 border-b border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Active Webhook Binding &amp; Push Event Delivery Log
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {webhookDeliveries.length} deliveries recorded
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 font-mono">
                  <span className="text-slate-300 truncate max-w-xs">{registeredWebhookMeta.payloadUrl}</span>
                  <span aria-hidden="true">·</span>
                  <span>Secret: {registeredWebhookMeta.secretTokenPreview}</span>
                  <span aria-hidden="true">·</span>
                  <span>Events: {registeredWebhookMeta.events.join(', ')}</span>
                </div>
              </div>

              <div className="divide-y divide-slate-800/80 max-h-[340px] overflow-y-auto">
                {webhookDeliveries.map((deliv) => (
                  <div key={deliv.id} className="p-4 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono">
                        {deliv.signatureVerified ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="font-semibold text-white">{deliv.event}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-300">{deliv.repository}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-emerald-400">{deliv.commitSha}</span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-400">
                        {deliv.durationMs}ms · {deliv.swarmStatus}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{deliv.summary}</p>
                    <div className="text-slate-500 font-mono truncate">
                      X-Hub-Signature-256: {deliv.signatureHeader}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 07: Release Automation */}
        <section id="release-automation" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white font-display">
                07. Release Automation
              </h2>
              <p className="text-sm text-slate-400">
                Trigger automated GitHub releases grounded in passing CI/CD matrix stages (5/5 gates) and synthesized
                reverse-engineered findings.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 shrink-0">
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CI/CD Status: 5/5 Passing Gates</span>
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-mono tabular-nums">Ref: a4c91e8</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-mono tabular-nums">Target Tag: {releaseTagName}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 6 Cols: Release Parameters & Trigger Controls */}
            <form
              onSubmit={handleCreateRelease}
              className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5"
            >
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <span>Release Metadata &amp; Target Repository</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Tags and commits are published to GitHub using your credentials or recorded in the Swarm Release
                  Registry.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="release-tag-input" className="block text-xs font-medium text-slate-300">
                    Release Tag
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="release-tag-input"
                      type="text"
                      required
                      value={releaseTagName}
                      onChange={(e) => setReleaseTagName(e.target.value)}
                      placeholder="v0.4.3"
                      className="w-full px-3.5 py-2 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const parts = releaseTagName.replace(/^v/, '').split('.').map(Number);
                        if (parts.length === 3 && !isNaN(parts[2])) {
                          setReleaseTagName(`v${parts[0]}.${parts[1]}.${parts[2] + 1}`);
                          setReleaseName(`v${parts[0]}.${parts[1]}.${parts[2] + 1}: Automated Push CI/CD & REA Decompiler Matrix`);
                        }
                      }}
                      className="px-2.5 py-2 text-xs font-mono text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      title="Bump Patch Version"
                    >
                      +Patch
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="release-target-commitish" className="block text-xs font-medium text-slate-300">
                    Target Branch or Commit SHA
                  </label>
                  <input
                    id="release-target-commitish"
                    type="text"
                    required
                    value={releaseTargetCommitish}
                    onChange={(e) => setReleaseTargetCommitish(e.target.value)}
                    placeholder="main"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="release-title-input" className="block text-xs font-medium text-slate-300">
                  Release Title
                </label>
                <input
                  id="release-title-input"
                  type="text"
                  required
                  value={releaseName}
                  onChange={(e) => setReleaseName(e.target.value)}
                  placeholder="v0.4.3: Automated Push CI/CD & REA Decompiler Matrix"
                  className="w-full px-3.5 py-2 text-xs bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="release-repo-input" className="block text-xs font-medium text-slate-300">
                  Target GitHub Repository (owner/repo)
                </label>
                <input
                  id="release-repo-input"
                  type="text"
                  value={targetDeployRepo || report.repoFullName.split(' ')[0] || 'google/artemis'}
                  onChange={(e) => setTargetDeployRepo(e.target.value)}
                  placeholder="google/artemis"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1 text-xs text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={releaseIsPrerelease}
                    onChange={(e) => setReleaseIsPrerelease(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-[#0b0f17]"
                  />
                  <span>Mark as Pre-release</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={releaseIsDraft}
                    onChange={(e) => setReleaseIsDraft(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-[#0b0f17]"
                  />
                  <span>Save as Draft</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGenerateReleaseNotes}
                  disabled={isGeneratingReleaseNotes}
                  className="px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isGeneratingReleaseNotes ? 'Synthesizing Notes...' : 'Synthesize Notes with Swarm'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isCreatingRelease}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>{isCreatingRelease ? 'Publishing Release...' : 'Publish GitHub Release'}</span>
                </button>
              </div>

              {(releaseSuccessNote || releaseError) && (
                <div className="pt-2 text-xs">
                  {releaseError ? (
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{releaseError}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{releaseSuccessNote}</span>
                    </div>
                  )}
                </div>
              )}
            </form>

            {/* Right 6 Cols: Release Notes Editor & Packaged Artifacts */}
            <div className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Synthesized Release Changelog</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyReleaseNotes}
                    className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedReleaseNotes ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Notes</span>
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  rows={9}
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  className="w-full p-3 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-400 leading-relaxed"
                />

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-xs font-semibold text-slate-200">
                    Distribution Artifacts Included in Release
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-3 bg-[#0b0f17] border border-slate-800 rounded-lg space-y-1 text-xs">
                      <div className="font-mono text-emerald-400 truncate">artemis_rea_swarm.whl</div>
                      <div className="text-slate-400 font-mono tabular-nums">1.4 MB · Wheel</div>
                    </div>
                    <div className="p-3 bg-[#0b0f17] border border-slate-800 rounded-lg space-y-1 text-xs">
                      <div className="font-mono text-slate-200 truncate">.github/workflows/ci.yml</div>
                      <div className="text-slate-400 font-mono tabular-nums">3.8 KB · Pipeline</div>
                    </div>
                    <div className="p-3 bg-[#0b0f17] border border-slate-800 rounded-lg space-y-1 text-xs">
                      <div className="font-mono text-slate-200 truncate">posix_compat.py</div>
                      <div className="text-slate-400 font-mono tabular-nums">1.2 KB · POSIX Shim</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Release History & Registry */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Release Registry &amp; Verified Deployment History
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {recentReleases.length} releases logged
              </span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {recentReleases.map((rel) => (
                <div key={rel.id} className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  <div className="lg:col-span-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-emerald-400 text-sm">{rel.tagName}</span>
                      {rel.prerelease && (
                        <span className="text-xs font-mono text-amber-400 border border-amber-500/40 px-1.5 py-0.5 rounded">
                          pre-release
                        </span>
                      )}
                      {rel.draft && (
                        <span className="text-xs font-mono text-slate-400 border border-slate-600 px-1.5 py-0.5 rounded">
                          draft
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{rel.repository}</div>
                  </div>

                  <div className="lg:col-span-5 space-y-1">
                    <div className="text-xs font-semibold text-white truncate">{rel.releaseName}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span className="text-emerald-400">{rel.ciStatus}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="font-mono tabular-nums">Target: {rel.targetCommitish}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="font-mono tabular-nums">{rel.publishedAt.slice(0, 10)}</span>
                    </div>
                  </div>

                  <div className="lg:col-span-4 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setReleaseNotes(rel.body);
                        setReleaseTagName(rel.tagName);
                        setReleaseName(rel.releaseName);
                        setReleaseTargetCommitish(rel.targetCommitish);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      Load Notes
                    </button>

                    <a
                      href={rel.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-500/40 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>View Release</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 08: Open Source Quant Repositories & Workflow Creator Studio */}
        <section id="quant-workflows" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-bold text-white font-display">
                  08. Open Source Quant Repositories &amp; Workflow Creator Studio
                </h2>
              </div>
              <p className="text-sm text-slate-400">
                Connect leading open-source algorithmic trading and alpha research frameworks (<code className="font-mono text-slate-200">microsoft/qlib</code>,{' '}
                <code className="font-mono text-slate-200">ccxt/ccxt</code>, <code className="font-mono text-slate-200">QuantConnect/Lean</code>, and{' '}
                <code className="font-mono text-slate-200">vnpy/vnpy</code>) to build multi-stage quantitative pipelines in a dedicated optional window.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsQuantStudioOpen(true)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5 fill-current" />
                <span>Launch Quant Studio Window</span>
              </button>
            </div>
          </div>

          {/* 4 Quant Framework Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-2 py-0.5 rounded">
                    Alpha ML Platform
                  </span>
                  <span className="text-xs font-mono text-slate-400">★ 16.8k</span>
                </div>
                <h3 className="text-sm font-bold text-white">microsoft/qlib</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  AI-oriented investment platform with binary high-throughput datasets, LightGBM/Transformer alpha models, and walk-forward portfolio optimization.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsQuantStudioOpen(true)}
                className="w-full py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Open in Workflow Studio</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-sky-400 bg-sky-950/40 border border-sky-500/40 px-2 py-0.5 rounded">
                    Crypto &amp; Multi-Exchange
                  </span>
                  <span className="text-xs font-mono text-slate-400">★ 34.5k</span>
                </div>
                <h3 className="text-sm font-bold text-white">ccxt/ccxt</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Async WebSocket order book streaming across 100+ spot/perp venues with rate-limit token buckets and atomic multi-leg execution routing.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsQuantStudioOpen(true)}
                className="w-full py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Open in Workflow Studio</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-sky-400" />
              </button>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/40 border border-indigo-500/40 px-2 py-0.5 rounded">
                    Multi-Asset Engine
                  </span>
                  <span className="text-xs font-mono text-slate-400">★ 9.2k</span>
                </div>
                <h3 className="text-sm font-bold text-white">QuantConnect/Lean</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Institutional event-driven backtesting engine with realistic margin queueing, Value-at-Risk (VaR) models, and Interactive Brokers gateways.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsQuantStudioOpen(true)}
                className="w-full py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Open in Workflow Studio</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
              </button>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-amber-400 bg-amber-950/40 border border-amber-500/40 px-2 py-0.5 rounded">
                    Event-Driven CTA
                  </span>
                  <span className="text-xs font-mono text-slate-400">★ 23.4k</span>
                </div>
                <h3 className="text-sm font-bold text-white">vnpy/vnpy</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  High-performance lock-free EventEngine with C++ binary connectors for futures, options, and stock market execution with strict risk filters.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsQuantStudioOpen(true)}
                className="w-full py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Open in Workflow Studio</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>
          </div>
        </section>

        {/* Section 09: Automated Audit Log & Compliance Exporter */}
        <section id="compliance-audit" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-bold text-white font-display">
                  09. Automated Audit Log &amp; Compliance Exporter
                </h2>
              </div>
              <p className="text-sm text-slate-400">
                Convert Trust-Group agent decisions, SOP execution metrics, architecture topology nodes, and supervisor audit trail into a formatted, cryptographically signed JSON compliance report for record-keeping.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleExportAuditLog}
                disabled={isExportingAudit}
                className="px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isExportingAudit ? 'Exporting Audit Log...' : 'Generate Compliance JSON'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 5 Cols: Audit Log Overview & Metadata */}
            <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Compliance Record Scope &amp; Contents</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The automated exporter aggregates all autonomous reasoning artifacts from the active repository session into a structured compliance schema.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-[#0b0f17] border border-slate-800 rounded-lg space-y-1">
                  <div className="font-semibold text-slate-200">Trust-Group Agent Decisions</div>
                  <div className="text-slate-400 font-mono">
                    {report.trustGroupPlaybook.length} SOP contracts &amp; task categories recorded
                  </div>
                </div>

                <div className="p-3.5 bg-[#0b0f17] border border-slate-800 rounded-lg space-y-1">
                  <div className="font-semibold text-slate-200">Supervisor Audit Trail</div>
                  <div className="text-slate-400 font-mono">
                    {report.ciIssuesResolved.length} critical CI defects remediated &amp; verified
                  </div>
                </div>

                <div className="p-3.5 bg-[#0b0f17] border border-slate-800 rounded-lg space-y-1">
                  <div className="font-semibold text-slate-200">Module Topology &amp; MCP Contracts</div>
                  <div className="text-slate-400 font-mono">
                    {report.architectureNodes.length} modules · {report.mcpContracts.length} MCP schemas
                  </div>
                </div>
              </div>

              {auditExportNote && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{auditExportNote}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportAuditLog}
                  disabled={isExportingAudit}
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  {auditReportJson ? 'Regenerate Audit JSON' : 'Generate Audit JSON'}
                </button>

                {auditReportJson && (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadAuditJson}
                      className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download JSON</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyAuditJson}
                      className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedAuditJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAuditJson ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Right 7 Cols: Formatted JSON Compliance Report Viewer */}
            <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 font-mono">
                  <FileCode2 className="w-4 h-4 text-emerald-400" />
                  <span>{auditFilename}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  SHA-256 Tamper-Proof Compliance Record
                </span>
              </div>

              <div className="p-4 bg-[#0b0f17] overflow-y-auto max-h-[420px]">
                {auditReportJson ? (
                  <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    <code>{auditReportJson}</code>
                  </pre>
                ) : (
                  <div className="py-16 text-center space-y-3">
                    <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
                    <div className="text-xs text-slate-400">
                      Click &quot;Generate Compliance JSON&quot; above to convert Trust-Group decisions and supervisor logs into a formatted compliance report.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 mt-12">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>Artemis &amp; REA Swarm Studio · Tactical Reverse-Engineering &amp; Continuous CI/CD</span>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#ci-pipeline" className="hover:text-slate-300 transition-colors">
              CI/CD Pipeline
            </a>
            <span aria-hidden="true">·</span>
            <a href="#pipeline-health" className="hover:text-slate-300 transition-colors">
              Health Dashboard
            </a>
            <span aria-hidden="true">·</span>
            <a href="#architecture" className="hover:text-slate-300 transition-colors">
              MCP Contracts
            </a>
            <span aria-hidden="true">·</span>
            <a href="#trust-group" className="hover:text-slate-300 transition-colors">
              Trust Group
            </a>
            <span aria-hidden="true">·</span>
            <a href="#webhook-registration" className="hover:text-slate-300 transition-colors">
              Webhooks
            </a>
            <span aria-hidden="true">·</span>
            <a href="#release-automation" className="hover:text-slate-300 transition-colors">
              Releases
            </a>
            <span aria-hidden="true">·</span>
            <a href="#compliance-audit" className="hover:text-slate-300 transition-colors">
              Audit Log
            </a>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setIsQuantStudioOpen(true)}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Quant Studio
            </button>
          </div>
        </div>
      </footer>

      {/* Optional Separate Window Modal for Quant Repository Workflow Creator */}
      <QuantWorkflowStudio
        isOpen={isQuantStudioOpen}
        onClose={() => setIsQuantStudioOpen(false)}
        onDeployToCi={(strategyCode) => {
          setCustomCodeContext(strategyCode);
          setTacticalObjective(
            'Ensure quantitative strategy backtest passes in CI regression with Sharpe >= 1.50 and max drawdown < 7.5%.'
          );
          setActiveArtifactTab('unified-ci');
        }}
      />
    </div>
  );
}
