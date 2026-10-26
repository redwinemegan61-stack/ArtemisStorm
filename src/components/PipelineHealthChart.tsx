import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Copy,
  Check,
  Zap,
} from 'lucide-react';
import { HistoricalCiExecution, FlakyTestRecord } from '../data/presets';

interface PipelineHealthChartProps {
  runs: HistoricalCiExecution[];
  flakyTests: FlakyTestRecord[];
  selectedRunId?: string;
  onSelectRun: (run: HistoricalCiExecution) => void;
  selectedTestId?: string;
  onSelectTest: (test: FlakyTestRecord) => void;
}

export default function PipelineHealthChart({
  runs,
  flakyTests,
  selectedRunId,
  onSelectRun,
  selectedTestId,
  onSelectTest,
}: PipelineHealthChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredRun, setHoveredRun] = useState<HistoricalCiExecution | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  // Compute summary metrics
  const totalRuns = runs.length;
  const passedRuns = runs.filter((r) => r.status === 'passed').length;
  const overallPassRate = totalRuns > 0 ? ((passedRuns / totalRuns) * 100).toFixed(1) : '100.0';

  const avgDuration =
    totalRuns > 0
      ? (runs.reduce((acc, r) => acc + r.durationSeconds, 0) / totalRuns).toFixed(1)
      : '7.1';

  const postPatchRuns = runs.filter((r) => r.remediated);
  const postPatchPassRate =
    postPatchRuns.length > 0
      ? ((postPatchRuns.filter((r) => r.status === 'passed').length / postPatchRuns.length) * 100).toFixed(1)
      : '100.0';

  const selectedTest = useMemo(() => {
    return flakyTests.find((t) => t.id === selectedTestId) || flakyTests[0];
  }, [flakyTests, selectedTestId]);

  const selectedRun = useMemo(() => {
    return runs.find((r) => r.id === selectedRunId) || runs[runs.length - 1];
  }, [runs, selectedRunId]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || runs.length === 0) return;

    const margin = { top: 32, right: 48, bottom: 44, left: 48 };
    const width = 860;
    const height = 290;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    // Defs for gradients
    const defs = svg.append('defs');

    // Pass rate area gradient
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'passrate-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.28);
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.0);

    // Duration bar gradient
    const barGradient = defs
      .append('linearGradient')
      .attr('id', 'duration-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    barGradient.append('stop').attr('offset', '0%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.35);
    barGradient.append('stop').attr('offset', '100%').attr('stop-color', '#0284c7').attr('stop-opacity', 0.08);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale: index of run
    const xScale = d3
      .scaleLinear()
      .domain([0, runs.length - 1])
      .range([0, innerWidth]);

    // Y Scale (Left): Pass Rate (50% to 105% for visual buffer)
    const yPassScale = d3.scaleLinear().domain([50, 105]).range([innerHeight, 0]);

    // Y Scale (Right): Duration Seconds (0 to max + 2)
    const maxDuration = Math.max(...runs.map((r) => r.durationSeconds), 14);
    const yDurScale = d3.scaleLinear().domain([0, maxDuration * 1.15]).range([innerHeight, 0]);

    // Horizontal Grid Lines
    const gridTicks = [60, 70, 80, 90, 100];
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(gridTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yPassScale(d))
      .attr('y2', (d) => yPassScale(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '3 3')
      .attr('stroke-width', 1);

    // Duration Bars (Secondary Metric)
    const barWidth = Math.max(6, Math.min(20, (innerWidth / runs.length) * 0.45));
    g.selectAll('.dur-bar')
      .data(runs)
      .enter()
      .append('rect')
      .attr('class', 'dur-bar')
      .attr('x', (_d, i) => xScale(i) - barWidth / 2)
      .attr('y', (d) => yDurScale(d.durationSeconds))
      .attr('width', barWidth)
      .attr('height', (d) => innerHeight - yDurScale(d.durationSeconds))
      .attr('rx', 3)
      .attr('fill', 'url(#duration-gradient)')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 0.8)
      .attr('stroke-opacity', 0.45);

    // D3 Area Generator for Pass Rate
    const areaGen = d3
      .area<HistoricalCiExecution>()
      .x((_d, i) => xScale(i))
      .y0(innerHeight)
      .y1((d) => yPassScale(d.passRatePct))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(runs)
      .attr('fill', 'url(#passrate-gradient)')
      .attr('d', areaGen);

    // D3 Line Generator for Pass Rate
    const lineGen = d3
      .line<HistoricalCiExecution>()
      .x((_d, i) => xScale(i))
      .y((d) => yPassScale(d.passRatePct))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(runs)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('d', lineGen);

    // Remediation Milestone Line (Commit a4c91e8 or first remediated run)
    const milestoneIdx = runs.findIndex((r) => r.remediated);
    if (milestoneIdx !== -1) {
      const milestoneX = xScale(milestoneIdx);
      g.append('line')
        .attr('x1', milestoneX)
        .attr('x2', milestoneX)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#a78bfa')
        .attr('stroke-dasharray', '4 4')
        .attr('stroke-width', 1.5);

      // Milestone annotation pill/badge
      const badgeGroup = g
        .append('g')
        .attr('transform', `translate(${milestoneX}, -14)`);

      badgeGroup
        .append('rect')
        .attr('x', -60)
        .attr('y', 0)
        .attr('width', 120)
        .attr('height', 20)
        .attr('rx', 4)
        .attr('fill', '#1e1b4b')
        .attr('stroke', '#818cf8')
        .attr('stroke-width', 1);

      badgeGroup
        .append('text')
        .attr('x', 0)
        .attr('y', 13)
        .attr('text-anchor', 'middle')
        .attr('fill', '#c7d2fe')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('font-family', 'monospace')
        .text('POSIX Shim Patch');
    }

    // Run Node Glyphs (Circles on line)
    const nodeGroups = g
      .selectAll('.run-node')
      .data(runs)
      .enter()
      .append('g')
      .attr('class', 'run-node')
      .attr('transform', (d, i) => `translate(${xScale(i)}, ${yPassScale(d.passRatePct)})`)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const bounds = svgEl.getBoundingClientRect();
        setHoveredRun(d);
        setTooltipPos({
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top - 12,
        });
      })
      .on('mouseleave', () => {
        setHoveredRun(null);
        setTooltipPos(null);
      })
      .on('click', (_event, d) => {
        onSelectRun(d);
      });

    // Outer glow for selected run
    nodeGroups
      .append('circle')
      .attr('r', (d) => (d.id === selectedRunId ? 9 : 6))
      .attr('fill', (d) =>
        d.id === selectedRunId
          ? '#a78bfa'
          : d.status === 'passed'
          ? '#10b981'
          : d.status === 'flaky'
          ? '#f59e0b'
          : '#ef4444'
      )
      .attr('stroke', '#0b0f17')
      .attr('stroke-width', 2);

    nodeGroups
      .append('circle')
      .attr('r', (d) => (d.id === selectedRunId ? 4 : 2.5))
      .attr('fill', '#ffffff');

    // Axes
    // X Axis Ticks
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .attr('class', 'text-slate-400 text-[10px] font-mono');

    runs.forEach((r, idx) => {
      // Show every 2nd or 3rd label if many
      if (runs.length > 15 && idx % 3 !== 0 && idx !== runs.length - 1) return;
      xAxis
        .append('text')
        .attr('x', xScale(idx))
        .attr('y', 18)
        .attr('text-anchor', 'middle')
        .attr('fill', r.id === selectedRunId ? '#a78bfa' : '#64748b')
        .attr('font-size', '10px')
        .attr('font-weight', r.id === selectedRunId ? '700' : '500')
        .text(`#${r.runNumber}`);
    });

    // Left Y Axis (Pass Rate %)
    const yAxisLeft = g.append('g').attr('class', 'text-slate-400 text-[10px] font-mono');
    gridTicks.forEach((tick) => {
      yAxisLeft
        .append('text')
        .attr('x', -10)
        .attr('y', yPassScale(tick) + 3.5)
        .attr('text-anchor', 'end')
        .attr('fill', tick === 100 ? '#10b981' : '#64748b')
        .attr('font-size', '10px')
        .attr('font-weight', tick === 100 ? '700' : '400')
        .text(`${tick}%`);
    });

    // Right Y Axis (Duration seconds)
    const yAxisRight = g
      .append('g')
      .attr('transform', `translate(${innerWidth}, 0)`)
      .attr('class', 'text-slate-400 text-[10px] font-mono');

    [4, 8, 12].forEach((sec) => {
      if (sec > maxDuration * 1.1) return;
      yAxisRight
        .append('text')
        .attr('x', 12)
        .attr('y', yDurScale(sec) + 3.5)
        .attr('text-anchor', 'start')
        .attr('fill', '#38bdf8')
        .attr('font-size', '10px')
        .text(`${sec}s`);
    });
  }, [runs, selectedRunId, onSelectRun]);

  const handleCopySnippet = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 1800);
    } catch {
      // Ignore failure
    }
  };

  return (
    <div className="space-y-6">
      {/* 4-Metric Executive Health Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Overall Pass Rate</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {overallPassRate}%
          </div>
          <div className="text-[11px] text-slate-400">
            {passedRuns} of {totalRuns} continuous executions green
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Post-Patch Pass Rate</span>
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {postPatchPassRate}%
          </div>
          <div className="text-[11px] text-slate-400">
            100% since commit <code className="font-mono text-slate-300">a4c91e8</code> (POSIX shim)
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Flaky Tests Tracked</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-400">
            {flakyTests.length}
          </div>
          <div className="text-[11px] text-slate-400">
            {flakyTests.filter((t) => t.remediationStatus.startsWith('Fixed')).length} stabilized &amp; audited
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Avg Runner Duration</span>
            <Clock className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-sky-400">
            {avgDuration}s
          </div>
          <div className="text-[11px] text-slate-400">
            Down from 13.2s via Astral <code className="font-mono text-slate-300">uv</code> cache
          </div>
        </div>
      </div>

      {/* D3 Dual-Axis Timeline Visualizer */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>CI Execution Timeline: Pass Rate (%) &amp; Runner Latency (s)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Select any execution node to isolate failing test IDs, runner duration, and commit context.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              <span>Pass Rate (Left Axis)</span>
            </div>
            <div className="flex items-center gap-1.5 text-sky-400">
              <span className="w-2.5 h-2.5 rounded bg-sky-400/50 inline-block" />
              <span>Duration (Right Axis)</span>
            </div>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="w-full overflow-x-auto relative">
          <svg
            ref={svgRef}
            viewBox="0 0 860 290"
            className="w-full min-w-[760px] h-auto select-none"
          />

          {/* Interactive Hover Tooltip */}
          {hoveredRun && tooltipPos && (
            <div
              className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full bg-[#0b0f17]/95 border border-slate-700 rounded-lg p-2.5 shadow-xl text-xs space-y-1 font-mono"
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
            >
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1">
                <span className="text-white font-bold">
                  Run #{hoveredRun.runNumber} ({hoveredRun.commitSha})
                </span>
                <span
                  className={
                    hoveredRun.status === 'passed'
                      ? 'text-emerald-400'
                      : hoveredRun.status === 'flaky'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                >
                  {hoveredRun.status.toUpperCase()}
                </span>
              </div>
              <div className="text-slate-300">
                Pass Rate: <span className="font-bold text-emerald-400">{hoveredRun.passRatePct}%</span> ({hoveredRun.passedTests}/{hoveredRun.totalTests})
              </div>
              <div className="text-slate-400">Duration: {hoveredRun.durationSeconds}s · Branch: {hoveredRun.branch}</div>
              <div className="text-slate-400 truncate max-w-[220px]">{hoveredRun.commitMsg}</div>
            </div>
          )}
        </div>

        {/* Selected Run Inspection Bar */}
        {selectedRun && (
          <div className="bg-[#0b0f17] border border-slate-800 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <span className="text-slate-400">Inspecting Run #{selectedRun.runNumber}</span>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-400">{selectedRun.commitSha}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300">{selectedRun.branch}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300">{selectedRun.durationSeconds}s</span>
              <span className="text-slate-600">·</span>
              <span
                className={`font-semibold ${
                  selectedRun.status === 'passed'
                    ? 'text-emerald-400'
                    : selectedRun.status === 'flaky'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {selectedRun.status.toUpperCase()} ({selectedRun.passRatePct}%)
              </span>
            </div>

            <div className="text-slate-400 text-right truncate">
              {selectedRun.commitMsg}
            </div>
          </div>
        )}
      </div>

      {/* Flaky Test Matrix & Heatmap Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Flaky Tests Registry Table */}
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-200">
                Recurring Flaky Test Registry &amp; 10-Run Heatmap
              </span>
              <p className="text-[11px] text-slate-400">
                Identified via test outcome variance across recent Ubuntu and Windows runners.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {flakyTests.length} tests isolated
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {flakyTests.map((t) => {
              const isSelected = t.id === selectedTest?.id;
              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTest(t)}
                  className={`p-4 space-y-2 cursor-pointer transition-colors ${
                    isSelected ? 'bg-slate-800/60 border-l-2 border-emerald-400' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono text-xs font-bold text-white truncate max-w-sm">
                      {t.testName}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-amber-400 bg-amber-950/40 border border-amber-500/40 px-1.5 py-0.5 rounded">
                        {t.flakinessRatePct}% flakiness
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                        {t.remediationStatus}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 font-mono">{t.filePath}</div>

                  {/* 10-Run Result Sequence Dots */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 mr-1">Last 10 Runs:</span>
                      {t.recentResults.map((res, dotIdx) => (
                        <span
                          key={dotIdx}
                          title={`Run ${dotIdx + 1}: ${res}`}
                          className={`w-2.5 h-2.5 rounded-full inline-block ${
                            res === 'pass'
                              ? 'bg-emerald-400'
                              : res === 'fail'
                              ? 'bg-rose-500'
                              : 'bg-amber-400'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Category: {t.rootCauseCategory}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Root Cause & Remediation Code Inspector */}
        <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
          {selectedTest ? (
            <>
              <div className="space-y-1 border-b border-slate-800 pb-3">
                <div className="text-xs text-slate-400 font-mono">
                  {selectedTest.rootCauseCategory} · {selectedTest.remediationStatus}
                </div>
                <h3 className="text-sm font-mono font-bold text-white break-all">
                  {selectedTest.testName}
                </h3>
                <div className="text-xs text-slate-400 font-mono">{selectedTest.filePath}</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-300">Failure Signature &amp; Stack Trace</div>
                <div className="bg-[#0b0f17] border border-rose-500/30 rounded-lg p-3 text-xs font-mono text-rose-300/90 leading-relaxed break-all">
                  {selectedTest.failureMode}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-300">
                    Remediation Patch / Guard Fixture
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopySnippet(selectedTest.remediationSnippet)}
                    className="px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Patch</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="bg-[#0b0f17] border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-300/95 overflow-x-auto leading-relaxed">
                  <code>{selectedTest.remediationSnippet}</code>
                </pre>
              </div>

              <div className="p-3 bg-indigo-950/20 border border-indigo-500/30 rounded-lg text-xs text-indigo-300/90 space-y-1">
                <div className="font-semibold text-indigo-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Swarm Continuous Verification Invariant</span>
                </div>
                <p className="leading-relaxed">
                  Grounded in commit <code className="font-mono text-indigo-200">a4c91e8</code>: All PRs and branch commits
                  must execute tests in isolated virtual environments using <code className="font-mono text-indigo-200">posix_compat.py</code> to guarantee 0% failure rate across Linux, macOS, and Windows.
                </p>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 py-8 text-center">
              Select a flaky test from the registry to inspect its failure signature and remediation snippet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
