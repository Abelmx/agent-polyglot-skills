# Proxy and Profile Guidance

Always inspect the live service profile before deciding which provider, proxy, model, runtime, or harness to use.

## Query Live Profiles

```bash
curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/profiles" \
  -H "Authorization: Bearer $POLYGLOT_SERVICE_API_KEY"

curl -fsS "$POLYGLOT_SERVICE_BASE_URL/v1/profiles/default" \
  -H "Authorization: Bearer $POLYGLOT_SERVICE_API_KEY"
```

`/v1/profiles` returns summaries: `default_profile`, each profile name/path, default model, provider summaries, model IDs, and selected runtime fields.

`/v1/profiles/{name}` returns detailed provider and runtime config, but sensitive provider values are redacted. It is not a way to retrieve API keys.

## Static Snapshot

`references/polyglot.yaml` is copied from the repository root as an offline snapshot. Use it to orient yourself when the service is unavailable, but do not assume it matches a deployed service. The deployed service may use a different profile directory or default profile.

The snapshot can contain `${ENV_VAR}` placeholders and non-sensitive base URLs. It must not contain raw auth keys.

## Model Naming

Use qualified model names:

```text
provider/model_id
```

Examples:

```text
proxy_a/gpt-5.4
proxy_a/claude-sonnet-4-6-thinking
intern-regression-internal/s2_preview_20260421b
openai/gpt5.5
```

Any model declared under an existing proxy can usually be referenced with this format. Confirm exact model IDs with `/v1/profiles` because static docs may lag the service.

## Known Proxy Semantics

- `proxy_a`: Boyue proxy. The plan notes a known service-side base URL of `http://35.220.164.252:3888/v1`; live profiles may instead show an environment placeholder or a different configured URL.
- `intern-regression-internal`: H-cluster internal Intern regression proxy. The static snapshot currently lists `http://s-20260104203038-22bhb.ailab-evalservice.pjh-service.org.cn/v1`.
- `openai`: official OpenAI/Codex quota route when present in the live service profile. For user-quota jobs, use request-scoped `codex_auth`; do not assume a server fallback quota is appropriate.

Other provider names may exist in `references/polyglot.yaml` or live profiles. Treat live profile output as the source of truth.

## Configuration Boundaries

Normal API requests can choose existing profiles, providers, models, harnesses, and runtime overrides. They cannot create durable service-side proxies or store new provider API keys.

Ask service provider `@毛鑫` to configure:

- new proxy/provider entries
- provider API keys
- new server-side profile files
- changes to service-level concurrency such as maximum active jobs
- default profile changes

Request-level overrides are for a single job. Sensitive override values are rejected unless they are `${ENV_VAR}` references or server-side profile secrets.

## Harness Notes

Supported harness names are:

- `openclaw`
- `claude_code`
- `codex`

Some providers include harness-specific settings for `claude_code` or `codex`. If a model is available for one harness but not another, inspect `/v1/profiles/{name}` and the task compatibility list from `/v1/tasks?harness=...`.
