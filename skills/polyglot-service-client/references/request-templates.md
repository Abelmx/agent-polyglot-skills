# Request Templates

All examples use `POLYGLOT_SERVICE_BASE_URL` and `POLYGLOT_SERVICE_API_KEY`. Do not paste real keys into commands or request JSON.

## Base Variables

```bash
export POLYGLOT_SERVICE_BASE_URL="http://host.example:8000"
export POLYGLOT_SERVICE_API_KEY="ask-service-provider"

: "${POLYGLOT_SERVICE_BASE_URL:?set POLYGLOT_SERVICE_BASE_URL}"
: "${POLYGLOT_SERVICE_API_KEY:?set POLYGLOT_SERVICE_API_KEY}"
AUTH=(-H "Authorization: Bearer $POLYGLOT_SERVICE_API_KEY")
JSON=(-H "Content-Type: application/json")
```

## Health and Profiles

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/health" "${AUTH[@]}"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/profiles" "${AUTH[@]}"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/profiles/default" "${AUTH[@]}"
```

## List Tasks

```bash
curl -fsS --get "$POLYGLOT_SERVICE_BASE_URL/v1/tasks" \
  "${AUTH[@]}" \
  --data-urlencode "harness=openclaw" \
  --data-urlencode "difficulty=A1"
```

## Submit a Simple Run

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/runs" \
  "${AUTH[@]}" "${JSON[@]}" \
  -d '{
    "display_name": "smoke-openclaw-a1",
    "tasks": ["A1-01"],
    "model": "proxy_a/gpt-5.4",
    "harness": "openclaw",
    "parallel": 1
  }'
```

## Submit a Run with Runtime Overrides

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/runs" \
  "${AUTH[@]}" "${JSON[@]}" \
  -d '{
    "display_name": "runtime-override",
    "tasks": ["A1-01"],
    "model": "proxy_a/gpt-5.4",
    "harness": "openclaw",
    "parallel": 2,
    "runtime_overrides": {
      "task_timeout_seconds": 1800,
      "openclaw_rerun_attempts": 0
    }
  }'
```

## Review an Existing Run

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/reviews" \
  "${AUTH[@]}" "${JSON[@]}" \
  -d '{
    "display_name": "review-existing-run",
    "run_dir": "/abs/path/to/output/run_xxx",
    "review_model": "proxy_a/gpt-5.4",
    "parallel": 1,
    "overwrite": true,
    "summary_scope": "run"
  }'
```

## Submit Run and Codex Review

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/run-and-review" \
  "${AUTH[@]}" "${JSON[@]}" \
  -d '{
    "display_name": "run-review-a1",
    "run": {
      "tasks": ["A1-01"],
      "model": "proxy_a/gpt-5.4",
      "harness": "openclaw",
      "parallel": 1
    },
    "review": {
      "review_model": "openai/gpt5.5",
      "parallel": 1,
      "overwrite": true,
      "summary_scope": "run"
    }
  }'
```

If `review_model` uses `openai/gpt5.5` and the review/job should use the user's Codex quota, inject request-scoped auth without printing it:

```bash
jq -n \
  --slurpfile auth "$HOME/.codex/auth.json" \
  '{
    display_name: "run-review-a1-user-quota",
    run: {
      tasks: ["A1-01"],
      model: "proxy_a/gpt-5.4",
      harness: "openclaw",
      parallel: 1
    },
    review: {
      review_model: "openai/gpt5.5",
      parallel: 1,
      overwrite: true,
      summary_scope: "run"
    },
    codex_auth: {
      mode: "inline_json",
      auth_json: $auth[0]
    }
  }' | curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/run-and-review" \
    "${AUTH[@]}" "${JSON[@]}" -d @-
```

## Submit Run, Review, and Archive

```bash
jq -n \
  --slurpfile auth "$HOME/.codex/auth.json" \
  '{
    display_name: "run-review-archive-a1",
    run: {
      tasks: ["A1-01"],
      model: "openai/gpt5.5",
      harness: "codex",
      parallel: 1
    },
    review: {
      review_model: "openai/gpt5.5",
      parallel: 1,
      overwrite: true,
      summary_scope: "run"
    },
    archive: {
      tier: "frontier",
      polyglot_version: "polyglot-0.4.0",
      eval_version: "my-eval-name",
      replace_existing: false,
      prepare: true
    },
    codex_auth: {
      mode: "inline_json",
      auth_json: $auth[0]
    }
  }' | curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/run-review-archive" \
    "${AUTH[@]}" "${JSON[@]}" -d @-
```

## Archive an Existing Run

Use `run_dir`:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/archives/eval-vis" \
  "${AUTH[@]}" "${JSON[@]}" \
  -d '{
    "display_name": "archive-existing-run",
    "run_dir": "/abs/path/to/output/run_xxx",
    "tier": "frontier",
    "polyglot_version": "polyglot-0.4.0",
    "harness": "openclaw",
    "eval_version": "existing-run-import",
    "prepare": true
  }'
```

Or use `source_job_id`:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/archives/eval-vis" \
  "${AUTH[@]}" "${JSON[@]}" \
  -d '{
    "display_name": "archive-from-job",
    "source_job_id": "job_id_from_prior_run",
    "tier": "frontier",
    "polyglot_version": "polyglot-0.4.0",
    "harness": "openclaw",
    "eval_version": "prior-job-import",
    "prepare": true
  }'
```

## Query Status

```bash
JOB_ID="job_id_from_submit_response"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/$JOB_ID" "${AUTH[@]}"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/$JOB_ID/events" "${AUTH[@]}"

curl -fsS --get "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/$JOB_ID/events" \
  "${AUTH[@]}" --data-urlencode "after_id=0"

RUN_DIR="/abs/path/to/output/run_xxx"
curl -fsS --get "$POLYGLOT_SERVICE_BASE_URL/v1/runs/status" \
  "${AUTH[@]}" --data-urlencode "run_dir=$RUN_DIR"
```

## Cancel a Job

```bash
JOB_ID="job_id_from_submit_response"

curl -fsS -X POST "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/$JOB_ID/cancel" "${AUTH[@]}"
```

## Multi-Harness Batch Run

Use `/v1/runs/batch` for independent run jobs:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/runs/batch" \
  "${AUTH[@]}" "${JSON[@]}" \
  -d '{
    "batch_name": "a1-three-harnesses",
    "items": [
      {"tasks": ["A1-01"], "model": "proxy_a/gpt-5.4", "harness": "openclaw", "parallel": 2},
      {"tasks": ["A1-01"], "model": "proxy_a/gpt-5.4", "harness": "codex", "parallel": 2},
      {"tasks": ["A1-01"], "model": "proxy_a/claude-sonnet-4-6-thinking", "harness": "claude_code", "parallel": 2}
    ]
  }'
```

Use `/v1/run-and-review/batch` for independent run-and-review jobs:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/run-and-review/batch" \
  "${AUTH[@]}" "${JSON[@]}" \
  -d '{
    "batch_name": "a1-run-review-batch",
    "items": [
      {
        "display_name": "a1-openclaw-review",
        "run": {"tasks": ["A1-01"], "model": "proxy_a/gpt-5.4", "harness": "openclaw", "parallel": 1},
        "review": {"review_model": "proxy_a/gpt-5.4", "parallel": 1, "overwrite": true, "summary_scope": "run"}
      },
      {
        "display_name": "a1-claude-code-review",
        "run": {"tasks": ["A1-01"], "model": "proxy_a/claude-sonnet-4-6-thinking", "harness": "claude_code", "parallel": 1},
        "review": {"review_model": "proxy_a/gpt-5.4", "parallel": 1, "overwrite": true, "summary_scope": "run"}
      }
    ]
  }'
```

There is no batch endpoint for `run-review-archive`. Submit multiple jobs in a shell loop. Each run's internal parallelism is controlled by `run.parallel`; service-wide active job concurrency is controlled server-side.

```bash
for task_id in A1-01 A1-02; do
  jq -n \
    --arg task_id "$task_id" \
    --arg eval_version "frontier-$task_id" \
    --slurpfile auth "$HOME/.codex/auth.json" \
    '{
      display_name: ("run-review-archive-" + $task_id),
      run: {
        tasks: [$task_id],
        model: "openai/gpt5.5",
        harness: "codex",
        parallel: 1
      },
      review: {
        review_model: "openai/gpt5.5",
        parallel: 1,
        overwrite: true,
        summary_scope: "run"
      },
      archive: {
        tier: "frontier",
        polyglot_version: "polyglot-0.4.0",
        eval_version: $eval_version,
        replace_existing: false,
        prepare: true
      },
      codex_auth: {
        mode: "inline_json",
        auth_json: $auth[0]
      }
    }' | curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/run-review-archive" \
      "${AUTH[@]}" "${JSON[@]}" -d @- &
done
wait
```

## Rerun and Merge

Dry-run eligibility:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/rerun-merge" \
  "${AUTH[@]}" "${JSON[@]}" \
  -d '{
    "display_name": "rerun-plan",
    "base_run_dir": "/abs/path/to/output/run_xxx",
    "selection": "review_false_fail",
    "dry_run": true,
    "rerun": {"parallel": 2}
  }'
```

Submit explicit rerun merge:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/rerun-merge" \
  "${AUTH[@]}" "${JSON[@]}" \
  -d '{
    "display_name": "rerun-merge-selected",
    "base_run_dir": "/abs/path/to/output/run_xxx",
    "selection": "explicit",
    "tasks": ["A1-01"],
    "dry_run": false,
    "rerun": {"parallel": 2},
    "merge": {
      "archive_replaced": true,
      "review_summary": "rebuild"
    }
  }'
```
