import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_ARTEMIS_REA_REPORT,
  ORIGINAL_ARTEMIS_CI_YAML,
  UNIFIED_REA_ARTEMIS_CI_YAML,
  POSIX_COMPAT_PATCH,
  GENERATED_SWARM_TEST_SUITE,
} from './src/data/presets.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseGitHubRepo(input: string): { owner: string; repo: string; targetPath?: string } {
  const cleaned = decodeURIComponent(input.trim());
  const urlMatch = cleaned.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/(?:blob|tree)\/[^/]+\/(.+))?/i);
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2].replace(/\.git$/, ''),
      targetPath: urlMatch[3],
    };
  }
  const parts = cleaned.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length >= 2) {
    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/, ''),
    };
  }
  return { owner: 'google', repo: 'artemis' };
}

async function fetchGitHubContext(owner: string, repo: string, githubToken?: string) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Artemis-REA-Swarm-Studio',
  };
  if (githubToken && githubToken.trim()) {
    headers.Authorization = `Bearer ${githubToken.trim()}`;
  }

  let defaultBranch = 'main';
  let description = '';
  let stars = 0;
  let language = 'Python';
  let fileSample: string[] = [];
  let workflowContent = '';
  let liveFetched = false;

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (repoRes.ok) {
      const repoData = (await repoRes.json()) as Record<string, any>;
      defaultBranch = repoData.default_branch || 'main';
      description = repoData.description || '';
      stars = repoData.stargazers_count || 0;
      language = repoData.language || 'Python';
      liveFetched = true;

      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        { headers }
      );
      if (treeRes.ok) {
        const treeData = (await treeRes.json()) as { tree?: Array<{ path: string; type: string }> };
        if (Array.isArray(treeData.tree)) {
          fileSample = treeData.tree
            .filter((item) => item.type === 'blob')
            .map((item) => item.path)
            .slice(0, 80);
        }
      }

      const ciPaths = [
        '.github/workflows/ci.yml',
        '.github/workflows/ci.yaml',
        '.github/workflows/test.yml',
        '.github/workflows/main.yml',
      ];
      for (const ciPath of ciPaths) {
        const ciRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${ciPath}?ref=${defaultBranch}`,
          { headers }
        );
        if (ciRes.ok) {
          const ciData = (await ciRes.json()) as { content?: string };
          if (ciData.content) {
            workflowContent = Buffer.from(ciData.content, 'base64').toString('utf-8');
            break;
          }
        }
      }
    }
  } catch {
    // Fallback to verified snapshot if network/rate-limit occurs
  }

  if (!fileSample.length && owner.toLowerCase() === 'google' && repo.toLowerCase() === 'artemis') {
    fileSample = [
      '.github/workflows/ci.yml',
      'pyproject.toml',
      'uv.lock',
      'start.sh',
      'start.bat',
      'mcp_server/__init__.py',
      'mcp_server/server.py',
      'mcp_server/config.py',
      'mcp_server/utils/device_utils.py',
      'mcp_server/tools/adb_tools.py',
      'mcp_server/tools/ui_automator.py',
      'tests/unit/mcp/test_device_utils.py',
      'tests/unit/mcp/test_server.py',
    ];
  }

  if (!workflowContent && owner.toLowerCase() === 'google' && repo.toLowerCase() === 'artemis') {
    workflowContent = ORIGINAL_ARTEMIS_CI_YAML;
  }

  return {
    owner,
    repo,
    defaultBranch,
    description:
      description ||
      (owner.toLowerCase() === 'google' && repo.toLowerCase() === 'artemis'
        ? 'Google ARTEMIS: Natural-language Android device automation & testing via Model Context Protocol (MCP)'
        : `Repository ${owner}/${repo}`),
    stars,
    language,
    fileSample,
    workflowContent,
    liveFetched,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  app.post('/api/github/inspect', async (req, res) => {
    try {
      const { repoInput = 'https://github.com/google/artemis/blob/main/.github%2Fworkflows%2Fci.yml', githubToken } =
        req.body || {};
      const parsed = parseGitHubRepo(repoInput);
      const context = await fetchGitHubContext(parsed.owner, parsed.repo, githubToken);
      res.json({
        ok: true,
        parsed,
        context,
      });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: error?.message || 'Failed to inspect GitHub repository',
      });
    }
  });

  app.post('/api/github/push-workflow', async (req, res) => {
    try {
      const {
        targetRepo,
        branch = 'main',
        githubToken,
        ciYaml,
        posixPatchCode,
        commitMessage = 'ci(artemis-rea): enable automated push CI/CD pipeline and POSIX subprocess compatibility',
      } = req.body || {};

      if (!targetRepo || !githubToken) {
        return res.status(400).json({
          ok: false,
          error: 'Both target GitHub repository (owner/repo) and a GitHub Personal Access Token with repo/workflow scope are required to push directly.',
        });
      }

      const { owner, repo } = parseGitHubRepo(targetRepo);
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${githubToken.trim()}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Artemis-REA-Swarm-Studio',
      };

      const filesToCommit = [
        {
          path: '.github/workflows/ci.yml',
          content: ciYaml || UNIFIED_REA_ARTEMIS_CI_YAML,
        },
        {
          path: 'mcp_server/utils/posix_compat.py',
          content: posixPatchCode || POSIX_COMPAT_PATCH,
        },
      ];

      const committedFiles: Array<{ path: string; htmlUrl?: string; sha?: string }> = [];

      for (const file of filesToCommit) {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`;
        let existingSha: string | undefined;

        const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
        if (getRes.ok) {
          const existingData = (await getRes.json()) as { sha?: string };
          existingSha = existingData.sha;
        }

        const putBody: Record<string, any> = {
          message: commitMessage,
          content: Buffer.from(file.content, 'utf-8').toString('base64'),
          branch,
        };
        if (existingSha) {
          putBody.sha = existingSha;
        }

        const putRes = await fetch(apiUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify(putBody),
        });

        if (!putRes.ok) {
          const errText = await putRes.text();
          return res.status(putRes.status).json({
            ok: false,
            error: `GitHub API error on ${file.path} (${putRes.status}): ${errText}`,
          });
        }

        const putData = (await putRes.json()) as { content?: { html_url?: string; sha?: string } };
        committedFiles.push({
          path: file.path,
          htmlUrl: putData.content?.html_url,
          sha: putData.content?.sha,
        });
      }

      return res.json({
        ok: true,
        repo: `${owner}/${repo}`,
        branch,
        committedFiles,
      });
    } catch (error: any) {
      return res.status(500).json({
        ok: false,
        error: error?.message || 'Failed to push workflow to GitHub',
      });
    }
  });

  app.post('/api/swarm/reverse-engineer', async (req, res) => {
    try {
      const {
        repoInput = 'https://github.com/google/artemis/blob/main/.github%2Fworkflows%2Fci.yml',
        customCodeOrContext = '',
        tacticalObjective = 'Deploy REA + Artemis with automated push CI testing and minimal-compute agent swarm delegation',
        githubToken,
      } = req.body || {};

      const parsed = parseGitHubRepo(repoInput);
      const ghContext = await fetchGitHubContext(parsed.owner, parsed.repo, githubToken);

      const ai = getGenAIClient();

      const prompt = `You are the Lead Supervisor Agent of a Tactical Reverse-Engineering & CI/CD Agent Swarm combining:
1. Google ARTEMIS (google/artemis): MCP-driven natural-language Android & system test/action automation using Python 3.12 and Astral 'uv'.
2. REA (Reverse Engineer Anything - morluto/rea): MCP-driven decompiler, AST, and binary/symbol reconstruction bridge.

Core Operating Doctrine:
- Always remain efficient, resourceful, and tactical.
- Never do any harm. Only use the bare minimum compute/resources needed to do the best job possible.
- Teach other agents within our Trust Group to perform routine tasks that require less effort and spending.
- Supervise lower-tier agents and verify that all tasks, tests, and CI/CD gates complete deterministically.

Target Repository Inspected: ${ghContext.owner}/${ghContext.repo} (Default Branch: ${ghContext.defaultBranch})
Repository Description: ${ghContext.description}
Primary Language: ${ghContext.language}
Discovered File Tree Sample:
${ghContext.fileSample.join('\n') || 'Standard Python MCP + GitHub Actions layout'}

Existing CI Workflow (.github/workflows/ci.yml):
${ghContext.workflowContent || ORIGINAL_ARTEMIS_CI_YAML}

Additional User Context / Code Snippet:
${customCodeOrContext || 'Ensure CI runs on every push without skipping tests, fix Linux runner subprocess flags, integrate REA + Artemis, and train the Trust-Group swarm.'}

Tactical Objective:
${tacticalObjective}

Generate a comprehensive, production-grade ReverseEngineeringReport in JSON matching the requested schema.
Ensure:
1. unifiedCiYaml is a complete, valid GitHub Actions .github/workflows/ci.yml that triggers on every push and pull_request, runs all tests unconditionally (no workflow_dispatch gating blocking push tests), includes REA + Artemis MCP verification, and runs an automated deployment job on every push to main.
2. posixPatchCode provides clean cross-platform Python compatibility code (e.g., handling Windows vs Linux subprocess flags or environment shims).
3. generatedTestSuite provides an executable pytest test file validating the reverse-engineered contracts and CI invariants.
4. trustGroupPlaybook provides 4 concrete Standard Operating Procedures (SOPs) teaching Tier-2 and Tier-3 Trust-Group agents how to execute routine reverse-engineering and testing tasks at minimal compute cost under Supervisor oversight.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              repoFullName: { type: Type.STRING },
              repoUrl: { type: Type.STRING },
              defaultBranch: { type: Type.STRING },
              executiveSummary: { type: Type.STRING },
              computeAllocation: {
                type: Type.OBJECT,
                properties: {
                  supervisorSharePct: { type: Type.NUMBER },
                  workerSharePct: { type: Type.NUMBER },
                  estimatedCostReductionPct: { type: Type.NUMBER },
                  tacticalRationale: { type: Type.STRING },
                },
                required: [
                  'supervisorSharePct',
                  'workerSharePct',
                  'estimatedCostReductionPct',
                  'tacticalRationale',
                ],
              },
              ciIssuesResolved: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    file: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    rootCause: { type: Type.STRING },
                    fixApplied: { type: Type.STRING },
                  },
                  required: ['id', 'file', 'severity', 'rootCause', 'fixApplied'],
                },
              },
              architectureNodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    modulePath: { type: Type.STRING },
                    role: { type: Type.STRING },
                    tier: { type: Type.STRING },
                    dependencies: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    complexity: { type: Type.STRING },
                    invariants: { type: Type.STRING },
                    status: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'modulePath',
                    'role',
                    'tier',
                    'dependencies',
                    'complexity',
                    'invariants',
                    'status',
                  ],
                },
              },
              mcpContracts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    origin: { type: Type.STRING },
                    signature: { type: Type.STRING },
                    purpose: { type: Type.STRING },
                    ciVerificationCmd: { type: Type.STRING },
                  },
                  required: ['name', 'origin', 'signature', 'purpose', 'ciVerificationCmd'],
                },
              },
              trustGroupPlaybook: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    taskCategory: { type: Type.STRING },
                    assignedAgent: { type: Type.STRING },
                    computeTier: { type: Type.STRING },
                    estimatedTokenSavings: { type: Type.STRING },
                    instructionTemplate: { type: Type.STRING },
                    verificationCriteria: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'taskCategory',
                    'assignedAgent',
                    'computeTier',
                    'estimatedTokenSavings',
                    'instructionTemplate',
                    'verificationCriteria',
                  ],
                },
              },
              unifiedCiYaml: { type: Type.STRING },
              posixPatchCode: { type: Type.STRING },
              generatedTestSuite: { type: Type.STRING },
            },
            required: [
              'repoFullName',
              'repoUrl',
              'defaultBranch',
              'executiveSummary',
              'computeAllocation',
              'ciIssuesResolved',
              'architectureNodes',
              'mcpContracts',
              'trustGroupPlaybook',
              'unifiedCiYaml',
              'posixPatchCode',
              'generatedTestSuite',
            ],
          },
        },
      });

      const rawText = response.text || '{}';
      const parsedReport = JSON.parse(rawText);

      const finalReport = {
        ...INITIAL_ARTEMIS_REA_REPORT,
        ...parsedReport,
        analyzedAt: new Date().toISOString(),
        originalCiYaml: ghContext.workflowContent || ORIGINAL_ARTEMIS_CI_YAML,
      };

      return res.json({
        ok: true,
        report: finalReport,
        githubContext: ghContext,
      });
    } catch (error: any) {
      return res.status(500).json({
        ok: false,
        error: error?.message || 'Reverse engineering swarm execution failed',
      });
    }
  });

  app.post('/api/swarm/train-subagent', async (req, res) => {
    try {
      const {
        targetTask,
        targetModule = 'mcp_server/utils/device_utils.py',
        selectedTier = 'Minimal (Tier-3 Worker)',
      } = req.body || {};

      if (!targetTask) {
        return res.status(400).json({ ok: false, error: 'Please provide a task description to train and delegate.' });
      }

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are the Lead Supervisor training a sub-agent in our Trust Group.
Doctrine: Remain efficient, resourceful, and tactical. Never do any harm. Use the bare minimum resources needed. Teach sub-agents to perform tasks that require less effort and spending, while supervising to ensure 100% correctness.

Task to Delegate & Teach: ${targetTask}
Target Module / Scope: ${targetModule}
Target Compute Tier: ${selectedTier}

Produce:
1. A compact, reusable Standard Operating Procedure (SOP) entry for the Trust Group playbook.
2. The exact low-cost execution output produced by the sub-agent under your supervision.
3. Your Supervisor verification sign-off proving all invariants passed.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sop: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  taskCategory: { type: Type.STRING },
                  assignedAgent: { type: Type.STRING },
                  computeTier: { type: Type.STRING },
                  estimatedTokenSavings: { type: Type.STRING },
                  instructionTemplate: { type: Type.STRING },
                  verificationCriteria: { type: Type.STRING },
                },
                required: [
                  'id',
                  'taskCategory',
                  'assignedAgent',
                  'computeTier',
                  'estimatedTokenSavings',
                  'instructionTemplate',
                  'verificationCriteria',
                ],
              },
              subAgentWorkArtifact: { type: Type.STRING },
              supervisorAuditLog: { type: Type.STRING },
            },
            required: ['sop', 'subAgentWorkArtifact', 'supervisorAuditLog'],
          },
        },
      });

      const result = JSON.parse(response.text || '{}');
      return res.json({
        ok: true,
        ...result,
      });
    } catch (error: any) {
      return res.status(500).json({
        ok: false,
        error: error?.message || 'Failed to train Trust-Group sub-agent',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Artemis & REA Swarm Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
