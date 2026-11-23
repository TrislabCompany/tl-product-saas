---
paths:
  - "src/**/*.cs"
---

# C# coding standards

Checked by: `TreatWarningsAsErrors`, `AnalysisMode=AllEnabledByDefault` and SonarAnalyzer in `src/Directory.Build.props`, the styles in `src/.editorconfig` (`EnforceCodeStyleInBuild`), and `Architecture.Tests`. What a tool reports, fix; don't suppress it. A suppression needs a `Justification` that says why the rule is wrong *here*.

## Style

- File-scoped namespaces, 4-space indent, one public type per file, named after the file.
- Explicit types; `var` only when the right-hand side names the type (`new Foo()`, a cast).
- `is null` / `is not null`, pattern matching and switch expressions over `if` chains.
- Records for DTOs, commands, queries, events and value objects. `sealed` for every class not designed for inheritance (handlers, entities, services).
- `default!` only for required non-nullable strings that EF or the binder sets.

## Naming

| Thing | Shape | Example |
|---|---|---|
| Command / query | `<Verb><Thing>Command` / `Get<Thing>Query`, `Search<Things>Query` | `RegisterUserCommand` |
| Result DTO | `<Thing>Dto` for data (`<Thing>SummaryDto` in lists, `<Thing>DetailDto` for one), `<Thing>Response` for the result of an operation, `PagedResponse<T>` for pages | `AuditDetailDto`, `TokenResponse` |
| Handler / validator / endpoint | `<Command>Handler`, `<Command>Validator`, `<Feature>Endpoint` | `RegisterUserCommandHandler` |
| Integration event | `<Thing><PastTense>IntegrationEvent` | `FileFinalizedIntegrationEvent` |
| Private field | `_camelCase` | `_logger` |
| Async method | ends in `Async`, except Mediator `Handle` | `SaveChangesAsync` |

Names say what a thing is for the business (`ActivateTenant`), not how it is built (`TenantHelper`).

## Async

- Golden rules 5 and 7: handlers are `public sealed`, return `ValueTask<T>` and use `.ConfigureAwait(false)` on every await; every EF and IO call gets the `CancellationToken`.
- Never `.Result`, `.Wait()` or `async void` (except event handlers that the framework requires).
- No fire-and-forget `Task`s. Background work is a Hangfire job (`jobs.md`) or an outbox message (`eventing.md`).

## Errors

- **There is no Result type.** A handler throws the framework exceptions (`api-conventions.md`), and the global handler turns them into ProblemDetails. Don't return `null` or `bool` to mean "failed".
- Guard public inputs with `ArgumentNullException.ThrowIfNull` / `ArgumentException.ThrowIfNullOrWhiteSpace`.
- Catch only what you can handle. A catch that logs must log the exception object, with context, and either rethrow (`throw;`) or be in a background loop that excludes `OperationCanceledException`.
- Exception messages a user may see hold no ids of other tenants, no stack trace and no secret.

## Comments

Code says *what*; a comment says *why* (a workaround, a decision, a link to the issue). XML docs on public types of `BuildingBlocks` and the `.Contracts` projects; `CS1591` is suppressed, so the review checks it.

## Good and bad

```csharp
// good
public sealed class ActivateTenantCommandHandler(TenantDbContext db) : ICommandHandler<ActivateTenantCommand, Unit>
{
    public async ValueTask<Unit> Handle(ActivateTenantCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        Tenant tenant = await db.Tenants.FindAsync([command.Id], cancellationToken).ConfigureAwait(false)
            ?? throw new NotFoundException($"Tenant {command.Id} not found.");
        tenant.Activate();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Unit.Value;
    }
}

// bad: not sealed, no token, null as failure, blocking call
public class TenantHelper { public Tenant? Activate(Guid id) => _db.Tenants.FindAsync(id).Result; }
```
