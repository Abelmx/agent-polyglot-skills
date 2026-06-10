'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SKILL = 'polyglot-service-client';

const SKILLS = {
  [DEFAULT_SKILL]: {
    name: DEFAULT_SKILL,
    description: 'Polyglot eval-service client workflows for runs, reviews, archives, profiles, and codex_auth.',
    sourcePath: path.join(PACKAGE_ROOT, 'skills', DEFAULT_SKILL)
  }
};

const HARNESSES = {
  codex: {
    name: 'codex',
    displayName: 'Codex',
    defaultScope: 'user',
    scopes: ['project', 'user']
  },
  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    defaultScope: 'user',
    scopes: ['project', 'user']
  },
  openclaw: {
    name: 'openclaw',
    displayName: 'OpenClaw',
    defaultScope: 'user',
    scopes: ['project', 'workspace', 'user']
  }
};

const BOOLEAN_FLAGS = new Set(['dryRun', 'force', 'help', 'json', 'version']);
const VALUE_FLAGS = new Set(['harness', 'projectDir', 'scope', 'skill']);
const ALL_FLAGS = new Set([...BOOLEAN_FLAGS, ...VALUE_FLAGS]);

class CliError extends Error {
  constructor(message, code = 'error', exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

function run(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;

  try {
    const result = execute(argv, {
      cwd: io.cwd || process.cwd(),
      env: io.env || process.env,
      homeDir: io.homeDir || os.homedir()
    });

    if (result.text) {
      stdout.write(ensureTrailingNewline(result.text));
    }

    return result.exitCode || 0;
  } catch (error) {
    const exitCode = error.exitCode || 1;
    if (wantsJson(argv)) {
      stdout.write(JSON.stringify({
        ok: false,
        error: {
          code: error.code || 'error',
          message: error.message
        }
      }) + '\n');
    } else {
      stderr.write(`Error: ${error.message}\n`);
    }
    return exitCode;
  }
}

function execute(argv, runtime = {}) {
  const context = {
    cwd: runtime.cwd || process.cwd(),
    env: runtime.env || process.env,
    homeDir: runtime.homeDir || os.homedir()
  };
  const parsed = parseArgs(argv);
  const positionals = [...parsed.positionals];
  const command = positionals.shift();

  if (parsed.version) {
    return textResult(packageVersion());
  }

  if (!command || command === 'help' || parsed.help) {
    return textResult(helpText());
  }

  switch (command) {
    case 'list':
      assertNoPositionals(positionals, 'list');
      return listCommand(parsed);
    case 'where':
      return whereCommand(parsed, positionals, context);
    case 'install':
      return installCommand(parsed, positionals, context);
    default:
      throw new CliError(`Unknown command "${command}". Run "agent-polyglot-skills --help".`, 'unknown_command');
  }
}

function listCommand(parsed) {
  assertUnsupportedFlags(parsed, ['json'], 'list');
  const skills = Object.values(SKILLS).map((skill) => ({
    name: skill.name,
    description: skill.description,
    source: skill.sourcePath,
    sourceExists: isDirectory(skill.sourcePath)
  }));
  const harnesses = Object.values(HARNESSES).map((harness) => ({
    name: harness.name,
    displayName: harness.displayName,
    defaultScope: harness.defaultScope,
    scopes: harness.scopes
  }));

  if (parsed.json) {
    return jsonResult({ ok: true, skills, harnesses });
  }

  const lines = [
    'Skills:',
    ...skills.map((skill) => `  ${skill.name} - ${skill.description}`),
    '',
    'Harnesses:',
    ...harnesses.map((harness) => `  ${harness.name} - default scope: ${harness.defaultScope}; scopes: ${harness.scopes.join(', ')}`)
  ];
  return textResult(lines.join('\n'));
}

function whereCommand(parsed, positionals, runtime) {
  assertUnsupportedFlags(parsed, ['harness', 'json', 'projectDir', 'scope', 'skill'], 'where');
  const plan = resolvePlan(parsed, positionals, runtime);
  const payload = formatPlanPayload(plan);

  if (parsed.json) {
    return jsonResult({ ok: true, ...payload });
  }

  return textResult([
    `Skill: ${payload.skill}`,
    `Harness: ${payload.harness}`,
    `Scope: ${payload.scope}`,
    payload.projectDir ? `Project dir: ${payload.projectDir}${payload.projectDirDefaulted ? ' (cwd default)' : ''}` : null,
    `Source: ${payload.source} (${payload.sourceExists ? 'found' : 'missing'})`,
    `Target: ${payload.target}`,
    `Target exists: ${payload.targetExists ? 'yes' : 'no'}`
  ].filter(Boolean).join('\n'));
}

function installCommand(parsed, positionals, runtime) {
  assertUnsupportedFlags(parsed, ['dryRun', 'force', 'harness', 'json', 'projectDir', 'scope', 'skill'], 'install');
  const plan = resolvePlan(parsed, positionals, runtime);
  assertSourceAvailable(plan.source);
  assertSafeInstallTarget(plan.source, plan.target);

  const targetExists = fs.existsSync(plan.target);
  if (targetExists && !parsed.force) {
    throw new CliError(`Target already exists: ${plan.target}. Use --force to replace it.`, 'target_exists');
  }

  const action = targetExists && parsed.force ? 'replace' : 'install';
  if (!parsed.dryRun) {
    fs.mkdirSync(path.dirname(plan.target), { recursive: true });
    if (targetExists) {
      fs.rmSync(plan.target, { recursive: true, force: true });
    }
    fs.cpSync(plan.source, plan.target, { recursive: true });
  }

  const payload = {
    ...formatPlanPayload(plan),
    dryRun: Boolean(parsed.dryRun),
    force: Boolean(parsed.force),
    action,
    installed: !parsed.dryRun
  };

  if (parsed.json) {
    return jsonResult({ ok: true, ...payload });
  }

  const verb = parsed.dryRun ? `Dry run: would ${action}` : action === 'replace' ? 'Replaced' : 'Installed';
  return textResult([
    `${verb} ${payload.skill} for ${payload.harness} (${payload.scope}).`,
    `Source: ${payload.source}`,
    `Target: ${payload.target}`
  ].join('\n'));
}

function resolvePlan(parsed, positionals, runtime) {
  const { skill, harness } = resolveSkillAndHarness(parsed, positionals);
  const scope = parsed.scope || (parsed.projectDir ? 'project' : harness.defaultScope);

  if (!harness.scopes.includes(scope)) {
    throw new CliError(`Scope "${scope}" is not supported for ${harness.name}. Supported scopes: ${harness.scopes.join(', ')}.`, 'unsupported_scope');
  }

  if (parsed.projectDir && scope !== 'project') {
    throw new CliError('--project-dir is only valid with --scope project.', 'invalid_project_dir');
  }
  if (scope === 'project' && !parsed.projectDir) {
    throw new CliError('--project-dir is required for project scope.', 'missing_project_dir');
  }

  const projectDirDefaulted = false;
  const projectDir = scope === 'project'
    ? resolvePath(parsed.projectDir, runtime.cwd, runtime.homeDir)
    : null;
  const target = targetPathFor({
    harness: harness.name,
    scope,
    skill: skill.name,
    projectDir,
    env: runtime.env,
    cwd: runtime.cwd,
    homeDir: runtime.homeDir
  });

  return {
    skill: skill.name,
    harness: harness.name,
    scope,
    source: skill.sourcePath,
    target,
    projectDir,
    projectDirDefaulted
  };
}

function resolveSkill(input) {
  const name = input || DEFAULT_SKILL;
  const skill = SKILLS[name];
  if (!skill) {
    throw new CliError(`Unknown skill "${name}". Available skills: ${Object.keys(SKILLS).join(', ')}.`, 'unknown_skill');
  }
  return skill;
}

function resolveSkillAndHarness(parsed, positionals) {
  let skill = resolveSkill(parsed.skill);
  let harnessName = parsed.harness ? normalizeHarness(parsed.harness) : null;

  for (const positional of positionals) {
    const harnessCandidate = maybeNormalizeHarness(positional);
    if (SKILLS[positional]) {
      if (parsed.skill && parsed.skill !== positional) {
        throw new CliError(`Unexpected skill "${positional}". Skill is already set with --skill ${parsed.skill}.`, 'unexpected_argument');
      }
      skill = resolveSkill(positional);
      continue;
    }
    if (harnessCandidate) {
      if (harnessName && harnessName !== harnessCandidate) {
        throw new CliError(`Unexpected harness "${positional}". Harness is already set with --harness ${parsed.harness}.`, 'unexpected_argument');
      }
      harnessName = harnessCandidate;
      continue;
    }
    throw new CliError(`Unexpected argument "${positional}".`, 'unexpected_argument');
  }

  if (!harnessName) {
    throw new CliError('Missing harness. Use --harness codex, --harness claude-code, or --harness openclaw.', 'missing_harness');
  }

  return {
    skill,
    harness: HARNESSES[harnessName]
  };
}

function normalizeHarness(value) {
  const normalized = maybeNormalizeHarness(value);
  if (normalized) {
    return normalized;
  }
  throw new CliError(`Unsupported harness "${value}". Supported harnesses: codex, claude-code, openclaw.`, 'unsupported_harness');
}

function maybeNormalizeHarness(value) {
  const normalized = String(value).trim().toLowerCase().replace(/_/g, '-');
  if (normalized === 'claude' || normalized === 'claudecode' || normalized === 'claude-code') {
    return 'claude-code';
  }
  if (normalized === 'codex' || normalized === 'openclaw') {
    return normalized;
  }
  return null;
}

function targetPathFor({ harness, scope, skill, projectDir, env, cwd, homeDir }) {
  if (harness === 'codex') {
    if (scope === 'project') {
      return path.join(projectDir, '.agents', 'skills', skill);
    }
    return path.join(resolveEnvDir(env.CODEX_HOME, path.join(homeDir, '.codex'), cwd, homeDir), 'skills', skill);
  }

  if (harness === 'claude-code') {
    if (scope === 'project') {
      return path.join(projectDir, '.claude', 'skills', skill);
    }
    return path.join(homeDir, '.claude', 'skills', skill);
  }

  if (harness === 'openclaw') {
    if (scope === 'project') {
      return path.join(projectDir, 'skills', skill);
    }
    if (scope === 'workspace') {
      return path.join(resolveOpenClawWorkspaceDir({ env, cwd, homeDir }), 'skills', skill);
    }
    const stateDir = resolveEnvDir(env.OPENCLAW_STATE_DIR, path.join(homeDir, '.openclaw'), cwd, homeDir);
    return path.join(stateDir, 'skills', skill);
  }

  throw new CliError(`Unsupported harness "${harness}".`, 'unsupported_harness');
}

function formatPlanPayload(plan) {
  return {
    skill: plan.skill,
    harness: plan.harness,
    scope: plan.scope,
    projectDir: plan.projectDir,
    projectDirDefaulted: plan.projectDirDefaulted,
    source: plan.source,
    sourceExists: isDirectory(plan.source),
    target: plan.target,
    targetExists: fs.existsSync(plan.target)
  };
}

function parseArgs(argv) {
  const parsed = {
    positionals: []
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--') {
      parsed.positionals.push(...argv.slice(i + 1));
      break;
    }

    if (token === '-h') {
      parsed.help = true;
      continue;
    }

    if (token.startsWith('--')) {
      const { key, value, hasInlineValue } = parseLongFlag(token);
      if (!ALL_FLAGS.has(key)) {
        throw new CliError(`Unknown option "--${flagNameFromKey(key)}".`, 'unknown_option');
      }

      if (BOOLEAN_FLAGS.has(key)) {
        if (hasInlineValue) {
          parsed[key] = parseBooleanValue(value, key);
        } else {
          parsed[key] = true;
        }
        continue;
      }

      if (hasInlineValue) {
        parsed[key] = value;
        continue;
      }

      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new CliError(`Option "--${flagNameFromKey(key)}" requires a value.`, 'missing_option_value');
      }
      parsed[key] = next;
      i += 1;
      continue;
    }

    parsed.positionals.push(token);
  }

  return parsed;
}

function parseLongFlag(token) {
  const raw = token.slice(2);
  const equalsIndex = raw.indexOf('=');
  const name = equalsIndex === -1 ? raw : raw.slice(0, equalsIndex);
  const value = equalsIndex === -1 ? undefined : raw.slice(equalsIndex + 1);
  return {
    key: keyFromFlagName(name),
    value,
    hasInlineValue: equalsIndex !== -1
  };
}

function parseBooleanValue(value, key) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new CliError(`Option "--${flagNameFromKey(key)}" expects true or false when a value is provided.`, 'invalid_boolean');
}

function keyFromFlagName(name) {
  return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function flagNameFromKey(key) {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function assertUnsupportedFlags(parsed, allowed, command) {
  const allowedSet = new Set(allowed);
  for (const key of ALL_FLAGS) {
    if (key === 'help' || key === 'version') {
      continue;
    }
    if (parsed[key] !== undefined && !allowedSet.has(key)) {
      throw new CliError(`Option "--${flagNameFromKey(key)}" is not supported by "${command}".`, 'unsupported_option');
    }
  }
}

function assertNoPositionals(positionals, command) {
  if (positionals.length > 0) {
    throw new CliError(`Command "${command}" does not accept "${positionals[0]}".`, 'unexpected_argument');
  }
}

function assertSourceAvailable(sourcePath) {
  if (!isDirectory(sourcePath)) {
    throw new CliError(`Source skill is missing: ${sourcePath}`, 'source_missing');
  }
}

function assertSafeInstallTarget(sourcePath, targetPath) {
  const source = fs.realpathSync(sourcePath);
  const target = canonicalPathForSafety(targetPath);

  if (source === target) {
    throw new CliError(`Unsafe target: target is the bundled source skill directory (${target}).`, 'unsafe_target');
  }
  if (isPathInside(target, source)) {
    throw new CliError(`Unsafe target: target is inside the bundled source skill directory (${source}).`, 'unsafe_target');
  }
  if (isPathInside(source, target)) {
    throw new CliError(`Unsafe target: target contains the bundled source skill directory (${source}).`, 'unsafe_target');
  }
}

function isPathInside(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function canonicalPathForSafety(candidatePath) {
  const absolutePath = path.resolve(candidatePath);
  try {
    return fs.realpathSync(absolutePath);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error;
    }
  }

  const segments = [path.basename(absolutePath)];
  let parent = path.dirname(absolutePath);
  while (!fs.existsSync(parent)) {
    const nextParent = path.dirname(parent);
    if (nextParent === parent) {
      return absolutePath;
    }
    segments.unshift(path.basename(parent));
    parent = nextParent;
  }
  return path.join(fs.realpathSync(parent), ...segments);
}

function isDirectory(candidate) {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function resolveEnvDir(value, fallback, cwd, homeDir) {
  return resolvePath(value || fallback, cwd, homeDir);
}

function resolveOpenClawWorkspaceDir({ env, cwd, homeDir }) {
  const workspaceDir = readOpenClawWorkspaceDir(env, cwd);
  if (workspaceDir) {
    return resolvePath(workspaceDir, cwd, homeDir);
  }

  const stateDir = resolveEnvDir(env.OPENCLAW_STATE_DIR, path.join(homeDir, '.openclaw'), cwd, homeDir);
  return path.join(stateDir, 'workspace');
}

function readOpenClawWorkspaceDir(env, cwd) {
  try {
    const output = childProcess.execFileSync(
      'openclaw',
      ['skills', 'list', '--json'],
      {
        cwd,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 15000
      }
    );
    const payload = JSON.parse(output);
    if (payload && typeof payload.workspaceDir === 'string' && payload.workspaceDir.trim()) {
      return payload.workspaceDir.trim();
    }
  } catch (_error) {
    return null;
  }
  return null;
}

function resolvePath(value, cwd, homeDir) {
  const expanded = expandHome(String(value), homeDir);
  return path.resolve(cwd, expanded);
}

function expandHome(value, homeDir) {
  if (value === '~') {
    return homeDir;
  }
  if (value.startsWith('~/')) {
    return path.join(homeDir, value.slice(2));
  }
  return value;
}

function wantsJson(argv) {
  return argv.some((arg) => arg === '--json' || arg.startsWith('--json='));
}

function jsonResult(payload) {
  return textResult(JSON.stringify(payload, null, 2));
}

function textResult(text) {
  return {
    exitCode: 0,
    text
  };
}

function ensureTrailingNewline(text) {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function packageVersion() {
  return require(path.join(PACKAGE_ROOT, 'package.json')).version;
}

function helpText() {
  return [
    'agent-polyglot-skills',
    '',
    'Install agent-polyglot skill collection entries into supported harness skill directories.',
    '',
    'Usage:',
    '  agent-polyglot-skills list [--json]',
    '  agent-polyglot-skills where [skill] --harness <codex|claude-code|openclaw> [--scope <scope>] [--project-dir <dir>] [--json]',
    '  agent-polyglot-skills install [skill] --harness <codex|claude-code|openclaw> [--scope <scope>] [--project-dir <dir>] [--force] [--dry-run] [--json]',
    '',
    'Commands:',
    '  list      Show bundled skills and supported harnesses.',
    '  where     Show the resolved source and target directory.',
    '  install   Copy the skill into the resolved target directory.',
    '',
    'Options:',
    '  --harness <name>       codex, claude-code, or openclaw. Positional form is also accepted.',
    '  --scope <scope>        project, workspace, or user depending on harness.',
    '  --project-dir <dir>    Install into this project. Implies --scope project when --scope is omitted.',
    '  --force                Replace an existing target skill directory.',
    '  --dry-run              Validate and print what install would do without copying.',
    '  --json                 Print machine-readable JSON.',
    '  -h, --help             Show this help.',
    '  --version              Show package version.',
    '',
    'Default user/shared targets when --project-dir is omitted:',
    '  codex        ${CODEX_HOME:-~/.codex}/skills/polyglot-service-client',
    '  claude-code  ~/.claude/skills/polyglot-service-client',
    '  openclaw     ${OPENCLAW_STATE_DIR:-~/.openclaw}/skills/polyglot-service-client',
    '',
    'Project targets when --project-dir is set:',
    '  codex        <project-dir>/.agents/skills/polyglot-service-client',
    '  claude-code  <project-dir>/.claude/skills/polyglot-service-client',
    '  openclaw     <project-dir>/skills/polyglot-service-client',
    '',
    'Advanced OpenClaw workspace target:',
    '  openclaw --scope workspace  $(openclaw skills list --json).workspaceDir/skills/polyglot-service-client',
    '                              fallback: ${OPENCLAW_STATE_DIR:-~/.openclaw}/workspace/skills/polyglot-service-client'
  ].join('\n');
}

module.exports = {
  execute,
  run,
  targetPathFor
};
