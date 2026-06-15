# Request-Scoped Codex Auth

Use `codex_auth` when a request should run against the user's Codex/OpenAI official quota, especially for:

- `openai/gpt5.5`
- `openai/gpt5.5-<reasoning_effort>`
- `harness: "codex"`
- `harness: "openclaw"` when using the built-in `openai/gpt5.5` route
- Codex review using `review_model: "openai/gpt5.5"`
- combined `run-and-review` or `run-review-archive` jobs that include either of the above

If a job does not use the official OpenAI proxy or Codex review, it usually does not need `codex_auth`.

`openai/gpt5.5` can be valid even when live `/v1/profiles` does not list provider `openai`. In that case, the service runner may use a built-in OpenAI/Codex route backed by the uploaded Codex auth for the current job. This upload is request-scoped only; it does not create a durable `openai` provider and should not be treated as service-side fallback quota.

## User Prerequisite

Ask the user to authenticate locally:

```bash
codex login
test -s "$HOME/.codex/auth.json"
```

Do not `cat`, print, paste, or summarize `~/.codex/auth.json`.

## Preferred Pattern

Use `jq --slurpfile` so the auth file is read directly into the request body and piped to `curl` without displaying the raw JSON:

```bash
jq -n \
  --slurpfile auth "$HOME/.codex/auth.json" \
  '{
    display_name: "codex-run-user-quota",
    tasks: ["A1-01"],
    model: "openai/gpt5.5",
    harness: "codex",
    parallel: 1,
    codex_auth: {
      mode: "inline_json",
      auth_json: $auth[0]
    }
  }' | curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/runs" \
    -H "Authorization: Bearer $POLYGLOT_SERVICE_API_KEY" \
    -H "Content-Type: application/json" \
    -H 'Expect:' \
    -d @-
```

For combined requests, place `codex_auth` at the top level:

```bash
jq -n \
  --slurpfile auth "$HOME/.codex/auth.json" \
  '{
    display_name: "run-review-archive-frontier-user-quota",
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
      eval_version: "frontier-user-quota-a4-04",
      replace_existing: false,
      prepare: true
    },
    codex_auth: {
      mode: "inline_json",
      auth_json: $auth[0]
    }
  }' | curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/run-review-archive" \
    -H "Authorization: Bearer $POLYGLOT_SERVICE_API_KEY" \
    -H "Content-Type: application/json" \
    -H 'Expect:' \
    -d @-
```

Do not duplicate `codex_auth` in nested `run` and `review` objects unless there is a service-specific reason. For batch combined requests, place `codex_auth` at the top level of each item that needs user quota.

## Built-In OpenAI/Codex Route

Use this route when the intended tested model is official OpenAI GPT-5.5 through local Codex auth:

- model strings: `openai/gpt5.5` or `openai/gpt5.5-<reasoning_effort>`
- supported harness paths: `codex`, and `openclaw` when the runner has the local Codex wrapper route
- unsupported by default: `claude_code`, unless live `/v1/profiles` shows an explicit provider/proxy that supports it

For `run-review-archive` batches, put `codex_auth` at the top level of every item whose run or review uses `openai/gpt5.5`.

## Supported Modes

- `inline_json`: preferred for local clients using `jq --slurpfile`; sends an object as `auth_json`.
- `inline_base64`: available for systems that can safely base64 encode the auth JSON without printing it.
- `server_path`: points to a JSON file on the service host, not the caller's machine. Use only when the service operator explicitly provides a safe server-side path.

## Service Handling

The service materializes request-scoped auth only for the job:

- raw auth is replaced with metadata before request snapshots are persisted
- a temporary per-job `auth.json` is written under the job scratch area with restrictive permissions
- child processes receive the path through `POLYGLOT_CODEX_AUTH_JSON_PATH`
- cleanup removes the raw auth file after completion, cancellation, or stale-job recovery
- DB snapshots, job events, and eval_vis archives should not contain raw auth
- no provider key or durable profile entry is created from the uploaded auth

The service may have `@毛鑫`'s Codex auth configured as a fallback, but do not treat that as the default quota source for user official-proxy or Codex-review evaluations. Prefer user-provided request-scoped auth when quota ownership matters.

## Safety Checklist

- Do not run `set -x`.
- Do not use `curl -v`.
- Do not save request bodies containing raw auth to files.
- Do not include command output that contains auth material in final answers.
- Do not commit `~/.codex/auth.json` or any derived auth payload.
- If `jq` fails because the auth file is missing, stop and ask the user to run `codex login`.

## Common Failures

- `400`: malformed JSON, missing `auth_json`, invalid base64, invalid `server_path`, or rejected sensitive override.
- `401`: missing or invalid `POLYGLOT_SERVICE_API_KEY`.
- `409`: idempotency conflict or invalid cancellation target.
- Job fails quickly: model/profile/harness unavailable, quota unavailable, or Codex auth expired. Recheck `/v1/profiles`, refresh local `codex login`, and inspect `/v1/jobs/{job_id}/events`.
