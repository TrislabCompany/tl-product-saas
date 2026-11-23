---
paths:
  - "src/**/*.cs"
---

# Logging & observability

`src/BuildingBlocks/Web/Observability/`. Read before adding logs, traces, or metrics.

Checked by: `CA2254` (template must be constant) through `AnalysisMode=AllEnabledByDefault`. `CA1848` is off, so `[LoggerMessage]` on hot paths, the levels and the never-logged list are review only. The logs are what support reads during an incident: write each line for the person who has only the logs and a trace id.

## Structured logging only

**No string interpolation in log messages.** Use message templates with named placeholders, or `[LoggerMessage]` source-gen for hot paths.

```csharp
// good
_logger.LogInformation("Cleaned up {Count} expired sessions for tenant {TenantId}", count, tenantId);
// also good (hot path) — see OutboxDispatcher, InMemoryEventBus, AppHub
[LoggerMessage(Level = LogLevel.Warning, Message = "Outbox message {MessageId} dead-lettered")]
private partial void LogDeadLettered(Guid messageId);
// NEVER
_logger.LogInformation($"Cleaned up {count} sessions");   // breaks structured logging + analyzers
```

Build runs with `TreatWarningsAsErrors` — interpolated log calls won't even compile clean under analysis.

## Levels

| Level | Use |
|---|---|
| `Critical` | The app can't serve at all (no database at startup) |
| `Error` | A person must act: an operation failed and won't be retried, a dependency is broken |
| `Warning` | Degraded but handled: a retry, a fallback, a dead-lettered message, input rejected at a boundary |
| `Information` | A lifecycle or business event, once per meaningful step (tenant created, invoice issued, job finished with its count), never once per item in a loop |
| `Debug`, `Trace` | Detail for a developer; off outside `local` |

- Log an exception once, where it is handled, with the exception object as the first argument: `_logger.LogError(ex, "Invoice {InvoiceId} failed to send", id)`. The global handler logs unhandled ones; don't log and rethrow.
- Health probes and static files write no `Information` line.
- Every line answers *what happened, to which thing*: put the ids (`{TenantId}`, `{InvoiceId}`, `{MessageId}`) in the template, PascalCase.

## Never logged

Secrets, tokens, keys, connection strings, passwords; request and response bodies; e-mail addresses, names, phone numbers, IP addresses. Log the id instead (`{UserId}`, not `{Email}`). `HttpRequestContextEnricher` still adds `UserEmail`; don't add more like it, and don't query by it. When in doubt, leave it out: a missing field costs a query, a leaked one is a data-protection incident.

## Serilog

`AddTrislabLogging()` reads the `Serilog` config section (Console sink by default), attaches `HttpRequestContextEnricher` (adds `RequestMethod`/`RequestPath`/`UserAgent` + `UserId`/`Tenant`/`UserEmail` when authenticated), overrides Microsoft/EF/Hangfire/Finbuckle to higher levels, and excludes the `ExceptionHandlerMiddleware` source (the global handler logs exceptions itself — don't double-log).

## Correlation

The trace id is the correlation id. It comes from the W3C `traceparent` header when the caller sends one, is returned in every ProblemDetails as `traceId`, and is what a user quotes to support. A background job or outbox message started by a request keeps it.

`X-Correlation-ID` request header (falls back to `HttpContext.TraceIdentifier`), surfaced in every ProblemDetails and pushed to the Serilog `LogContext`. `CurrentUserMiddleware` tags the current `Activity` with `tl.user_id` / `tl.tenant_id` / `tl.correlation_id`.

## OpenTelemetry

`AddTrislabOpenTelemetry()` no-ops unless `OpenTelemetryOptions.Enabled`. Metrics + traces for AspNetCore/HttpClient/Npgsql/EFCore/Redis/Runtime, plus caching + auditing meters and Mediator pipeline spans (`MediatorTracingBehavior`). Add a new meter/source name to `OpenTelemetryOptions` config, not by editing the extension.

**OTLP export is auto-detected.** It turns on when **either** `Exporter.Otlp.Enabled=true` **or** the `OTEL_EXPORTER_OTLP_ENDPOINT` env var is present. Under .NET Aspire that env var is injected automatically, so traces/metrics flow to the Aspire dashboard with no config change (the SDK reads endpoint + protocol from the standard `OTEL_EXPORTER_OTLP_*` env vars; the config `Endpoint`/`Protocol` are only used when no env var is set — e.g. the docker-compose collector at `http://localhost:4317`). Plain `dotnet run` with no collector and `Enabled=false` exports nothing.

**Logs ride the same OTLP detection.** Serilog owns the logging pipeline and does not forward to other `ILogger` providers, so the OTel SDK's log exporter can't see Serilog events — instead `AddTrislabLogging` adds a `Serilog.Sinks.OpenTelemetry` sink under the same auto-detect rule (global `Enabled` + env-var-or-config endpoint). It also parses `OTEL_EXPORTER_OTLP_HEADERS` (the Aspire dashboard's OTLP receiver requires its `x-otlp-api-key`; the SDK reads this for traces/metrics, the Serilog sink does not) and stamps `service.name` = `OTEL_SERVICE_NAME ?? ApplicationName` so logs group under the same dashboard resource as the spans. Both `AddTrislabOpenTelemetry` and the Serilog sink resolve the name that way: under an orchestrator that injects `OTEL_SERVICE_NAME` (Aspire sets it to the resource name, e.g. `tl-starter-api`) the process adopts that identity; hardcoding the entry-assembly name (`App.Api`) instead would de-correlate the telemetry and list the process twice in the dashboard. Plain `dotnet run` with no env var falls back to `ApplicationName`.
