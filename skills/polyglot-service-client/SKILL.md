---
name: polyglot-service-client
description: Use when calling the Polyglot eval service HTTP API to submit or inspect runs, reviews, run-review-archive or eval_vis archive jobs, query health/profiles/tasks/models/proxies, use openclaw/claude_code/codex harnesses, or pass request-scoped codex_auth safely.
---

# Polyglot Service Client

## Core Workflow

Use this skill to call the Polyglot lightweight eval service safely.

1. Require `POLYGLOT_SERVICE_BASE_URL` and `POLYGLOT_SERVICE_API_KEY`; do not guess the service URL or key.
2. Build auth headers from environment variables only:

```bash
: "${POLYGLOT_SERVICE_BASE_URL:?set POLYGLOT_SERVICE_BASE_URL}"
: "${POLYGLOT_SERVICE_API_KEY:?set POLYGLOT_SERVICE_API_KEY}"
AUTH=(-H "Authorization: Bearer $POLYGLOT_SERVICE_API_KEY")
JSON=(-H "Content-Type: application/json")
```

3. Check service health before submissions:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/health" "${AUTH[@]}"
```

4. Query live profiles before choosing providers or models:

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/profiles" "${AUTH[@]}"
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/profiles/default" "${AUTH[@]}"
```

5. Use live `/v1/profiles` as authoritative. The bundled `references/polyglot.yaml` is only a static snapshot for offline orientation.
6. Write model names as `provider/model_id`, for example `proxy_a/gpt-5.4`, `intern-regression-internal/s2_preview_20260421b`, or `openai/gpt5.5`.
7. Submit jobs with the templates in `references/request-templates.md`, then poll `/v1/jobs/{job_id}` and `/v1/jobs/{job_id}/events`.
8. When explaining task IDs, task sets, difficulty levels, benchmark intent, or why a harness must be selected, read `references/pipeline-and-benchmark.md` first.

## Safety Rules

- Never print, log, echo, commit, or include in final answers: `POLYGLOT_SERVICE_API_KEY`, provider API keys, `~/.codex/auth.json`, bearer tokens, or raw `codex_auth` payloads.
- Do not use `curl -v`, `set -x`, or shell commands that would display headers or auth-bearing payloads.
- Caller-supplied config overlays must use `${ENV_VAR}` references for sensitive values, or rely on server-side profiles. Do not place raw provider secrets in request JSON.
- Existing proxies and profiles are server-side configuration. New proxies, provider API keys, or service profiles must be configured by the service provider `@毛鑫`; normal API requests do not create them.
- For `openai/gpt5.5`, Codex harness runs, or Codex review using user quota, ask the user to run `codex login` locally and pass request-scoped `codex_auth` with the `jq --slurpfile auth "$HOME/.codex/auth.json"` pattern from `references/codex-auth.md`.

## Minimal Run

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

Use the returned `job_id`:

```bash
JOB_ID="job_id_from_submit_response"
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/$JOB_ID" "${AUTH[@]}"
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/jobs/$JOB_ID/events" "${AUTH[@]}"
```

## References

- `references/api.md`: endpoint map, request/response fields, online docs URLs.
- `references/pipeline-and-benchmark.md`: agent-polyglot evaluation pipeline, task ID semantics, L1-L3 core tasks, L4 frontier tasks, and harness selection guidance.
- `references/request-templates.md`: copyable `curl` and `jq` templates for runs, reviews, archives, batches, status, cancel, and rerun-merge.
- `references/proxy-and-profiles.md`: how to inspect profiles, model naming, proxy boundaries, and static config caveats.
- `references/codex-auth.md`: safe request-scoped Codex auth workflow and failure modes.
- `references/polyglot.yaml`: copied static profile/config snapshot; never treat it as more current than `/v1/profiles`.
