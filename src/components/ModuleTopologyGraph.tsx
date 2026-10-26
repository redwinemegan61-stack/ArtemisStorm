import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, RotateCcw, RefreshCw } from 'lucide-react';
import { ArchitectureNode, McpToolContract, PipelineStep } from '../data/presets';

export type TopologyNodeKind = 'module' | 'mcp-endpoint' | 'ci-gate';

export interface TopologyGraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  subLabel: string;
  kind: TopologyNodeKind;
  tier?: string;
  status?: string;
  details: string;
  invariantOrCmd: string;
  rawModule?: ArchitectureNode;
  rawMcp?: McpToolContract;
  rawCiStep?: PipelineStep;
}

export interface TopologyGraphLink extends d3.SimulationLinkDatum<TopologyGraphNode> {
  id: string;
  source: string | TopologyGraphNode;
  target: string | TopologyGraphNode;
  relation: 'imports' | 'exposes-mcp' | 'verifies-ci';
}

interface ModuleTopologyGraphProps {
  architectureNodes: ArchitectureNode[];
  mcpContracts: McpToolContract[];
  pipelineSteps: PipelineStep[];
  selectedNodeId?: string;
  onSelectGraphNode: (node: TopologyGraphNode) => void;
}

export default function ModuleTopologyGraph({
  architectureNodes,
  mcpContracts,
  pipelineSteps,
  selectedNodeId,
  onSelectGraphNode,
}: ModuleTopologyGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [showModules, setShowModules] = useState<boolean>(true);
  const [showMcpEndpoints, setShowMcpEndpoints] = useState<boolean>(true);
  const [showCiGates, setShowCiGates] = useState<boolean>(true);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [simulationSeed, setSimulationSeed] = useState<number>(0);

  // Build unified graph nodes and links from architecture modules, MCP contracts, and CI gates
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<string, TopologyGraphNode>();
    const linkList: TopologyGraphLink[] = [];

    // 1. Add primary Architecture Modules
    if (showModules) {
      architectureNodes.forEach((mod) => {
        nodeMap.set(mod.modulePath, {
          id: mod.modulePath,
          label: mod.modulePath.split('/').pop() || mod.modulePath,
          subLabel: mod.tier,
          kind: mod.tier === 'CI/CD Gate' ? 'ci-gate' : 'module',
          tier: mod.tier,
          status: mod.status,
          details: mod.role,
          invariantOrCmd: mod.invariants,
          rawModule: mod,
        });
      });

      // Ensure referenced dependency modules exist as nodes so dependency edges connect cleanly
      architectureNodes.forEach((mod) => {
        mod.dependencies.forEach((dep) => {
          if (!nodeMap.has(dep)) {
            const isCiGate = dep.includes('.yml') || dep.includes('lock') || dep.includes('pyproject');
            if (isCiGate && !showCiGates) return;
            nodeMap.set(dep, {
              id: dep,
              label: dep.split('/').pop() || dep,
              subLabel: isCiGate ? 'CI/CD Dependency' : 'Support Module',
              kind: isCiGate ? 'ci-gate' : 'module',
              tier: isCiGate ? 'CI/CD Gate' : 'Support Module',
              status: 'Verified',
              details: `Referenced dependency of ${mod.modulePath}`,
              invariantOrCmd: 'Deterministic import resolution under Astral uv virtualenv.',
            });
          }
          if (nodeMap.has(mod.modulePath) && nodeMap.has(dep)) {
            linkList.push({
              id: `dep-${mod.modulePath}->${dep}`,
              source: mod.modulePath,
              target: dep,
              relation: 'imports',
            });
          }
        });
      });
    }

    // 2. Add MCP Tool Contract Endpoints and link them to their host modules
    if (showMcpEndpoints) {
      mcpContracts.forEach((mcp) => {
        const mcpNodeId = `mcp:${mcp.name}`;
        nodeMap.set(mcpNodeId, {
          id: mcpNodeId,
          label: mcp.name,
          subLabel: `MCP · ${mcp.origin}`,
          kind: 'mcp-endpoint',
          tier: 'MCP Endpoint',
          status: 'Active Contract',
          details: `${mcp.purpose} Signature: ${mcp.signature}`,
          invariantOrCmd: mcp.ciVerificationCmd,
          rawMcp: mcp,
        });

        // Connect MCP endpoint to corresponding module if present
        const hostModule = architectureNodes.find((m) => {
          if (mcp.origin === 'morluto/rea') {
            return m.modulePath.includes('rea') || m.tier === 'Decompiler Bridge';
          }
          if (mcp.origin === 'google/artemis') {
            return m.modulePath.includes('mcp_server/server') || m.tier === 'MCP Core';
          }
          return m.tier === 'Supervisor' || m.modulePath.includes('coordinator');
        });

        const fallbackHost = hostModule || architectureNodes[0];
        if (fallbackHost && nodeMap.has(fallbackHost.modulePath)) {
          linkList.push({
            id: `mcp-link-${fallbackHost.modulePath}->${mcpNodeId}`,
            source: fallbackHost.modulePath,
            target: mcpNodeId,
            relation: 'exposes-mcp',
          });
        }
      });
    }

    // 3. Add CI/CD Pipeline Gate stages and connect them to modules & MCP endpoints
    if (showCiGates) {
      const ciWorkflowNodeId = '.github/workflows/ci.yml';
      if (!nodeMap.has(ciWorkflowNodeId)) {
        nodeMap.set(ciWorkflowNodeId, {
          id: ciWorkflowNodeId,
          label: 'ci.yml',
          subLabel: 'CI/CD Gate',
          kind: 'ci-gate',
          tier: 'CI/CD Gate',
          status: 'Patched for CI',
          details: 'Primary GitHub Actions workflow triggered on every push and pull_request.',
          invariantOrCmd: 'uv sync --dev && uv run pytest -p mcp_server.utils.posix_compat',
        });
      }

      pipelineSteps.forEach((step) => {
        const gateId = `ci:${step.id}`;
        nodeMap.set(gateId, {
          id: gateId,
          label: step.stage,
          subLabel: `${step.durationMs}ms Gate`,
          kind: 'ci-gate',
          tier: 'CI/CD Gate',
          status: 'Enforced on Push',
          details: step.name,
          invariantOrCmd: step.command,
          rawCiStep: step,
        });

        if (nodeMap.has(ciWorkflowNodeId)) {
          linkList.push({
            id: `ci-wf->${gateId}`,
            source: ciWorkflowNodeId,
            target: gateId,
            relation: 'verifies-ci',
          });
        }

        // Link specific CI gates to the modules or MCP tools they verify
        if (step.stage.includes('POSIX') && nodeMap.has('mcp_server/utils/device_utils.py')) {
          linkList.push({
            id: `${gateId}->device_utils`,
            source: gateId,
            target: 'mcp_server/utils/device_utils.py',
            relation: 'verifies-ci',
          });
        }
        if (step.stage.includes('REA')) {
          const reaMod = Array.from(nodeMap.keys()).find((k) => k.includes('rea'));
          if (reaMod) {
            linkList.push({
              id: `${gateId}->${reaMod}`,
              source: gateId,
              target: reaMod,
              relation: 'verifies-ci',
            });
          }
        }
        if (step.stage.includes('Artemis')) {
          const mcpMod = Array.from(nodeMap.keys()).find((k) => k.includes('mcp_server/server'));
          if (mcpMod) {
            linkList.push({
              id: `${gateId}->${mcpMod}`,
              source: gateId,
              target: mcpMod,
              relation: 'verifies-ci',
            });
          }
        }
      });
    }

    return {
      nodes: Array.from(nodeMap.values()).map((n) => ({ ...n })),
      links: linkList.map((l) => ({ ...l })),
    };
  }, [architectureNodes, mcpContracts, pipelineSteps, showModules, showMcpEndpoints, showCiGates, simulationSeed]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const width = 860;
    const height = 460;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    // Arrowhead markers for directed edges
    const defs = svg.append('defs');
    const markerTypes: Array<{ id: string; color: string }> = [
      { id: 'arrow-imports', color: '#64748b' },
      { id: 'arrow-exposes-mcp', color: '#34d399' },
      { id: 'arrow-verifies-ci', color: '#f59e0b' },
    ];

    markerTypes.forEach((m) => {
      defs
        .append('marker')
        .attr('id', m.id)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 26)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L10,0L0,4')
        .attr('fill', m.color);
    });

    // Subtle background coordinate grid
    const gridGroup = svg.append('g').attr('class', 'topology-grid');
    for (let x = 0; x <= width; x += 40) {
      gridGroup
        .append('line')
        .attr('x1', x)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', height)
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 0.5)
        .attr('stroke-opacity', 0.45);
    }
    for (let y = 0; y <= height; y += 40) {
      gridGroup
        .append('line')
        .attr('x1', 0)
        .attr('y1', y)
        .attr('x2', width)
        .attr('y2', y)
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 0.5)
        .attr('stroke-opacity', 0.45);
    }

    const viewport = svg.append('g').attr('class', 'topology-viewport');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.45, 2.4])
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Build D3 force simulation
    const simulation = d3
      .forceSimulation<TopologyGraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<TopologyGraphNode, TopologyGraphLink>(links)
          .id((d) => d.id)
          .distance((d) => (d.relation === 'exposes-mcp' ? 115 : 130))
          .strength(0.65)
      )
      .force('charge', d3.forceManyBody().strength(-420))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'x',
        d3
          .forceX<TopologyGraphNode>((d) => {
            if (d.kind === 'ci-gate') return width * 0.22;
            if (d.kind === 'mcp-endpoint') return width * 0.78;
            return width * 0.5;
          })
          .strength(0.18)
      )
      .force('y', d3.forceY(height / 2).strength(0.12))
      .force('collide', d3.forceCollide<TopologyGraphNode>().radius(46));

    // Render Links
    const linkGroup = viewport.append('g').attr('class', 'links');
    const linkElements = linkGroup
      .selectAll('g')
      .data(links)
      .join('g')
      .attr('class', 'link-item');

    const linkLines = linkElements
      .append('line')
      .attr('stroke', (d) => {
        if (d.relation === 'exposes-mcp') return '#10b981';
        if (d.relation === 'verifies-ci') return '#f59e0b';
        return '#475569';
      })
      .attr('stroke-width', (d) => (d.relation === 'imports' ? 1.5 : 1.75))
      .attr('stroke-dasharray', (d) => (d.relation === 'verifies-ci' ? '4,3' : 'none'))
      .attr('stroke-opacity', 0.75)
      .attr('marker-end', (d) => `url(#arrow-${d.relation})`);

    const linkLabels = linkElements
      .append('text')
      .text((d) => {
        if (d.relation === 'exposes-mcp') return 'MCP';
        if (d.relation === 'verifies-ci') return 'CI gate';
        return 'imports';
      })
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', 9)
      .attr('fill', '#64748b')
      .attr('text-anchor', 'middle')
      .attr('dy', -4);

    // Render Nodes
    const nodeGroup = viewport.append('g').attr('class', 'nodes');
    const nodeElements = nodeGroup
      .selectAll<SVGGElement, TopologyGraphNode>('g')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('class', 'node-item')
      .style('cursor', 'grab')
      .on('click', (_event, d) => {
        onSelectGraphNode(d);
      })
      .on('mouseenter', (_event, d) => {
        setHoveredNodeId(d.id);
      })
      .on('mouseleave', () => {
        setHoveredNodeId(null);
      });

    // Drag behavior
    const drag = d3
      .drag<SVGGElement, TopologyGraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeElements.call(drag);

    // Outer halo for selected state
    nodeElements
      .append('circle')
      .attr('class', 'node-halo')
      .attr('r', 22)
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        if (d.kind === 'mcp-endpoint') return '#10b981';
        if (d.kind === 'ci-gate') return '#f59e0b';
        return '#38bdf8';
      })
      .attr('stroke-width', 2)
      .attr('stroke-opacity', (d) => (d.id === selectedNodeId ? 0.9 : 0));

    // Primary node shape: Circle for Module, Diamond/Hex-style rounded rect for MCP, Square for CI Gate
    nodeElements
      .append('circle')
      .attr('class', 'node-core')
      .attr('r', 16)
      .attr('fill', (d) => {
        if (d.kind === 'mcp-endpoint') return '#064e3b';
        if (d.kind === 'ci-gate') return '#451a03';
        return '#0f172a';
      })
      .attr('stroke', (d) => {
        if (d.kind === 'mcp-endpoint') return '#34d399';
        if (d.kind === 'ci-gate') return '#fbbf24';
        return '#38bdf8';
      })
      .attr('stroke-width', 1.75);

    // Node glyph text inside circle
    nodeElements
      .append('text')
      .text((d) => {
        if (d.kind === 'mcp-endpoint') return 'MCP';
        if (d.kind === 'ci-gate') return 'CI';
        return 'PY';
      })
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', 8.5)
      .attr('font-weight', 600)
      .attr('fill', (d) => {
        if (d.kind === 'mcp-endpoint') return '#6ee7b7';
        if (d.kind === 'ci-gate') return '#fcd34d';
        return '#7dd3fc';
      })
      .attr('text-anchor', 'middle')
      .attr('dy', 3);

    // Node primary label below circle
    nodeElements
      .append('text')
      .text((d) => d.label)
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', 10.5)
      .attr('font-weight', 500)
      .attr('fill', '#f1f5f9')
      .attr('text-anchor', 'middle')
      .attr('dy', 30);

    // Node subLabel below primary label
    nodeElements
      .append('text')
      .text((d) => d.subLabel)
      .attr('font-family', 'Public Sans, sans-serif')
      .attr('font-size', 9.5)
      .attr('fill', '#94a3b8')
      .attr('text-anchor', 'middle')
      .attr('dy', 42);

    simulation.on('tick', () => {
      linkLines
        .attr('x1', (d) => (d.source as TopologyGraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as TopologyGraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as TopologyGraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as TopologyGraphNode).y ?? 0);

      linkLabels
        .attr(
          'x',
          (d) => (((d.source as TopologyGraphNode).x ?? 0) + ((d.target as TopologyGraphNode).x ?? 0)) / 2
        )
        .attr(
          'y',
          (d) => (((d.source as TopologyGraphNode).y ?? 0) + ((d.target as TopologyGraphNode).y ?? 0)) / 2
        );

      nodeElements.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  // Update selection & hover highlighting without restarting the physics simulation
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);

    const activeFocusId = hoveredNodeId || selectedNodeId;
    const connectedIds = new Set<string>();
    if (activeFocusId) {
      connectedIds.add(activeFocusId);
      links.forEach((l) => {
        const sId = typeof l.source === 'string' ? l.source : l.source.id;
        const tId = typeof l.target === 'string' ? l.target : l.target.id;
        if (sId === activeFocusId) connectedIds.add(tId);
        if (tId === activeFocusId) connectedIds.add(sId);
      });
    }

    svg
      .selectAll<SVGCircleElement, TopologyGraphNode>('.node-halo')
      .attr('stroke-opacity', (d) => (d.id === selectedNodeId || d.id === hoveredNodeId ? 0.95 : 0));

    svg
      .selectAll<SVGGElement, TopologyGraphNode>('.node-item')
      .attr('opacity', (d) => (!activeFocusId || connectedIds.has(d.id) ? 1 : 0.35));

    svg
      .selectAll<SVGGElement, TopologyGraphLink>('.link-item')
      .attr('opacity', (d) => {
        if (!activeFocusId) return 0.85;
        const sId = typeof d.source === 'string' ? d.source : d.source.id;
        const tId = typeof d.target === 'string' ? d.target : d.target.id;
        return sId === activeFocusId || tId === activeFocusId ? 1 : 0.18;
      });
  }, [selectedNodeId, hoveredNodeId, links]);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(180).call(zoomBehaviorRef.current.scaleBy, 1.25);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(180).call(zoomBehaviorRef.current.scaleBy, 0.8);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(180)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Graph Toolbar */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-slate-200">Interactive Force-Directed Topology</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="font-mono tabular-nums text-slate-400">
            {nodes.length} nodes / {links.length} directed edges
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Layer visibility toggles */}
          <div className="flex items-center gap-1 p-1 bg-[#0b0f17] border border-slate-800 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setShowModules((v) => !v)}
              className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showModules ? 'bg-sky-950/90 text-sky-300 border border-sky-500/40' : 'text-slate-500'
              }`}
            >
              PY Modules
            </button>
            <button
              type="button"
              onClick={() => setShowMcpEndpoints((v) => !v)}
              className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showMcpEndpoints ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40' : 'text-slate-500'
              }`}
            >
              MCP Endpoints
            </button>
            <button
              type="button"
              onClick={() => setShowCiGates((v) => !v)}
              className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showCiGates ? 'bg-amber-950/90 text-amber-300 border border-amber-500/40' : 'text-slate-500'
              }`}
            >
              CI Gates
            </button>
          </div>

          {/* Zoom & Simulation Controls */}
          <div className="flex items-center gap-1 bg-[#0b0f17] border border-slate-800 rounded-lg p-1">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Reset Pan & Zoom"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSimulationSeed((s) => s + 1)}
              title="Re-heat Force Layout"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative bg-[#0b0f17] w-full overflow-hidden">
        <svg
          ref={svgRef}
          viewBox="0 0 860 460"
          className="w-full h-[430px] block select-none"
          aria-label="Reverse-Engineered Module Topology Force-Directed Graph"
        />

        {/* Quiet inline legend at bottom of canvas */}
        <div className="px-4 py-2.5 bg-[#111827]/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sky-300 font-mono">PY · Architecture Module</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-300 font-mono">MCP · Tool Endpoint</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-300 font-mono">CI · Workflow Gate</span>
          </div>
          <span>Drag nodes to rearrange · Scroll to zoom · Click any node to inspect</span>
        </div>
      </div>
    </div>
  );
}
