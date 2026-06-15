# Agent-Polyglot Pipeline and Benchmark

Use this reference when a user asks what agent-polyglot evaluates, how to choose a task set, what a task ID means, or why the API requires a harness.

## What the Pipeline Evaluates

Agent-polyglot evaluates how an LLM or vLLM performs as an agent when it is driven through different agent harnesses:

- `openclaw`
- `claude_code`
- `codex`

The model is the unit under test. The harness is the execution surface: it controls the CLI/SDK, tool semantics, workspace layout, skill discovery, native subagent behavior, and provider configuration path. The goal is to measure whether a model can remain effective across "polyglot" harness environments, not only inside one preferred agent runtime.

The lightweight service is a hosted control plane for this pipeline. It submits runs, reviews, archives, and eval_vis exports, while the underlying benchmark and graders remain task-driven.

## What an Evaluation Run Does

A run evaluates a selected model under a selected harness on one or more tasks.

At task level, the pipeline:

1. Reads the task contract from `task.yaml`.
2. Creates an isolated project/workspace for that task.
3. Seeds the workspace with declared files such as `workspace/`, `bootstrap/`, skills, fixtures, mocks, memory, or harness-specific instructions.
4. Starts an agent session under the selected harness.
5. Sends the task prompt or scripted interaction to the agent.
6. Lets the model complete the task contract by inspecting files, calling tools, modifying the workspace, coordinating mocks, and writing required artifacts.
7. Captures execution evidence such as `messages.json`, `trace.jsonl`, final artifacts, mock side effects, and harness logs.
8. Runs the task grader, oracle, static ground truth, strict policy gates, or judge rubric declared by the task.
9. Produces score artifacts such as `score.json`, `grading_log.json`, and service-visible job/run metadata.

The service can then start a Codex review job, archive the run, and transform archived results into eval_vis frontend data.

## Why the Harness Must Be Selected

The same model can behave differently under different harnesses. Harness choice affects:

- how the model receives the task contract
- which tools and CLI affordances are available
- how skills are installed and discovered
- whether native subagents are available
- how workspaces, logs, traces, and auth are isolated
- which provider/proxy configuration is injected at run time

Task authors declare `harness_compatibility` in `task.yaml`. A task is only cross-harness when it has been explicitly reviewed for those harnesses. Use the service's live task list before submitting:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/tasks" \
  -H "Authorization: Bearer $POLYGLOT_SERVICE_API_KEY"
```

Use the exact API harness names: `openclaw`, `claude_code`, and `codex`.

## Task IDs, Axes, and Task Sets

Task IDs follow the shape `<axis><level>-<sequence>`, for example:

- `A1-01`: axis A, level L1, sequence 01
- `D3-07`: axis D, level L3, sequence 07
- `A4-03`: axis A, level L4, sequence 03

`A1-01` is a task ID, not a difficulty filter. To list that family through the service, use `difficulty=L1` and `category=A`.

The benchmark uses seven capability axes:

| Axis | Focus |
| --- | --- |
| A | Information retrieval and research |
| B | Content creation and editing |
| C | Communication and collaboration |
| D | Code and engineering |
| E | Workflow and scheduling automation |
| F | Data processing and analysis |
| G | Safety and alignment |

`L1`-`L3` are commonly treated as the `core` task set. `L4` is commonly treated as the `frontier` task set. Archive and eval_vis service requests use this through the `tier` field, but run task selection still happens through fields such as `tasks`, `difficulty`, `category`, or the concrete endpoint's documented filters. Check `references/api.md` and live API docs before composing the request body.

Do not assume the local task count is fixed. The benchmark is actively updated, so always query `/v1/tasks` when selecting real run inputs.

## L1-L3 Core Benchmark

Use L1-L3 for broad regression coverage, cheaper model sweeps, and smoke checks across harnesses.

L1 focuses on baseline agent reliability:

- understanding a direct task instruction
- using basic local or system tools correctly
- producing a required file or structured artifact
- following output schemas without unnecessary exploration

L2 focuses on multi-step execution:

- coordinating multiple tools or files
- writing or editing code/tests/data artifacts
- tracking intermediate state
- validating work before final output
- handling richer workspace context than L1

L3 focuses on autonomous task completion:

- planning longer workflows
- interacting with mock services or externalized APIs
- recovering from failed checks or partial side effects
- making go/no-go or prioritization decisions from evidence
- respecting safety, policy, and sequencing constraints

L1-L3 are usually suitable for flash/throughput model evaluation, for example Gemini Flash-class or Intern S2 preview-class models. They are also useful for verifying a new proxy, profile, harness installation, or service deployment before spending budget on frontier tasks. Submit the exact service model string from `/v1/profiles`, for example `provider/model_id`.

## L4 Frontier Benchmark

Use L4 for frontier agent evaluation. These tasks are designed to separate stronger models on behaviors that simpler single-session runs often miss.

L4 tasks can include one to three of these high-difficulty categories:

- Multi-turn user-prompt tasks: later turns can add constraints, change policy context, release new evidence, or require the agent to revise earlier plans without losing state.
- Multi-session tasks: the benchmark starts multiple isolated sessions, and the model must preserve useful context through artifacts, ledgers, memory, handoff notes, or structured state.
- Subagent delegation tasks: the model must decompose work, delegate bounded tracks to native subagents or OpenClaw task agents, supervise outputs, and integrate a final answer.

L4 tasks often use `contract_schema: 3` with `interaction.mode` values such as `scripted-multiturn` or `scripted-multisession`, and may declare SDK delegation requirements such as `required_tracks`, `min_subagents`, or `require_native_subagent`.

L4 is best reserved for pro/frontier model families, for example GPT-5.5-class or Claude Opus 4.8-class models. It is not the cheapest smoke-test path; use it when the question is whether a model can handle long-horizon, cross-session, multi-agent, policy-aware work. Submit configured provider models exactly as listed by `/v1/profiles`, or use the documented built-in `openai/gpt5.5` Codex-auth route when the run path supports it.

## Choosing a Run Shape

Use this default decision path:

1. Query live profiles and tasks.
2. Choose the harness first, based on the agent runtime you want to evaluate.
3. Filter tasks by `harness_compatibility`, level, and axis.
4. Use L1-L3/core for smoke tests, broad sweeps, or flash-class models.
5. Use L4/frontier for pro-class models and capability investigations.
6. Keep model names in `provider/model_id` form and prefer live `/v1/profiles` over bundled snapshots.

For OpenAI official proxy routes such as `openai/gpt5.5`, Codex harness runs, OpenClaw runs through the built-in OpenAI/Codex route, or Codex review, pass request-scoped `codex_auth` when using personal quota. The service does not persist that auth after the run/review.
