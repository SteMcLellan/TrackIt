import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function fatal(message) {
  process.stderr.write(message.endsWith('\n') ? message : `${message}\n`);
  process.exitCode = 1;
}

function usage() {
  process.stdout.write(
    [
      'Usage:',
      '  node tools/tickets.mjs validate',
      '  node tools/tickets.mjs sync-active',
      '  node tools/tickets.mjs summary <ticketId>',
      '',
      'Agents dir discovery:',
      '  - Uses TRACKIT_AGENTS_DIR when set',
      "  - Else prefers '../agents' (worker worktree) or '../TrackIt.wt/agents' (main worktree)",
      '',
    ].join('\n'),
  );
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function utcNowCompact() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const mo = pad2(d.getUTCMonth() + 1);
  const da = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const mi = pad2(d.getUTCMinutes());
  return `${y}-${mo}-${da} ${h}:${mi}`;
}

function isUtcCompact(value) {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(value ?? ''));
}

function stripInlineComment(value) {
  const s = String(value);
  if (s.startsWith('"') || s.startsWith("'")) return s;
  const hashIndex = s.indexOf(' #');
  return hashIndex === -1 ? s : s.slice(0, hashIndex);
}

function unquote(value) {
  const s = String(value);
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseYamlSubset(yamlText) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];

  const lines = yamlText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;

    const indent = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();

    if (trimmed.startsWith('- ')) {
      throw new Error('YAML sequences are not supported');
    }

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex <= 0) {
      throw new Error(`Invalid YAML mapping line: "${trimmed}"`);
    }

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();
    value = stripInlineComment(value);

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;

    if (!value) {
      const child = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
      continue;
    }

    parent[key] = unquote(value);
  }

  return root;
}

function extractFrontmatter(text) {
  const trimmed = String(text ?? '');
  const lines = trimmed.split(/\r?\n/);
  if (lines[0] !== '---') return null;

  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) throw new Error('Frontmatter start found but no end delimiter');

  const yaml = lines.slice(1, endIndex).join('\n');
  const body = lines.slice(endIndex + 1).join('\n');
  return { yaml, body };
}

function detectKindFromFilename(filePath) {
  const name = path.basename(filePath);
  if (name.endsWith('-spec.md')) return 'spec';
  if (name.endsWith('-progress.md')) return 'progress';
  return null;
}

function ticketIdFromFilename(filePath) {
  const name = path.basename(filePath);
  const m = /^ticket-(.+)-(spec|progress)\.md$/i.exec(name);
  return m?.[1] ?? null;
}

function parseLegacyMetadata(text, filePath) {
  const kind = detectKindFromFilename(filePath);
  const ticketId = ticketIdFromFilename(filePath);
  const lines = String(text ?? '').split(/\r?\n/).slice(0, 60);

  if (kind === 'spec') {
    const assigneeLine = lines.find((l) => /^\s*-\s*Assignee:/i.test(l)) ?? '';
    const statusLine = lines.find((l) => /^\s*-\s*Status:/i.test(l)) ?? '';
    const createdLine = lines.find((l) => /^\s*-\s*Created\s*\(UTC\):/i.test(l)) ?? '';
    const updatedLine = lines.find((l) => /^\s*-\s*Last updated\s*\(UTC\):/i.test(l)) ?? '';

    const assigneeMatch = /Assignee:\s*([a-zA-Z0-9_-]+)/.exec(assigneeLine);
    const statusMatch = /Status:\s*([a-z_]+)/i.exec(statusLine);
    const createdMatch = /Created\s*\(UTC\):\s*([0-9-]+)/.exec(createdLine);
    const updatedMatch = /Last updated\s*\(UTC\):\s*([0-9-]+\s+[0-9:]+)/.exec(updatedLine);

    return {
      source: 'legacy',
      kind: 'spec',
      ticketId,
      owner: 'coordinator',
      assignee: assigneeMatch?.[1] ?? null,
      status: statusMatch?.[1]?.toLowerCase() ?? null,
      createdUtc: createdMatch?.[1] ?? null,
      updatedUtc: updatedMatch?.[1] ?? null,
    };
  }

  if (kind === 'progress') {
    const ownerLine = lines.find((l) => /^\s*-\s*Owner:\s*worker\b/i.test(l)) ?? '';
    const statusLine = lines.find((l) => /^\s*-\s*Status:/i.test(l)) ?? '';
    const updatedLine = lines.find((l) => /^\s*-\s*Last updated\s*\(UTC\):/i.test(l)) ?? '';

    const agentMatch = /Owner:\s*worker\s+([a-zA-Z0-9_-]+)/i.exec(ownerLine);
    const statusMatch = /Status:\s*([a-z_]+)/i.exec(statusLine);
    const updatedMatch = /Last updated\s*\(UTC\):\s*([0-9-]+\s+[0-9:]+)/.exec(updatedLine);

    return {
      source: 'legacy',
      kind: 'progress',
      ticketId,
      owner: 'worker',
      agent: agentMatch?.[1] ?? null,
      status: statusMatch?.[1]?.toLowerCase() ?? null,
      updatedUtc: updatedMatch?.[1] ?? null,
    };
  }

  return null;
}

function normalizeMetadata({ text, filePath }) {
  const fm = extractFrontmatter(text);
  const fileKind = detectKindFromFilename(filePath);
  const fileTicketId = ticketIdFromFilename(filePath);

  if (!fm) {
    const legacy = parseLegacyMetadata(text, filePath);
    if (!legacy) throw new Error(`Cannot parse legacy ticket metadata from ${path.basename(filePath)}`);
    return legacy;
  }

  const yaml = parseYamlSubset(fm.yaml);
  const kind = yaml.kind ?? fileKind;
  const ticketId = yaml.ticketId ?? fileTicketId;

  if (!ticketId) throw new Error(`Missing ticketId in ${path.basename(filePath)}`);
  if (fileTicketId && ticketId !== fileTicketId) {
    throw new Error(
      `ticketId mismatch in ${path.basename(filePath)}: frontmatter="${ticketId}" filename="${fileTicketId}"`,
    );
  }
  if (fileKind && kind !== fileKind) {
    throw new Error(`kind mismatch in ${path.basename(filePath)}: frontmatter="${kind}" filename="${fileKind}"`);
  }

  if (kind === 'spec') {
    return {
      source: 'frontmatter',
      kind: 'spec',
      ticketId,
      owner: yaml.owner ?? null,
      assignee: yaml.assignee ?? null,
      status: yaml.status ?? null,
      createdUtc: yaml.createdUtc ?? null,
      updatedUtc: yaml.updatedUtc ?? null,
    };
  }

  if (kind === 'progress') {
    const verificationNotes =
      typeof yaml.verification?.notes === 'string' ? yaml.verification.notes : yaml.verification?.notes ?? null;
    return {
      source: 'frontmatter',
      kind: 'progress',
      ticketId,
      owner: yaml.owner ?? null,
      agent: yaml.agent ?? null,
      status: yaml.status ?? null,
      updatedUtc: yaml.updatedUtc ?? null,
      branch: yaml.branch ?? null,
      headCommit: yaml.headCommit ?? null,
      verificationNotes,
    };
  }

  throw new Error(`Unsupported ticket kind "${String(kind)}" in ${path.basename(filePath)}`);
}

async function discoverAgentsDir(repoRoot) {
  const env = process.env.TRACKIT_AGENTS_DIR;
  if (env) return path.resolve(repoRoot, env);

  const candidate1 = path.resolve(repoRoot, '..', 'agents');
  if (fs.existsSync(candidate1) && fs.statSync(candidate1).isDirectory()) return candidate1;

  const candidate2 = path.resolve(repoRoot, '..', 'TrackIt.wt', 'agents');
  if (fs.existsSync(candidate2) && fs.statSync(candidate2).isDirectory()) return candidate2;

  throw new Error('Unable to locate agents directory (set TRACKIT_AGENTS_DIR)');
}

async function loadTickets(agentsDir) {
  const entries = await fsp.readdir(agentsDir);
  const ticketFiles = entries
    .filter((name) => /^ticket-.+-(spec|progress)\.md$/i.test(name))
    .map((name) => path.join(agentsDir, name));

  const specsByTicketId = new Map();
  const progressByTicketId = new Map();
  const warnings = [];

  for (const filePath of ticketFiles) {
    const text = await fsp.readFile(filePath, 'utf8');
    const meta = normalizeMetadata({ text, filePath });

    if (meta.source === 'legacy') warnings.push(`${path.basename(filePath)}: missing YAML frontmatter (legacy format)`);

    if (meta.kind === 'spec') {
      specsByTicketId.set(meta.ticketId, { ...meta, filePath });
    } else {
      progressByTicketId.set(meta.ticketId, { ...meta, filePath });
    }
  }

  return { specsByTicketId, progressByTicketId, warnings };
}

function computeEffectiveTicket({ spec, progress }) {
  if (!spec) return null;

  // The coordinator can close/block a ticket by updating the spec. This prevents "stuck" active
  // tickets when progress isn't updated post-merge/supersession.
  const isSpecTerminal = spec.status === 'done' || spec.status === 'blocked';
  const effectiveStatus = isSpecTerminal ? spec.status : (progress?.status ?? spec.status ?? null);
  const effectiveUpdatedUtc = progress?.updatedUtc ?? spec.updatedUtc ?? null;

  return {
    ticketId: spec.ticketId,
    assignee: spec.assignee ?? null,
    status: effectiveStatus,
    updatedUtc: effectiveUpdatedUtc,
    branch: progress?.branch ?? null,
    headCommit: progress?.headCommit ?? null,
    verificationNotes: progress?.verificationNotes ?? null,
  };
}

function isActiveStatus(status) {
  return status === 'queued' || status === 'in_progress' || status === 'ready_for_review';
}

function statusPriority(status) {
  if (status === 'in_progress') return 3;
  if (status === 'ready_for_review') return 2;
  if (status === 'queued') return 1;
  return 0;
}

function updatedSortKey(updatedUtc) {
  return isUtcCompact(updatedUtc) ? String(updatedUtc) : '';
}

function pickActiveByAgent({ ticketIds, specsByTicketId, progressByTicketId }) {
  const candidatesByAgent = new Map();

  for (const ticketId of ticketIds) {
    const spec = specsByTicketId.get(ticketId);
    const progress = progressByTicketId.get(ticketId) ?? null;
    const effective = computeEffectiveTicket({ spec, progress });
    if (!effective.assignee) continue;
    if (!isActiveStatus(effective.status)) continue;

    const list = candidatesByAgent.get(effective.assignee) ?? [];
    list.push(effective);
    candidatesByAgent.set(effective.assignee, list);
  }

  const activeByAgent = new Map();
  const warnings = [];

  for (const [agent, list] of candidatesByAgent.entries()) {
    const sorted = [...list].sort((a, b) => {
      const prio = statusPriority(b.status) - statusPriority(a.status);
      if (prio !== 0) return prio;
      const uk = updatedSortKey(b.updatedUtc).localeCompare(updatedSortKey(a.updatedUtc));
      if (uk !== 0) return uk;
      return a.ticketId.localeCompare(b.ticketId);
    });

    const chosen = sorted[0];
    activeByAgent.set(agent, chosen);

    if (sorted.length > 1) {
      warnings.push(
        `Agent "${agent}" has multiple candidate active tickets; choosing "${chosen.ticketId}": ` +
          sorted.map((t) => `${t.ticketId}(${t.status ?? ''} ${t.updatedUtc ?? ''})`).join(', '),
      );
    }
  }

  return { activeByAgent, warnings };
}

function validateTicketMetadata({ effective, spec, progress }) {
  const errors = [];
  const warnings = [];

  if (!spec.ticketId) errors.push('spec: missing ticketId');
  if (!spec.assignee) errors.push('spec: missing assignee');
  if (!spec.status) errors.push('spec: missing status');
  if (!spec.createdUtc) warnings.push('spec: missing createdUtc');
  if (!spec.updatedUtc) errors.push('spec: missing updatedUtc');

  if (spec.source === 'frontmatter') {
    if (spec.owner !== 'coordinator') errors.push('spec: owner must be "coordinator"');
    if (!spec.createdUtc || !/^\d{4}-\d{2}-\d{2}$/.test(spec.createdUtc)) errors.push('spec: createdUtc must be YYYY-MM-DD');
    if (!isUtcCompact(spec.updatedUtc)) errors.push('spec: updatedUtc must be YYYY-MM-DD HH:mm');
  }

  if (progress) {
    if (!progress.status) errors.push('progress: missing status');
    if (!progress.updatedUtc) errors.push('progress: missing updatedUtc');
    if (progress.source === 'frontmatter') {
      if (progress.owner !== 'worker') errors.push('progress: owner must be "worker"');
      if (!progress.agent) errors.push('progress: missing agent');
      if (!isUtcCompact(progress.updatedUtc)) errors.push('progress: updatedUtc must be YYYY-MM-DD HH:mm');
    }
  }

  if (!effective.status) errors.push('effective: missing status');
  if (effective.updatedUtc && !isUtcCompact(effective.updatedUtc)) {
    warnings.push('effective: updatedUtc is not in YYYY-MM-DD HH:mm format');
  }

  return { errors, warnings };
}

function yamlEscape(value) {
  if (value == null) return 'null';
  const s = String(value);
  if (s === '') return '""';
  if (/^[a-zA-Z0-9_.-]+$/.test(s)) return s;
  return `"${s.replaceAll('"', '\\"')}"`;
}

function renderActiveYaml({ generatedUtc, activeByAgent }) {
  const agents = Array.from(activeByAgent.keys()).sort();
  const lines = [];
  lines.push(`generatedUtc: ${yamlEscape(generatedUtc)}`);
  lines.push('active:');
  for (const agent of agents) {
    const t = activeByAgent.get(agent);
    lines.push(`  ${agent}:`);
    lines.push(`    ticketId: ${yamlEscape(t.ticketId)}`);
    lines.push(`    status: ${yamlEscape(t.status)}`);
    lines.push(`    updatedUtc: ${yamlEscape(t.updatedUtc)}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderActiveMd({ activeByAgent }) {
  const agents = Array.from(activeByAgent.keys()).sort();
  const lines = [];
  lines.push('# Active Tickets');
  lines.push('');
  lines.push('| Agent | Ticket ID | Status | Updated (UTC) |');
  lines.push('|------:|-----------|--------|--------------|');
  for (const agent of agents) {
    const t = activeByAgent.get(agent);
    lines.push(`| ${agent}     | ${t.ticketId} | ${t.status ?? ''} | ${t.updatedUtc ?? ''} |`);
  }
  lines.push('');
  return lines.join('\n');
}

async function cmdValidate({ agentsDir }) {
  const { specsByTicketId, progressByTicketId, warnings } = await loadTickets(agentsDir);
  let hasErrors = false;

  for (const warning of warnings) {
    process.stderr.write(`[warn] ${warning}\n`);
  }

  const ticketIds = Array.from(specsByTicketId.keys()).sort();
  const { activeByAgent, warnings: activeWarnings } = pickActiveByAgent({
    ticketIds,
    specsByTicketId,
    progressByTicketId,
  });
  for (const w of activeWarnings) process.stderr.write(`[warn] ${w}\n`);

  for (const ticketId of ticketIds) {
    const spec = specsByTicketId.get(ticketId);
    const progress = progressByTicketId.get(ticketId) ?? null;
    const effective = computeEffectiveTicket({ spec, progress });
    const result = validateTicketMetadata({ effective, spec, progress });

    for (const warning of result.warnings) {
      process.stderr.write(`[warn] ${ticketId}: ${warning}\n`);
    }
    for (const error of result.errors) {
      process.stderr.write(`[error] ${ticketId}: ${error}\n`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.stderr.write('Validation failed.\n');
    process.exitCode = 1;
    return;
  }

  process.stdout.write('OK\n');
}

async function cmdSyncActive({ agentsDir }) {
  const { specsByTicketId, progressByTicketId } = await loadTickets(agentsDir);

  const ticketIds = Array.from(specsByTicketId.keys()).sort();
  const { activeByAgent } = pickActiveByAgent({ ticketIds, specsByTicketId, progressByTicketId });

  const generatedUtc = utcNowCompact();
  const yaml = renderActiveYaml({ generatedUtc, activeByAgent });
  const md = renderActiveMd({ activeByAgent });

  await fsp.writeFile(path.join(agentsDir, 'active-tickets.yaml'), yaml, 'utf8');
  await fsp.writeFile(path.join(agentsDir, 'active-tickets.md'), md, 'utf8');

  process.stdout.write(`Wrote ${path.join(agentsDir, 'active-tickets.yaml')}\n`);
  process.stdout.write(`Wrote ${path.join(agentsDir, 'active-tickets.md')}\n`);
}

async function cmdSummary({ agentsDir, ticketId }) {
  const { specsByTicketId, progressByTicketId } = await loadTickets(agentsDir);
  const spec = specsByTicketId.get(ticketId);
  const progress = progressByTicketId.get(ticketId) ?? null;
  if (!spec) throw new Error(`No spec found for ticketId "${ticketId}"`);

  const effective = computeEffectiveTicket({ spec, progress });

  const lines = [];
  lines.push(`ticketId: ${effective.ticketId}`);
  lines.push(`assignee: ${effective.assignee ?? ''}`);
  lines.push(`status: ${effective.status ?? ''}`);
  lines.push(`updatedUtc: ${effective.updatedUtc ?? ''}`);
  if (effective.branch) lines.push(`branch: ${effective.branch}`);
  if (effective.headCommit) lines.push(`headCommit: ${effective.headCommit}`);
  if (effective.verificationNotes) lines.push(`verification.notes: ${effective.verificationNotes}`);

  process.stdout.write(lines.join('\n') + '\n');
}

async function main() {
  const repoRoot = process.cwd();
  const agentsDir = await discoverAgentsDir(repoRoot);

  const command = process.argv[2];
  if (!command || command === '-h' || command === '--help') {
    usage();
    return;
  }

  try {
    if (command === 'validate') {
      await cmdValidate({ agentsDir });
      return;
    }
    if (command === 'sync-active') {
      await cmdSyncActive({ agentsDir });
      return;
    }
    if (command === 'summary') {
      const ticketId = process.argv[3];
      if (!ticketId) throw new Error('Missing ticketId argument');
      await cmdSummary({ agentsDir, ticketId });
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (err) {
    fatal(err?.message ?? String(err));
  }
}

await main();
