# Agent Polyglot Skills

English documentation: [README.md](README.md)

`agent-polyglot-skills` 是面向 `agent-polyglot` 跨 harness 评测管线的 skills collection。它提供一组领域专用 agent skills，用于在 Codex、Claude Code 和 OpenClaw 中调用 Polyglot 评测服务、处理归档、review 和 run metadata。

这个仓库不是通用 skill 库。这里的 skills 主要服务于通过 `agent-polyglot` 评测 LLM/vLLM 的工作流，因此通常推荐安装到项目级别。user 级别安装也支持，但会让这套 Polyglot 专用流程出现在无关会话中。

## 当前包含的 Skills

- `polyglot-service-client`：调用轻量 Polyglot 评测服务，查询 profiles/proxies/models，提交 run 和 review，归档到 eval_vis，并安全传递 request-scoped `codex_auth`。

## 使用 npx 安装

正常使用时直接使用 npm 托管的包，不需要先 clone 这个仓库。

推荐安装到项目级别：

```bash
REPO_DIR=/path/to/your/eval-or-agent-polyglot-project

npx --yes agent-polyglot-skills install polyglot-service-client --harness codex --project-dir "$REPO_DIR"
npx --yes agent-polyglot-skills install polyglot-service-client --harness claude-code --project-dir "$REPO_DIR"
npx --yes agent-polyglot-skills install polyglot-service-client --harness openclaw --project-dir "$REPO_DIR"
```

如果省略 `--project-dir`，安装器默认使用 user/shared scope：

```bash
npx --yes agent-polyglot-skills install polyglot-service-client --harness codex
npx --yes agent-polyglot-skills install polyglot-service-client --harness claude-code
npx --yes agent-polyglot-skills install polyglot-service-client --harness openclaw
```

安装前可查看可用 skills 和目标路径：

```bash
npx --yes agent-polyglot-skills list
npx --yes agent-polyglot-skills where polyglot-service-client --harness codex --project-dir "$REPO_DIR"
npx --yes agent-polyglot-skills where polyglot-service-client --harness openclaw --json
```

只有在确认要替换已有安装时才使用 `--force`：

```bash
npx --yes agent-polyglot-skills install polyglot-service-client --harness codex --project-dir "$REPO_DIR" --force
```

## 安装目标

设置 `--project-dir` 时：

- Codex：`<project-dir>/.agents/skills/polyglot-service-client`
- Claude Code：`<project-dir>/.claude/skills/polyglot-service-client`
- OpenClaw：`<project-dir>/skills/polyglot-service-client`

省略 `--project-dir` 时：

- Codex：`${CODEX_HOME:-~/.codex}/skills/polyglot-service-client`
- Claude Code：`~/.claude/skills/polyglot-service-client`
- OpenClaw：`${OPENCLAW_STATE_DIR:-~/.openclaw}/skills/polyglot-service-client`

如果确实需要 OpenClaw workspace 级别安装，也可以显式指定：

```bash
npx --yes agent-polyglot-skills install polyglot-service-client --harness openclaw --scope workspace
```

## 运行时配置

skill 不包含服务凭据。使用 `polyglot-service-client` 的 session 应配置：

```bash
export POLYGLOT_SERVICE_BASE_URL="http://<service-host>:<port>"
export POLYGLOT_SERVICE_API_KEY="<ask-service-provider>"
```

如果使用官方 OpenAI/Codex 配额，请在请求级别传入 `codex_auth`。服务会把这个 auth 作为 run/review-level material 使用，不会将其保存为服务器配置。

## 维护者说明

npm 发布前的本地开发可使用：

```bash
npx --yes file:/home/maoxin/ClawsQuest/_local/agent-polyglot-skills list
```

当前 package 暴露了一个很小的 installer entrypoint，方便 `npx` 将内置 skill 文件夹复制到不同 harness 的原生 skill 目录。真正的产品面是 skills collection，installer 只是分发机制。
