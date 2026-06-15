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
NO_EXPECT=(-H "Expect:")
```

## Health, Profiles, and Capacity

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/health" "${AUTH[@]}"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/profiles" "${AUTH[@]}"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/profiles/default" "${AUTH[@]}"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/jobs" "${AUTH[@]}" |
  jq '{active_jobs, queue_depth, max_active_jobs, available_slots}'
```

Call `/v1/jobs` before submitting a large batch. If `available_slots` is `0`, wait or submit fewer jobs.

## List Tasks

List level L1 tasks on axis A for OpenClaw:

```bash
curl -fsS --get "$POLYGLOT_SERVICE_BASE_URL/v1/tasks" \
  "${AUTH[@]}" \
  --data-urlencode "harness=openclaw" \
  --data-urlencode "difficulty=L1" \
  --data-urlencode "category=A"
```

`A1-01` is a concrete task ID: axis `A`, level `L1`, sequence `01`. It is not a valid `difficulty` value; use `difficulty=L1` and `category=A` when filtering for that family.

## Submit a Simple Run

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/runs" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
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
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
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

## Service-Visible Paths

Prefer `source_job_id` when archiving or deleting data produced by service jobs. Use `/v1/jobs/{job_id}` to recover `run_dir`, `archive_dir`, and `prepared_data_dir`.

Local client paths work only when the same absolute path is mounted on the service host. For reviews, run status, direct archive, rerun-merge, or direct delete fallback, pass paths that the service process can read.

```bash
JOB_ID="job_id_from_submit_response"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/$JOB_ID" "${AUTH[@]}" |
  jq '{job_id, status, run_dir, archive_dir, prepared_data_dir}'
```

## Review an Existing Run

```bash
RUN_DIR="/service-visible/output/run_xxx"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/reviews" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
  -d "{
    \"display_name\": \"review-existing-run\",
    \"run_dir\": \"$RUN_DIR\",
    \"review_model\": \"proxy_a/gpt-5.4\",
    \"parallel\": 1,
    \"overwrite\": true,
    \"summary_scope\": \"run\"
  }"
```

## Submit Run and Codex Review

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/run-and-review" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
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
    "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" -d @-
```

## Submit Core Run, Review, and Archive

Core examples that use `A1-01` should use `tier: "core"`:

```bash
jq -n \
  --slurpfile auth "$HOME/.codex/auth.json" \
  '{
    display_name: "run-review-archive-core-a1",
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
      tier: "core",
      polyglot_version: "polyglot-0.4.0",
      eval_version: "core-codex-a1",
      replace_existing: false,
      prepare: true
    },
    codex_auth: {
      mode: "inline_json",
      auth_json: $auth[0]
    }
  }' | curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/run-review-archive" \
    "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" -d @-
```

## Archive an Existing Run

Prefer `source_job_id` after a service-run job:

```bash
SOURCE_JOB_ID="job_id_from_prior_run"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/archives/eval-vis" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
  -d "{
    \"display_name\": \"archive-from-job\",
    \"source_job_id\": \"$SOURCE_JOB_ID\",
    \"tier\": \"core\",
    \"polyglot_version\": \"polyglot-0.4.0\",
    \"harness\": \"openclaw\",
    \"eval_version\": \"prior-job-core-import\",
    \"prepare\": true
  }"
```

Use direct `run_dir` only when the service host can read that path:

```bash
RUN_DIR="/service-visible/output/run_xxx"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/archives/eval-vis" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
  -d "{
    \"display_name\": \"archive-existing-run\",
    \"run_dir\": \"$RUN_DIR\",
    \"tier\": \"core\",
    \"polyglot_version\": \"polyglot-0.4.0\",
    \"harness\": \"openclaw\",
    \"eval_version\": \"existing-run-core-import\",
    \"prepare\": true
  }"
```

## Delete Archived Eval Vis Data

Preview deletion first:

```bash
SOURCE_JOB_ID="successful_eval_vis_archive_or_run_review_archive_job_id"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/archives/eval-vis/delete" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
  -d "{
    \"source_job_id\": \"$SOURCE_JOB_ID\",
    \"delete_archive\": true,
    \"delete_prepared\": true,
    \"dry_run\": true,
    \"prune_empty_parents\": true
  }"
```

Delete by `source_job_id` after the dry run looks right:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/archives/eval-vis/delete" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
  -d "{
    \"source_job_id\": \"$SOURCE_JOB_ID\",
    \"delete_archive\": true,
    \"delete_prepared\": true,
    \"dry_run\": false,
    \"prune_empty_parents\": true
  }"
```

Direct path fallback is only for service-visible paths under allowed archive/eval_vis roots:

```bash
ARCHIVE_DIR="/service-visible/_local/L1-3/polyglot-0.4.0/openclaw/core-eval/proxy_a_gpt-5.4/run_xxx"
PREPARED_DATA_DIR="/service-visible/_local/eval_vis/data/core/polyglot-0.4.0__openclaw__core-eval/proxy_a_gpt-5.4__run_xxx"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/archives/eval-vis/delete" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
  -d "{
    \"archive_dir\": \"$ARCHIVE_DIR\",
    \"prepared_data_dir\": \"$PREPARED_DATA_DIR\",
    \"delete_archive\": true,
    \"delete_prepared\": true,
    \"dry_run\": true,
    \"prune_empty_parents\": true
  }"
```

## Query Status

```bash
JOB_ID="job_id_from_submit_response"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/$JOB_ID" "${AUTH[@]}"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/$JOB_ID/events" "${AUTH[@]}"

curl -fsS --get "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/$JOB_ID/events" \
  "${AUTH[@]}" --data-urlencode "after_id=0"

RUN_DIR="/service-visible/output/run_xxx"
curl -fsS --get "$POLYGLOT_SERVICE_BASE_URL/v1/runs/status" \
  "${AUTH[@]}" --data-urlencode "run_dir=$RUN_DIR"
```

## List Jobs

List active jobs:

```bash
curl -fsS --get "$POLYGLOT_SERVICE_BASE_URL/v1/jobs" \
  "${AUTH[@]}" \
  --data-urlencode "status=queued" \
  --data-urlencode "status=running" \
  --data-urlencode "status=cancel_requested" \
  --data-urlencode "limit=100"
```

Filter by batch:

```bash
BATCH_ID="batch_id_from_submit_response"

curl -fsS --get "$POLYGLOT_SERVICE_BASE_URL/v1/jobs" \
  "${AUTH[@]}" \
  --data-urlencode "batch_id=$BATCH_ID" \
  --data-urlencode "limit=100"
```

Recover job IDs after a connection drop or empty reply by filtering recent jobs client-side:

```bash
DISPLAY_NAME_PART="frontier-openclaw-review-archive"

curl -fsS --get "$POLYGLOT_SERVICE_BASE_URL/v1/jobs" \
  "${AUTH[@]}" \
  --data-urlencode "type=run_review_archive" \
  --data-urlencode "status=queued" \
  --data-urlencode "status=running" \
  --data-urlencode "status=succeeded" \
  --data-urlencode "status=failed" \
  --data-urlencode "limit=100" |
  jq --arg name "$DISPLAY_NAME_PART" \
    '.jobs[] | select((.display_name // "") | contains($name)) | {job_id, display_name, batch_id, status, created_at}'
```

Check capacity before submitting a batch:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/jobs" "${AUTH[@]}" |
  jq '{active_jobs, queue_depth, max_active_jobs, available_slots}'
```

## Cancel Jobs

Cancel one job:

```bash
JOB_ID="job_id_from_submit_response"

curl -fsS -X POST "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/$JOB_ID/cancel" "${AUTH[@]}"
```

Cancel all active jobs in a batch:

```bash
BATCH_ID="batch_id_from_submit_response"

curl -fsS --get "$POLYGLOT_SERVICE_BASE_URL/v1/jobs" \
  "${AUTH[@]}" \
  --data-urlencode "batch_id=$BATCH_ID" \
  --data-urlencode "status=queued" \
  --data-urlencode "status=running" \
  --data-urlencode "limit=500" |
  jq '{job_ids: [.jobs[].job_id], ignore_terminal: true}' |
  curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/cancel/batch" \
    "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" -d @-
```

Cancel selected currently active jobs:

```bash
curl -fsS --get "$POLYGLOT_SERVICE_BASE_URL/v1/jobs" \
  "${AUTH[@]}" \
  --data-urlencode "type=run_review_archive" \
  --data-urlencode "status=queued" \
  --data-urlencode "status=running" \
  --data-urlencode "limit=500" |
  jq '{job_ids: [.jobs[].job_id], ignore_terminal: true}' |
  curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/cancel/batch" \
    "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" -d @-
```

Batch cancel returns per-job results. Terminal jobs can be ignored when `ignore_terminal` is `true`; missing jobs are reported per item.
If the generated `job_ids` array is empty, skip the cancel call; empty `job_ids` is a validation error.

## Multi-Harness Batch Run

Use `/v1/runs/batch` for independent run jobs:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/runs/batch" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
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
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
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

Batch endpoints use one `batch_id`. If every item is an idempotent retry, the response returns the original batch and jobs. A request that mixes already-existing idempotent items with new items returns `409`; retry the original batch exactly or submit new work separately.

## Run, Review, and Archive Batch

Non-Codex reviewer example:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/run-review-archive/batch" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
  -d '{
    "batch_name": "frontier-openclaw-review-archive",
    "items": [
      {
        "display_name": "a4-04-glm-openclaw",
        "idempotency_key": "rrar-a4-04-glm-openclaw",
        "run": {
          "tasks": ["A4-04"],
          "model": "zhipu_glm/glm-5.1",
          "harness": "openclaw",
          "parallel": 1
        },
        "review": {
          "review_model": "proxy_a/gpt-5.4",
          "parallel": 1,
          "overwrite": true,
          "summary_scope": "run"
        },
        "archive": {
          "tier": "frontier",
          "polyglot_version": "polyglot-0.4.0",
          "eval_version": "frontier-openclaw-glm",
          "replace_existing": true,
          "prepare": true
        }
      },
      {
        "display_name": "a4-04-proxy-openclaw",
        "idempotency_key": "rrar-a4-04-proxy-openclaw",
        "run": {
          "tasks": ["A4-04"],
          "model": "proxy_a/gpt-5.4",
          "harness": "openclaw",
          "parallel": 1
        },
        "review": {
          "review_model": "proxy_a/gpt-5.4",
          "parallel": 1,
          "overwrite": true,
          "summary_scope": "run"
        },
        "archive": {
          "tier": "frontier",
          "polyglot_version": "polyglot-0.4.0",
          "eval_version": "frontier-openclaw-proxy",
          "replace_existing": true,
          "prepare": true
        }
      }
    ]
  }'
```

Official OpenAI/Codex quota batch example. Put `codex_auth` at the top level of each item. This example uses the built-in `openai/gpt5.5` route, which can be valid even when live `/v1/profiles` does not list provider `openai`.

`codex` is supported through run-scoped Codex auth. `openclaw` is supported when the service runner has the local Codex wrapper route. Do not assume `claude_code` works through this route unless `/v1/profiles` shows an explicit compatible provider/proxy.

```bash
jq -n \
  --slurpfile auth "$HOME/.codex/auth.json" \
  '{
    batch_name: "frontier-openai-gpt55-codex-auth",
    items: [
      {
        display_name: "a4-04-openai-gpt55-openclaw",
        idempotency_key: "rrar-a4-04-openai-gpt55-openclaw",
        run: {
          tasks: ["A4-04"],
          model: "openai/gpt5.5",
          harness: "openclaw",
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
          eval_version: "frontier-openai-gpt55-a4-04",
          replace_existing: false,
          prepare: true
        },
        codex_auth: {
          mode: "inline_json",
          auth_json: $auth[0]
        }
      },
      {
        display_name: "a4-04-openai-gpt55-codex",
        idempotency_key: "rrar-a4-04-openai-gpt55-codex",
        run: {
          tasks: ["A4-04"],
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
          eval_version: "frontier-openai-gpt55-a4-04",
          replace_existing: false,
          prepare: true
        },
        codex_auth: {
          mode: "inline_json",
          auth_json: $auth[0]
        }
      }
    ]
  }' | curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/run-review-archive/batch" \
    "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" -d @-
```

## Rerun and Merge

Dry-run eligibility:

```bash
BASE_RUN_DIR="/service-visible/output/run_xxx"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/rerun-merge" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
  -d "{
    \"display_name\": \"rerun-plan\",
    \"base_run_dir\": \"$BASE_RUN_DIR\",
    \"selection\": \"review_false_fail\",
    \"dry_run\": true,
    \"rerun\": {\"parallel\": 2}
  }"
```

Submit explicit rerun merge:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/rerun-merge" \
  "${AUTH[@]}" "${JSON[@]}" "${NO_EXPECT[@]}" \
  -d "{
    \"display_name\": \"rerun-merge-selected\",
    \"base_run_dir\": \"$BASE_RUN_DIR\",
    \"selection\": \"explicit\",
    \"tasks\": [\"A1-01\"],
    \"dry_run\": false,
    \"rerun\": {\"parallel\": 2},
    \"merge\": {
      \"archive_replaced\": true,
      \"review_summary\": \"rebuild\"
    }
  }"
```
