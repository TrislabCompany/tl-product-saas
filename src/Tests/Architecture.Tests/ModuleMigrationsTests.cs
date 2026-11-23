using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Shouldly;
using System.Reflection;
using Xunit;

namespace Architecture.Tests;

/// <summary>
/// Each module ships its own migrations (docs/modules.md): every DbContext of a module or of the
/// Eventing building block has its model snapshot, and so its migrations, in its own assembly, so a
/// product that leaves a module out gets none of its tables.
/// </summary>
public sealed class ModuleMigrationsTests
{
    [Fact]
    public void Every_Module_DbContext_Has_Its_Migrations_In_Its_Own_Assembly()
    {
        var assemblies = ModuleAssemblyDiscovery.GetModuleAssemblies()
            .Append(typeof(Trislab.Framework.Eventing.EventingConstants).Assembly)
            .ToArray();

        var contexts = assemblies
            .SelectMany(LoadableTypes)
            .Where(t => t is { IsClass: true, IsAbstract: false } && typeof(DbContext).IsAssignableFrom(t))
            .ToArray();

        contexts.Length.ShouldBeGreaterThan(5, "the DbContext scan found too few contexts; the discovery probably broke");

        var missing = contexts
            .Where(context => !LoadableTypes(context.Assembly).Any(t =>
                typeof(ModelSnapshot).IsAssignableFrom(t)
                && t.GetCustomAttribute<DbContextAttribute>()?.ContextType == context))
            .Select(context => $"{context.FullName} ({context.Assembly.GetName().Name})")
            .ToList();

        missing.ShouldBeEmpty(
            "Each module DbContext needs its migrations in its own project (dotnet ef migrations add ... " +
            "--project <the module> --output-dir Migrations, .agents/skills/create-migration). Missing: " +
            string.Join("; ", missing));
    }

    private static IEnumerable<Type> LoadableTypes(Assembly assembly)
    {
        try
        {
            return assembly.GetTypes();
        }
        catch (ReflectionTypeLoadException ex)
        {
            return ex.Types.Where(t => t is not null)!;
        }
    }
}
