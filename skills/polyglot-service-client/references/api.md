# Polyglot Service HTTP API

This is the offline API reference for the Polyglot lightweight eval service. When the service is reachable, prefer the live OpenAPI pages because they reflect the deployed version:

- Swagger UI: `$POLYGLOT_SERVICE_BASE_URL/docs`
- ReDoc: `$POLYGLOT_SERVICE_BASE_URL/redoc`
- OpenAPI JSON: `$POLYGLOT_SERVICE_BASE_URL/openapi.json`

## Authentication

Primary header:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/health" \
  -H "Authorization: Bearer $POLYGLOT_SERVICE_API_KEY"
```

Compatible header:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/health" \
  -H "X-Polyglot-Key: $POLYGLOT_SERVICE_API_KEY"
```

Do not print auth headers or use verbose curl output.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/health` | Check service, DB, queue, active jobs, output root. |
| `GET` | `/v1/profiles` | List live profiles, providers, redacted keys, model summaries, runtime summaries. |
| `GET` | `/v1/profiles/{name}` | Show one profile with redacted provider/runtime details and overridable fields. |
| `GET` | `/v1/tasks` | List tasks; query by `difficulty`, `category`, `harness`, and `tasks_dir`. |
| `POST` | `/v1/runs` | Submit one eval run. |
| `POST` | `/v1/runs/batch` | Submit multiple independent run jobs in one batch. |
| `POST` | `/v1/reviews` | Submit Codex review for an existing `run_dir`. |
| `POST` | `/v1/reviews/batch` | Submit multiple review jobs. |
| `POST` | `/v1/run-and-review` | Run eval, then review it in one job. |
| `POST` | `/v1/run-and-review/batch` | Submit multiple run-and-review jobs. |
| `POST` | `/v1/archives/eval-vis` | Archive an existing run for eval_vis. |
| `POST` | `/v1/archives/eval-vis/delete` | Dry-run or delete archived and prepared eval_vis run data. |
| `POST` | `/v1/run-review-archive` | Run eval, review it, then archive for eval_vis. |
| `POST` | `/v1/run-review-archive/batch` | Submit multiple run-review-archive jobs in one batch. |
| `POST` | `/v1/rerun-merge` | Plan or submit a rerun merge for selected failed/retryable tasks. |
| `GET` | `/v1/jobs` | List jobs with filters, pagination, and queue capacity metadata. |
| `GET` | `/v1/jobs/{job_id}` | Fetch job status and paths. |
| `GET` | `/v1/jobs/{job_id}/events` | Fetch job events; optional `after_id`. |
| `POST` | `/v1/jobs/{job_id}/cancel` | Cancel queued/running job. |
| `POST` | `/v1/jobs/cancel/batch` | Cancel multiple jobs with per-job results. |
| `GET` | `/v1/runs/status` | Summarize an existing run directory via `run_dir`. |

## Common Request Fields

Most submission schemas accept:

- `display_name`: optional user-facing label.
- `config_profile`: server profile name; omit for default.
- `idempotency_key`: optional dedupe key.
- `runtime_overrides`: non-secret runtime overrides such as timeouts or retry counts.
- `config`, `provider_overrides`, `providers`, `judge`, `reviewer`, `subagent`: advanced overlays. Sensitive values must be `${ENV_VAR}` references or server-side profile secrets.
- `codex_auth`: request-scoped Codex auth metadata/material. Read `codex-auth.md` before using.

Run selection fields:

- `tasks`: explicit task IDs.
- `all`: run all tasks.
- `difficulty`: one or more difficulty filters.
- `category`: one or more category filters.
- `model`: qualified model name, usually `provider/model_id`.
- `harness`: one of `openclaw`, `claude_code`, or `codex`.
- `parallel`: per-run task parallelism; minimum `1`.
- `tasks_dir`: task registry directory, default `./tasks`.
- `output_dir`: optional output root override.

Review fields:

- `run_dir`: required for `/v1/reviews`.
- `review_model`: qualified review model.
- `tasks`: optional subset.
- `parallel`: review parallelism.
- `overwrite`: whether to replace existing review output.
- `timeout`: optional per-review timeout.
- `summary_scope`: `run` or `selected`.

Archive fields:

- `tier`: `core` or `frontier`, default `frontier`.
- `polyglot_version`: default `polyglot-0.4.0`.
- `harness`: optional for direct archive; `run-review-archive` defaults it from the run harness.
- `eval_version` or `run_name`: at least one is required.
- `replace_existing`, `prepare`, `label`, `note`, `tags`, `archive_root`, `eval_vis_dir`, `difficulties`: optional archive controls.

Archive delete fields:

- Preferred selector: `source_job_id` from a successful `eval_vis_archive` or `run_review_archive` job.
- Direct fallback selectors: `archive_dir` and/or `prepared_data_dir`; these paths must be visible to the service host and under the configured allowed roots.
- Controls: `delete_archive`, `delete_prepared`, `dry_run`, `prune_empty_parents`, `archive_root`, and `eval_vis_dir`.
- Prefer `dry_run: true` first. Delete only removes archived/prepared eval_vis data; it does not rerun benchmarks.

Job list query fields:

- Repeatable filters: `status` and `type`.
- Exact filters: `batch_id`, `harness`, and `model`.
- Pagination: `limit` defaults to `50` and is capped at `500`; `offset` defaults to `0`; `order` is `desc` or `asc`.
- Capacity metadata: `max_active_jobs`, `active_jobs`, `queue_depth`, and `available_slots`.

## Response Fields

Submit endpoints return:

- `job_id`
- `status`
- `type`
- `display_name`

Batch endpoints return:

- `batch_id`
- `status`
- `jobs`

Batch idempotency behavior:

- Each batch item may set its own `idempotency_key`.
- Retrying the same fully idempotent batch returns the original jobs and original `batch_id`.
- A batch request that mixes already-existing idempotent items with new items returns `409`; retry the original batch exactly or submit only the new jobs separately.
- If item idempotency keys resolve to jobs from multiple old batches, the service returns `409`.

Job status returns:

- identity: `job_id`, `display_name`, `batch_id`, `type`, `status`, `phase`
- paths: `run_dir`, `output_dir`, `archive_dir`, `prepared_data_dir`, `log_path`
- model metadata: `model`, `harness`, `version_id`
- summaries: `progress`, `pass`, `review`
- diagnostics/timestamps: `error`, `created_at`, `started_at`, `finished_at`, `updated_at`

`run-review-archive` success should expose `archive_dir` for the archived run and `prepared_data_dir` for eval_vis frontend consumption.

Job list returns the same job summary shape for each listed job plus `total`, `limit`, `offset`, `queue_depth`, `active_jobs`, `max_active_jobs`, and `available_slots`.

Batch cancel returns `requested`, `canceled`, `already_terminal`, `not_found`, and `items`. Cancellation is per job; terminal jobs are reported as no-ops when `ignore_terminal` is `true`.

Status values: `queued`, `running`, `succeeded`, `failed`, `cancel_requested`, `canceled`.

Job types: `run`, `review`, `run_and_review`, `rerun_merge`, `eval_vis_archive`, `run_review_archive`.

## Errors and Safety

- Missing/bad auth returns `401`.
- Unknown jobs or run directories return `404`.
- idempotency conflicts or invalid cancel targets may return `409`.
- Invalid schemas, raw sensitive overrides, malformed `codex_auth`, or invalid archive sources return `400`.
- Profile API responses redact provider keys. Do not attempt to recover secrets from `/v1/profiles`.
