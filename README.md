# Agent Polyglot Skills

Chinese documentation: [README.zh-CN.md](README.zh-CN.md)

`agent-polyglot-skills` is a skills collection for the `agent-polyglot` cross-harness evaluation pipeline. It provides domain-specific agent skills for working with Polyglot evaluation services, archives, reviews, and run metadata across Codex, Claude Code, and OpenClaw.

This repository is not meant to be a general-purpose skill library. The skills are for evaluating LLM/vLLM systems through `agent-polyglot`, so project-level installation is usually the right choice. User-level installation is supported, but it makes this Polyglot-specific workflow visible in unrelated sessions.

## Included Skills

- `polyglot-service-client`: call the lightweight Polyglot evaluation service, discover profiles/proxies/models, submit runs and reviews, archive to eval_vis, and pass request-scoped `codex_auth` safely.

## Install With npx

Use the npm-hosted package directly. You do not need to clone this repository for normal use.

Project-level install is recommended:

```bash
REPO_DIR=/path/to/your/eval-or-agent-polyglot-project

npx --yes agent-polyglot-skills install polyglot-service-client --harness codex --project-dir "$REPO_DIR"
npx --yes agent-polyglot-skills install polyglot-service-client --harness claude-code --project-dir "$REPO_DIR"
npx --yes agent-polyglot-skills install polyglot-service-client --harness openclaw --project-dir "$REPO_DIR"
```

If `--project-dir` is omitted, the installer defaults to user/shared scope:

```bash
npx --yes agent-polyglot-skills install polyglot-service-client --harness codex
npx --yes agent-polyglot-skills install polyglot-service-client --harness claude-code
npx --yes agent-polyglot-skills install polyglot-service-client --harness openclaw
```

Inspect available skills and resolved targets before installing:

```bash
npx --yes agent-polyglot-skills list
npx --yes agent-polyglot-skills where polyglot-service-client --harness codex --project-dir "$REPO_DIR"
npx --yes agent-polyglot-skills where polyglot-service-client --harness openclaw --json
```

Use `--force` only when replacing an existing installed copy:

```bash
npx --yes agent-polyglot-skills install polyglot-service-client --harness codex --project-dir "$REPO_DIR" --force
```

## Install Targets

When `--project-dir` is set:

- Codex: `<project-dir>/.agents/skills/polyglot-service-client`
- Claude Code: `<project-dir>/.claude/skills/polyglot-service-client`
- OpenClaw: `<project-dir>/skills/polyglot-service-client`

When `--project-dir` is omitted:

- Codex: `${CODEX_HOME:-~/.codex}/skills/polyglot-service-client`
- Claude Code: `~/.claude/skills/polyglot-service-client`
- OpenClaw: `${OPENCLAW_STATE_DIR:-~/.openclaw}/skills/polyglot-service-client`

Advanced OpenClaw workspace install is still available when that is the intended target:

```bash
npx --yes agent-polyglot-skills install polyglot-service-client --harness openclaw --scope workspace
```

## Runtime Configuration

The skill does not contain service credentials. Sessions using `polyglot-service-client` should configure:

```bash
export POLYGLOT_SERVICE_BASE_URL="http://<service-host>:<port>"
export POLYGLOT_SERVICE_API_KEY="<ask-service-provider>"
```

For official OpenAI/Codex quota flows, pass `codex_auth` per request. The service treats this auth as run/review-level material and does not store it as server configuration.

## Maintainer Notes

For local development before npm publishing:

```bash
npx --yes file:/home/maoxin/ClawsQuest/_local/agent-polyglot-skills list
```

The package currently exposes a small installer entrypoint so `npx` can copy bundled skill folders into each harness' native skill location. The product surface is the skill collection; the installer is only distribution plumbing.
