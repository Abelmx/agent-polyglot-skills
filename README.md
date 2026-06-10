# Agent Polyglot Skills

`agent-polyglot-skills` is a local `npx` installer for agent skills that help Codex, Claude Code, and OpenClaw use the Polyglot eval service.

The first bundled skill is `polyglot-service-client`. It is specific to the Polyglot evaluation service: service auth, profiles, run submission, reviews, eval_vis archives, and request-scoped `codex_auth`. It is not a general-purpose skill and is not recommended for user/admin-level installs unless you intentionally want every session to see this Polyglot-specific workflow.

## Commands

```bash
agent-polyglot-skills list
agent-polyglot-skills where --harness codex
agent-polyglot-skills install polyglot-service-client --harness codex --dry-run
```

Supported harnesses:

- `codex`
- `claude-code`
- `openclaw`

Supported options:

- `--scope project|workspace|user`
- `--project-dir <dir>`
- `--force`
- `--dry-run`
- `--json`

## Install Targets

Default scopes:

- Codex: project scope
- Claude Code: project scope
- OpenClaw: workspace scope

Resolved targets:

- Codex project: `<project-dir>/.agents/skills/polyglot-service-client`
- Codex user: `${CODEX_HOME:-~/.codex}/skills/polyglot-service-client`
- Claude Code project: `<project-dir>/.claude/skills/polyglot-service-client`
- Claude Code user: `~/.claude/skills/polyglot-service-client`
- OpenClaw project: `<project-dir>/skills/polyglot-service-client`
- OpenClaw workspace: `$(openclaw skills list --json).workspaceDir/skills/polyglot-service-client`; fallback `${OPENCLAW_STATE_DIR:-~/.openclaw}/workspace/skills/polyglot-service-client`
- OpenClaw user/shared: `${OPENCLAW_STATE_DIR:-~/.openclaw}/skills/polyglot-service-client`

For project-scope installs, run the command from the target project directory or pass `--project-dir`. If `--project-dir` is omitted for project scope, the installer uses the current working directory.

## Local npx Examples

Set `PKG_DIR` to this checkout. Replace it if your checkout is elsewhere.

```bash
PKG_DIR=/home/maoxin/ClawsQuest/_local/agent-polyglot-skills

# Inspect bundled skills.
npx --yes "file:$PKG_DIR" list

# Codex project install. Prefer cd into the target repo first.
cd "$REPO_DIR"
npx --yes "file:$PKG_DIR" install polyglot-service-client --harness codex --dry-run
npx --yes "file:$PKG_DIR" install polyglot-service-client --harness codex

# Claude Code project install.
cd "$REPO_DIR"
npx --yes "file:$PKG_DIR" install polyglot-service-client --harness claude-code --project-dir "$PWD"

# OpenClaw workspace install.
npx --yes "file:$PKG_DIR" install polyglot-service-client --harness openclaw
```

Use `--force` only when replacing an existing installed copy:

```bash
npx --yes "file:$PKG_DIR" install polyglot-service-client --harness codex --force
```

Use `--json` for scripts:

```bash
npx --yes "file:$PKG_DIR" where --harness openclaw --json
```

## Notes

The installer refuses to overwrite an existing target unless `--force` is set. It also fails if the bundled source skill directory is missing.

Project/workspace installs are preferred. User/shared installs are supported for maintainers, but they make this Polyglot eval-service-specific workflow visible outside the intended project context.

---

# Agent Polyglot Skills（中文）

`agent-polyglot-skills` 是一个本地 `npx` 安装器，用来把面向 Polyglot 评测服务的 agent skills 安装到 Codex、Claude Code 和 OpenClaw 的本地 skill 目录。

当前内置的第一个 skill 是 `polyglot-service-client`。它只面向 Polyglot eval service：服务鉴权、profiles 查询、提交 run、review、eval_vis archive，以及 request-scoped `codex_auth`。它不是通用 skill，不建议安装到 user/admin 级别，除非你明确希望所有会话都看到这套 Polyglot 专用流程。

## 命令

```bash
agent-polyglot-skills list
agent-polyglot-skills where --harness codex
agent-polyglot-skills install polyglot-service-client --harness codex --dry-run
```

支持的 harness：

- `codex`
- `claude-code`
- `openclaw`

支持的选项：

- `--scope project|workspace|user`
- `--project-dir <dir>`
- `--force`
- `--dry-run`
- `--json`

## 安装目标

默认 scope：

- Codex：project scope
- Claude Code：project scope
- OpenClaw：workspace scope

目标目录：

- Codex project：`<project-dir>/.agents/skills/polyglot-service-client`
- Codex user：`${CODEX_HOME:-~/.codex}/skills/polyglot-service-client`
- Claude Code project：`<project-dir>/.claude/skills/polyglot-service-client`
- Claude Code user：`~/.claude/skills/polyglot-service-client`
- OpenClaw project：`<project-dir>/skills/polyglot-service-client`
- OpenClaw workspace：`$(openclaw skills list --json).workspaceDir/skills/polyglot-service-client`；fallback `${OPENCLAW_STATE_DIR:-~/.openclaw}/workspace/skills/polyglot-service-client`
- OpenClaw user/shared：`${OPENCLAW_STATE_DIR:-~/.openclaw}/skills/polyglot-service-client`

project scope 安装时，请先 `cd` 到目标项目目录，或显式传入 `--project-dir`。如果 project scope 没有提供 `--project-dir`，安装器会使用当前工作目录。

## 本地 npx 示例

将 `PKG_DIR` 设为当前 checkout。若你的 checkout 路径不同，请替换它。

```bash
PKG_DIR=/home/maoxin/ClawsQuest/_local/agent-polyglot-skills

# 查看内置 skills。
npx --yes "file:$PKG_DIR" list

# 安装到 Codex project。建议先 cd 到目标项目。
cd "$REPO_DIR"
npx --yes "file:$PKG_DIR" install polyglot-service-client --harness codex --dry-run
npx --yes "file:$PKG_DIR" install polyglot-service-client --harness codex

# 安装到 Claude Code project。
cd "$REPO_DIR"
npx --yes "file:$PKG_DIR" install polyglot-service-client --harness claude-code --project-dir "$PWD"

# 安装到 OpenClaw workspace。
npx --yes "file:$PKG_DIR" install polyglot-service-client --harness openclaw
```

只有在确认要替换已有安装时才使用 `--force`：

```bash
npx --yes "file:$PKG_DIR" install polyglot-service-client --harness codex --force
```

脚本场景可使用 `--json`：

```bash
npx --yes "file:$PKG_DIR" where --harness openclaw --json
```

## 说明

如果目标目录已经存在，安装器会拒绝覆盖，除非设置 `--force`。如果内置 source skill 目录不存在，安装器也会失败。

优先使用 project/workspace 安装。user/shared 安装只建议维护者使用，因为它会让这套 Polyglot eval-service 专用流程出现在目标项目之外。
