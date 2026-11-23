---
paths:
  - "src/Modules/**/Features/**/*.cs"
  - "src/Samples/**/Features/**/*.cs"
  - "src/Modules/*/Modules.*.Contracts/**/*.cs"
  - "src/Samples/*/Modules.*.Contracts/**/*.cs"
  - "src/BuildingBlocks/Web/**/*.cs"
---

# API conventions

Read before adding endpoints, commands/queries, validators, or error handling.

## Endpoints

Static extension methods on `IEndpointRouteBuilder`, returning `RouteHandlerBuilder`. The handler delegates to Mediator. Gate with `.RequirePermission(...)`.

```csharp
public static class RegisterUserEndpoint
{
    internal static RouteHandlerBuilder MapRegisterUserEndpoint(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapPost("/register", (RegisterUserCommand command,
                IMediator mediator, CancellationToken cancellationToken) =>
                mediator.Send(command, cancellationToken))
            .WithName("RegisterUser")
            .WithSummary("Register user")
            .RequirePermission(IdentityPermissionConstants.Users.Create);
}
```

- **Always accept and forward `CancellationToken`** to `mediator.Send`. ASP.NET injects it.
- Wire each endpoint in the module's `MapEndpoints()`. Endpoints group under `api/v{version:apiVersion}/{module}`.
- Use `TypedResults` / `.Produces<T>(...)` for accurate OpenAPI. Add `.WithIdempotency()` on POSTs that must be replay-safe.

## CQRS

- **Commands/Queries** live in `Modules.{Name}.Contracts` — implement `ICommand<TResponse>` / `IQuery<TResponse>`. Records preferred.
- **Handlers** live in `Modules.{Name}/Features/` — `public sealed`, implement `ICommandHandler<T,TResponse>` / `IQueryHandler<T,TResponse>`, return `ValueTask<T>` (golden rule 5).
- Paginated queries implement `IPagedQuery` (`PageNumber`, `PageSize`, `Sort`) and return `PagedResponse<T>`.

## Validation

FluentValidation, auto-registered by `ModuleLoader`. Name `{Command}Validator`. Live in the same feature folder.

- **Every command handler needs a validator; every paginated query handler needs one too.** Enforced by `Architecture.Tests` (`HandlerValidatorPairingTests`). A handler legitimately without rules can be added to that test's known-missing allowlist, but prefer writing the validator.
- Validators run via the `ValidationBehavior<,>` Mediator pipeline before the handler.

## Exceptions → ProblemDetails

Throw framework exception types; the global handler converts to RFC 9457 `ProblemDetails`:

| Throw | HTTP |
|---|---|
| `NotFoundException` | 404 |
| `ForbiddenException` | 403 |
| `UnauthorizedException` | 401 |
| `CustomException(msg, errors?, HttpStatusCode)` | as specified (default 400) |

Localize every client-visible throw: English text as the message (logs), key attached with
`.Localized<{X}Resources>("{X}.Case", args)` or `.Localized("Error.Case")` for a Core key. See `localization.md`.

Don't catch broadly to swallow. Background loops may `catch (Exception)` to stay alive, but must **log with context** and exclude `OperationCanceledException` (filtered catch or a preceding `catch (OperationCanceledException)`).

## Permissions

Constants in `Shared/Identity/*Permissions.cs` (e.g. `IdentityPermissionConstants`). Apply with `.RequirePermission(...)` on the endpoint. `RequiredPermissionAttribute` implements `IRequiredPermissionMetadata` — never let a duplicate of that interface appear; it silently disables **all** `.RequirePermission()` gates.

## Specifications

Use `Specification<T>` (`src/BuildingBlocks/Persistence/Specifications/`) for query composition. Default `AsNoTracking = true` — see `database.md` for when tracking is required instead.

## Contracts and compatibility

The API, the `.Contracts` projects and the integration events are contracts: the two front ends, other modules and older revisions of the API depend on them: during a rollout two revisions serve side by side (the platform contract above in `AGENTS.md`).

- **Inside a version, change only by adding.** A new optional field, a new endpoint, a new enum value at the end. Never rename or remove a field, change its type, make an optional field required, or change a route or status code.
- **A breaking change is a new version**: `v2` of the endpoint and its contracts in `Contracts/v2/`, with `v1` kept until the front ends have moved. `ApiVersioningTests` checks that the namespaces match.
- **Integration events are versioned contracts.** Add fields only, with a default a consumer can live without. A breaking change is a new event type (`InvoiceIssuedV2IntegrationEvent`); publish both until every consumer has moved. A consumer ignores fields it doesn't know.
- Errors are always ProblemDetails (RFC 9457) with `traceId`; validation errors in `errors` keyed by the field name. Don't invent another error shape.
- Lists are pages: `IPagedQuery` in, `PagedResponse<T>` out, `PageSize` capped by the validator.
- Times are UTC, named `…Utc` (`CreatedAtUtc`), ISO 8601 on the wire. Ids are `Guid` (`Guid.CreateVersion7()`). Money is `decimal` next to its `Currency`.
- Document every endpoint for OpenAPI: `.WithName`, `.WithSummary`, `.Produces<T>()` and the error codes it returns. The front ends' hand-written types follow it.

## Adding a feature (checklist)

1. Command/query + response in `Modules.{Name}.Contracts/v1/{Area}/{Feature}/`.
2. Handler in `Modules.{Name}/Features/v1/{Area}/{Feature}/`.
3. Validator in the same folder.
4. Endpoint in the same folder; wire in module `MapEndpoints()`.
5. Tests in `Tests/{Name}.Tests/` (+ integration test if it touches DB/IO).
