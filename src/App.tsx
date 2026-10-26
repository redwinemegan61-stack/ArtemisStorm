import React, { useState, useMemo } from 'react';
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
  Cpu,
  FileCode2,
  Search,
  RefreshCw,
  ArrowUpRight,
  SlidersHorizontal,
  FolderGit2,
  Send,
} from 'lucide-react';
import {
  INITIAL_ARTEMIS_REA_REPORT,
  DEFAULT_PIPELINE_STEPS,
  ReverseEngineeringReport,
  ArchitectureNode,
  TrustGroupSop,
} from './data/presets';

type ArtifactTab = 'unified-ci' | 'posix-patch' | 'pytest-suite' | 'original-ci';
type TierFilter = 'All' | 'Supervisor' | 'MCP Core' | 'Decompiler Bridge' | 'Device Automation' | 'CI/CD Gate';

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

  // CI Pipeline Simulator states
  const [isRunningCi, setIsRunningCi] = useState<boolean>(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>(
    DEFAULT_PIPELINE_STEPS.map((s) => s.id)
  );
  const [activeStepId, setActiveStepId] = useState<string>('step-4');

  // Code viewer states
  const [activeArtifactTab, setActiveArtifactTab] = useState<ArtifactTab>('unified-ci');
  const [copiedArtifact, setCopiedArtifact] = useState<boolean>(false);

  // Architecture table states
  const [archSearch, setArchSearch] = useState<string>('');
  const [archTierFilter, setArchTierFilter] = useState<TierFilter>('All');
  const [selectedNode, setSelectedNode] = useState<ArchitectureNode | null>(
    INITIAL_ARTEMIS_REA_REPORT.architectureNodes[1]
  );

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

  const handleSimulateCiPipeline = () => {
    if (isRunningCi) return;
    setIsRunningCi(true);
    setCompletedSteps([]);
    setActiveStepId(DEFAULT_PIPELINE_STEPS[0].id);

    DEFAULT_PIPELINE_STEPS.forEach((step, idx) => {
      setTimeout(() => {
        setActiveStepId(step.id);
        setCompletedSteps((prev) => [...prev, step.id]);
        if (idx === DEFAULT_PIPELINE_STEPS.length - 1) {
          setIsRunningCi(false);
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

  const activePipelineStep = useMemo(
    () => DEFAULT_PIPELINE_STEPS.find((s) => s.id === activeStepId) || DEFAULT_PIPELINE_STEPS[0],
    [activeStepId]
  );

  const totalPipelineDurationMs = useMemo(
    () => DEFAULT_PIPELINE_STEPS.reduce((acc, item) => acc + item.durationMs, 0),
    []
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

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#ci-pipeline"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Pipeline &amp; CI/CD
          </a>
          <a
            href="#architecture"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Swarm Architecture
          </a>
          <a
            href="#trust-group"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Trust-Group Playbook
          </a>
          <a
            href="#github-deploy"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Deploy to GitHub
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
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
        {/* Target Repository & Tactical Swarm Control Panel */}
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-6">
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
                onClick={() =>
                  handleInspectGitHub('https://github.com/google/artemis/blob/main/.github%2Fworkflows%2Fci.yml')
                }
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                google/artemis
              </button>
              <button
                type="button"
                onClick={() => handleInspectGitHub('https://github.com/morluto/rea')}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                morluto/rea
              </button>
              <button
                type="button"
                onClick={() => handleInspectGitHub('https://github.com/astral-sh/uv')}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                astral-sh/uv
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
                    {completedSteps.length}/{DEFAULT_PIPELINE_STEPS.length} passed
                  </span>
                </div>

                <div className="space-y-2">
                  {DEFAULT_PIPELINE_STEPS.map((step, index) => {
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

        {/* Section 02: Reverse-Engineered Architecture & MCP Tool Contracts */}
        <section id="architecture" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white font-display">
                02. Reverse-Engineered Module Topology &amp; MCP Contracts
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Module Data Grid (8 columns) */}
            <div className="lg:col-span-8 bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 bg-[#0b0f17]/50">
                      <th className="py-3 px-4">Module Path</th>
                      <th className="py-3 px-4">Swarm Tier</th>
                      <th className="py-3 px-4">Complexity</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {filteredArchitectureNodes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
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
                            onClick={() => setSelectedNode(node)}
                            className={`transition-colors cursor-pointer ${
                              isSelected ? 'bg-slate-800/90' : 'hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-3 px-4 font-mono text-slate-100">{node.modulePath}</td>
                            <td className="py-3 px-4 text-slate-300">{node.tier}</td>
                            <td className="py-3 px-4 text-slate-300">{node.complexity}</td>
                            <td className="py-3 px-4 text-emerald-400 font-medium">{node.status}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Module Inspector (4 columns) */}
            <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
              {selectedNode ? (
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
                  Select any module row to inspect its reverse-engineered invariants and dependencies.
                </div>
              )}
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

        {/* Section 03: Trust-Group Agent Delegation & Minimum-Compute Playbook */}
        <section id="trust-group" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white font-display">
                03. Trust-Group Agent Playbook &amp; Sub-Agent Supervision Studio
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

        {/* Section 04: Direct GitHub Repository Deployment */}
        <section id="github-deploy" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white font-display">
                04. Deploy Unified REA + Artemis Pipeline to Your GitHub Repository
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
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 mt-12">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>Artemis &amp; REA Swarm Studio · Tactical Reverse-Engineering &amp; Continuous CI/CD</span>
          <div className="flex items-center gap-4">
            <a href="#ci-pipeline" className="hover:text-slate-300 transition-colors">
              CI/CD Pipeline
            </a>
            <span aria-hidden="true">·</span>
            <a href="#architecture" className="hover:text-slate-300 transition-colors">
              MCP Contracts
            </a>
            <span aria-hidden="true">·</span>
            <a href="#trust-group" className="hover:text-slate-300 transition-colors">
              Trust-Group Playbook
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
