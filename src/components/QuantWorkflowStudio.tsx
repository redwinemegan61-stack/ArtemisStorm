import React, { useState, useMemo } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  TrendingUp,
  GitBranch,
  Layers,
  Play,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Download,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  Settings2,
  ShieldCheck,
  Workflow,
  Cpu,
  BarChart3,
  RefreshCw,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  QuantRepository,
  QuantWorkflowTemplate,
  QuantWorkflowNode,
  INITIAL_QUANT_REPOSITORIES,
  INITIAL_QUANT_TEMPLATES,
} from '../data/presets';

interface QuantWorkflowStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployToCi?: (strategyCode: string, ciYaml: string) => void;
}

export default function QuantWorkflowStudio({
  isOpen,
  onClose,
  onDeployToCi,
}: QuantWorkflowStudioProps) {
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [repositories] = useState<QuantRepository[]>(INITIAL_QUANT_REPOSITORIES);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('quant-qlib');
  const [customRepoInput, setCustomRepoInput] = useState<string>('');

  // Workflow builder states
  const [templates] = useState<QuantWorkflowTemplate[]>(INITIAL_QUANT_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('wf-qlib-alpha-ml');
  const [activeTab, setActiveTab] = useState<'canvas' | 'code' | 'ci-workflow' | 'metrics'>('canvas');

  // Active workflow nodes state
  const [workflowNodes, setWorkflowNodes] = useState<QuantWorkflowNode[]>(() => {
    return INITIAL_QUANT_TEMPLATES[0].nodes;
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string>(INITIAL_QUANT_TEMPLATES[0].nodes[0].id);

  // Simulation execution state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationCompleted, setSimulationCompleted] = useState<boolean>(true);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([
    '[INIT] Connecting to Quant binary data cache and symbol universe...',
    '[FEATURE] Evaluated 158 normalized cross-sectional alpha factors across 500 assets.',
    '[TRAIN] LightGBM model converged in 1.42s (MSE loss: 0.00318).',
    '[RISK] Max drawdown stop verified at 7.5% ceiling; sector-neutral weights applied.',
    '[CI-GATE] Backtest Sharpe Ratio: 2.14 >= threshold (1.50) — PASS',
  ]);

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedCiYaml, setCopiedCiYaml] = useState<boolean>(false);
  const [deployFeedback, setDeployFeedback] = useState<string | null>(null);

  const selectedRepo = useMemo(() => {
    return repositories.find((r) => r.id === selectedRepoId) || repositories[0];
  }, [repositories, selectedRepoId]);

  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  const selectedNode = useMemo(() => {
    return workflowNodes.find((n) => n.id === selectedNodeId) || workflowNodes[0];
  }, [workflowNodes, selectedNodeId]);

  if (!isOpen) return null;

  const handleSelectTemplate = (template: QuantWorkflowTemplate) => {
    setSelectedTemplateId(template.id);
    setSelectedRepoId(template.repoId);
    setWorkflowNodes(template.nodes);
    if (template.nodes.length > 0) {
      setSelectedNodeId(template.nodes[0].id);
    }
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimulationCompleted(false);
    setSimulationLogs(['[START] Initializing workflow execution pipeline...']);

    const steps = [
      `[INGEST] Connected to ${selectedRepo.name} data provider (${workflowNodes[0]?.title || 'Raw Feed'})`,
      `[ALPHA] Computing factor matrices across ${activeTemplate.targetAssetClass} (${activeTemplate.timeframe} resolution)`,
      `[RISK] Auditing pre-trade circuit breakers and leverage limits...`,
      `[BACKTEST] Simulating 18-month execution walk with slippage & fee model`,
      `[CI-CHECK] Verified strategy regression gates against main branch`,
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setSimulationLogs((prev) => [...prev, step]);
        if (idx === steps.length - 1) {
          setIsSimulating(false);
          setSimulationCompleted(true);
        }
      }, (idx + 1) * 350);
    });
  };

  const handleCopyCode = async (code: string, type: 'code' | 'ci') => {
    try {
      await navigator.clipboard.writeText(code);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 1800);
      } else {
        setCopiedCiYaml(true);
        setTimeout(() => setCopiedCiYaml(false), 1800);
      }
    } catch {
      // Ignore
    }
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddCustomNode = () => {
    const nextIdx = workflowNodes.length + 1;
    const newNode: QuantWorkflowNode = {
      id: `node-custom-${Date.now()}`,
      type: 'risk_rules',
      title: `Custom Circuit Breaker ${nextIdx}`,
      description: 'Dynamic volatility-triggered position scale down filter.',
      stageBadge: `Stage ${nextIdx}: Custom`,
      parameters: { threshold_pct: 2.5, auto_liquidate: false },
    };
    setWorkflowNodes([...workflowNodes, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const handleDeleteNode = (id: string) => {
    if (workflowNodes.length <= 1) return;
    const filtered = workflowNodes.filter((n) => n.id !== id);
    setWorkflowNodes(filtered);
    if (selectedNodeId === id && filtered.length > 0) {
      setSelectedNodeId(filtered[0].id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`bg-[#0d121f] border border-slate-700/80 rounded-2xl flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ${
          isMaximized
            ? 'w-full h-full max-w-none'
            : 'w-full max-w-6xl max-h-[92vh] h-[850px]'
        }`}
      >
        {/* Window Top Title Bar */}
        <div className="px-5 py-3.5 bg-[#111827] border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block cursor-pointer hover:bg-rose-500" onClick={onClose} />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block cursor-pointer hover:bg-amber-500" onClick={() => setIsMaximized(!isMaximized)} />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>

            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white font-display">
                Open Source Quant Repository &amp; Workflow Creator Studio
              </h2>
            </div>

            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-2 py-0.5 rounded hidden sm:inline-block">
              Optional Window Workspace
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={isMaximized ? 'Restore Window' : 'Maximize Window'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close Window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Subheader / Quant Repository Selection Strip */}
        <div className="px-5 py-3 bg-[#0b0f17] border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
              <span>Quant Engine:</span>
            </span>

            {repositories.map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => {
                  setSelectedRepoId(repo.id);
                  const matchingTemplate = templates.find((t) => t.repoId === repo.id);
                  if (matchingTemplate) {
                    handleSelectTemplate(matchingTemplate);
                  }
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  selectedRepoId === repo.id
                    ? 'bg-slate-800 text-emerald-400 border-emerald-500/50 font-semibold shadow-sm'
                    : 'text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{repo.name}</span>
                <span className="text-[10px] font-mono text-slate-400">★ {repo.stars}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={selectedRepo.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
            >
              <span>{selectedRepo.ownerRepo}</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Main Studio Body: 2-Column or 3-Column Grid */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* Left Column (3.5 cols): Repository Inspector & Workflow Templates */}
          <div className="lg:col-span-4 bg-[#111827]/70 border-r border-slate-800/90 p-4 overflow-y-auto space-y-5">
            {/* Active Repository Card */}
            <div className="bg-[#0b0f17] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-mono text-emerald-400">{selectedRepo.category}</div>
                  <h3 className="text-sm font-bold text-white">{selectedRepo.name}</h3>
                  <div className="text-xs font-mono text-slate-400">{selectedRepo.ownerRepo} · {selectedRepo.license}</div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                  {selectedRepo.frameworkVersion}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{selectedRepo.description}</p>

              <div className="space-y-1.5 pt-1 border-t border-slate-800">
                <div className="text-[11px] font-semibold text-slate-400">Key Production Modules:</div>
                <div className="space-y-1">
                  {selectedRepo.keyModules.map((mod, i) => (
                    <div key={i} className="text-[11px] font-mono text-slate-300 bg-slate-900/80 px-2 py-1 rounded border border-slate-800 truncate">
                      {mod}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-slate-400">Core Invariant Guarantees:</div>
                <ul className="space-y-1 text-[11px] text-slate-400 list-disc list-inside">
                  {selectedRepo.highlightInvariants.map((inv, i) => (
                    <li key={i} className="leading-snug text-slate-300">{inv}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Workflow Preset Switcher */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Workflow className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Workflow Templates</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{templates.length} ready</span>
              </div>

              <div className="space-y-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      selectedTemplateId === tpl.id
                        ? 'bg-slate-800/90 border-emerald-500/60 shadow-md'
                        : 'bg-[#0b0f17] border-slate-800/90 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{tpl.title}</span>
                      <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                        {tpl.targetAssetClass} · {tpl.timeframe}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {tpl.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Quant Repo Inspector Input */}
            <div className="bg-[#0b0f17] border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Inspect Any Open-Source Quant Repo</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customRepoInput}
                  onChange={(e) => setCustomRepoInput(e.target.value)}
                  placeholder="e.g. mementum/backtrader"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#111827] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customRepoInput.trim()) {
                      alert(`Repository ${customRepoInput} loaded into Quant Workflow Studio workspace.`);
                    }
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Load
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (8.5 cols): Workflow Stage Builder, Code Generator & Simulation Panel */}
          <div className="lg:col-span-8 flex flex-col min-h-0 bg-[#0d121f]">
            {/* View Mode Tabs */}
            <div className="px-5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 bg-[#111827]/40">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('canvas')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'canvas'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Workflow className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pipeline Workflow Canvas ({workflowNodes.length} stages)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('code')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'code'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Python Strategy (strategy_pipeline.py)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ci-workflow')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'ci-workflow'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>GitHub Actions Strategy CI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('metrics')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'metrics'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Backtest Metrics</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSimulating}
                  onClick={handleRunSimulation}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isSimulating ? 'Simulating...' : 'Run Simulation'}</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Workflow Canvas View */}
            {activeTab === 'canvas' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{activeTemplate.title}</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Configured on top of <code className="font-mono text-slate-300">{selectedRepo.ownerRepo}</code> with continuous regression backtest gating.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddCustomNode}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Add Workflow Stage</span>
                    </button>
                  </div>
                </div>

                {/* Sequential Stage Flow Grid */}
                <div className="space-y-3">
                  {workflowNodes.map((node, index) => {
                    const isSelected = node.id === selectedNode.id;
                    return (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#111827] border-emerald-500/70 shadow-lg'
                            : 'bg-[#0b0f17] border-slate-800/80 hover:border-slate-700 hover:bg-[#111827]/40'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-800 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center shrink-0 border border-slate-700">
                              {index + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">{node.title}</span>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                                  {node.stageBadge}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">{node.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 sm:justify-end">
                            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                              {Object.entries(node.parameters).slice(0, 2).map(([k, v]) => (
                                <span key={k} className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                  {k}: <span className="text-emerald-400">{String(v)}</span>
                                </span>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNode(node.id);
                              }}
                              className="text-slate-400 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                              title="Delete stage"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Node Parameter Configurator */}
                {selectedNode && (
                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-emerald-400" />
                        <span>Configuring: {selectedNode.title}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{selectedNode.stageBadge}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {Object.entries(selectedNode.parameters).map(([key, val]) => (
                        <div key={key} className="space-y-1">
                          <label className="text-[11px] font-mono text-slate-400 block">{key}</label>
                          <input
                            type="text"
                            defaultValue={String(val)}
                            className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#0b0f17] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Simulation Logs Terminal */}
                <div className="bg-[#0b0f17] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Live Simulation Telemetry &amp; CI Gate Runner</span>
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400">
                      {isSimulating ? 'Executing...' : 'Ready & Idle'}
                    </span>
                  </div>

                  <div className="bg-black/60 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1 max-h-36 overflow-y-auto">
                    {simulationLogs.map((log, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-slate-400 select-none">&gt;</span>
                        <span
                          className={
                            log.includes('PASS')
                              ? 'text-emerald-400 font-bold'
                              : log.includes('ALPHA')
                              ? 'text-indigo-400'
                              : log.includes('RISK')
                              ? 'text-amber-400'
                              : 'text-slate-300'
                          }
                        >
                          {log}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Python Strategy Code */}
            {activeTab === 'code' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white font-mono">strategy_pipeline.py</span>
                    <p className="text-xs text-slate-400">
                      Ready-to-deploy quantitative strategy script built for {selectedRepo.name}.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(activeTemplate.generatedPythonStrategy, 'code')}
                      className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Strategy</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadFile('strategy_pipeline.py', activeTemplate.generatedPythonStrategy)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                <pre className="bg-[#0b0f17] border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[500px]">
                  <code>{activeTemplate.generatedPythonStrategy}</code>
                </pre>
              </div>
            )}

            {/* Tab 3: GitHub Actions CI Workflow */}
            {activeTab === 'ci-workflow' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white font-mono">.github/workflows/quant_backtest_ci.yml</span>
                    <p className="text-xs text-slate-400">
                      Continuous integration workflow ensuring quantitative backtest metrics never drift on push.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(activeTemplate.generatedCiWorkflow, 'ci')}
                      className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedCiYaml ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy CI YAML</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadFile(
                          'quant_backtest_ci.yml',
                          activeTemplate.generatedCiWorkflow
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                <pre className="bg-[#0b0f17] border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-300/95 overflow-x-auto leading-relaxed max-h-[500px]">
                  <code>{activeTemplate.generatedCiWorkflow}</code>
                </pre>
              </div>
            )}

            {/* Tab 4: Performance & Backtest Metrics */}
            {activeTab === 'metrics' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div className="space-y-1 border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white">Historical Backtest Validation &amp; Risk Metrics</h3>
                  <p className="text-xs text-slate-400">
                    Calculated over out-of-sample test window with standard transaction cost and slippage models.
                  </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
                    <span className="text-xs text-slate-400">Sharpe Ratio</span>
                    <div className="text-2xl font-bold font-mono text-emerald-400">
                      {activeTemplate.backtestMetrics.sharpeRatio}
                    </div>
                    <span className="text-[11px] text-slate-400">CI gate requires &gt;= 1.50</span>
                  </div>

                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
                    <span className="text-xs text-slate-400">Annualized Return</span>
                    <div className="text-2xl font-bold font-mono text-white">
                      +{activeTemplate.backtestMetrics.annualizedReturnPct}%
                    </div>
                    <span className="text-[11px] text-slate-400">Net of simulated fees</span>
                  </div>

                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
                    <span className="text-xs text-slate-400">Max Drawdown</span>
                    <div className="text-2xl font-bold font-mono text-amber-400">
                      {activeTemplate.backtestMetrics.maxDrawdownPct}%
                    </div>
                    <span className="text-[11px] text-slate-400">Circuit breaker capped at 7.5%</span>
                  </div>

                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
                    <span className="text-xs text-slate-400">Win Rate</span>
                    <div className="text-2xl font-bold font-mono text-sky-400">
                      {activeTemplate.backtestMetrics.winRatePct}%
                    </div>
                    <span className="text-[11px] text-slate-400">Across completed trade orders</span>
                  </div>

                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
                    <span className="text-xs text-slate-400">Total Trades</span>
                    <div className="text-2xl font-bold font-mono text-slate-200">
                      {activeTemplate.backtestMetrics.totalTrades}
                    </div>
                    <span className="text-[11px] text-slate-400">Walk-forward executed orders</span>
                  </div>

                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
                    <span className="text-xs text-slate-400">Profit Factor</span>
                    <div className="text-2xl font-bold font-mono text-emerald-400">
                      {activeTemplate.backtestMetrics.profitFactor}
                    </div>
                    <span className="text-[11px] text-slate-400">Gross profit / Gross loss</span>
                  </div>
                </div>

                <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl text-xs text-indigo-300/90 space-y-1">
                  <div className="font-semibold text-indigo-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Automated Continuous Quant Deployment</span>
                  </div>
                  <p className="leading-relaxed">
                    This workflow can be registered as an autonomous Trust-Group task. The Artemis Agent Swarm will run
                    the Pytest backtest simulation on every git push and generate release notes with performance telemetry.
                  </p>
                </div>
              </div>
            )}

            {/* Bottom Footer Action Bar */}
            <div className="px-5 py-3 border-t border-slate-800 bg-[#111827] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>
                  Engine: <strong className="text-slate-200">{selectedRepo.name}</strong> · Active Strategy:{' '}
                  <strong className="text-slate-200">{activeTemplate.title}</strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (onDeployToCi) {
                      onDeployToCi(
                        activeTemplate.generatedPythonStrategy,
                        activeTemplate.generatedCiWorkflow
                      );
                    }
                    setDeployFeedback('Loaded strategy into Artemis CI/CD deployment pipeline!');
                    setTimeout(() => setDeployFeedback(null), 3000);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Deploy to Artemis CI Pipeline</span>
                </button>
              </div>
            </div>

            {deployFeedback && (
              <div className="p-2.5 bg-emerald-950/70 border-t border-emerald-500/40 text-xs text-emerald-300 text-center font-mono">
                {deployFeedback}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
