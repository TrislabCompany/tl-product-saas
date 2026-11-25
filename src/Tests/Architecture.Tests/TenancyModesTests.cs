using System.Reflection;
using Trislab.Framework.Shared.Multitenancy;
using Trislab.Framework.Tenancy;
using Trislab.Framework.Web.Modules;
using Trislab.Modules.Multitenancy;
using Microsoft.Extensions.Hosting;
using Shouldly;
using Xunit;

namespace Architecture.Tests;

/// <summary>
/// Every module declares the tenancy modes it supports, in code, and start-up refuses a module registered in a
/// mode it does not support. A module that supports single-tenant mode must also work without the tenant catalog.
/// </summary>
public sealed class TenancyModesTests
{
    /// <summary>The modules that need a tenant catalog. Adding to this list is a design decision: say why in the PR.</summary>
    private static readonly string[] MultitenantOnly = ["MultitenancyModule", "SubscriptionsUsageModule"];

    private static readonly string[] MultitenantOnlyAssemblies =
        ["Trislab.Modules.Multitenancy", "Trislab.Modules.Multitenancy.Contracts"];

    private static List<(Type Type, IModule Module)> Modules() =>
        ModuleAssemblyDiscovery.GetModuleAssemblies()
            .SelectMany(a => a.GetCustomAttributes<TrislabModuleAttribute>())
            .Select(a => a.ModuleType)
            .Distinct()
            .Select(t => (t, (IModule)Activator.CreateInstance(t)!))
            .ToList();

    private static SingleTenantOptions Fixed() => new()
    {
        Id = "main",
        Name = "Main",
        Country = "SI",
        AdminEmail = "admin@main.test",
    };

    [Fact]
    public void EveryModuleType_Should_BeRegisteredWithTheModuleAttribute()
    {
        var registered = Modules().Select(m => m.Type).ToHashSet();
        var declared = ModuleAssemblyDiscovery.GetModuleAssemblies()
            .SelectMany(a => a.GetTypes())
            .Where(t => typeof(IModule).IsAssignableFrom(t) && t is { IsAbstract: false, IsInterface: false });

        declared.ShouldBeSubsetOf(registered, "every IModule needs an assembly-level [TrislabModule]");
    }

    [Fact]
    public void EveryModule_Should_DeclareAtLeastOneMode()
    {
        Modules().ShouldNotBeEmpty();

        foreach (var (type, module) in Modules())
        {
            module.SupportedTenancyModes.ShouldNotBe(TenancyModes.None, $"{type.Name} declares no tenancy mode");
        }
    }

    [Fact]
    public void OnlyTheTenantCatalogAndSubscriptionsUsage_Should_BeMultitenantOnly()
    {
        var multitenantOnly = Modules()
            .Where(m => !m.Module.SupportedTenancyModes.Supports(TenancyMode.SingleTenant))
            .Select(m => m.Type.Name)
            .OrderBy(n => n, StringComparer.Ordinal);

        multitenantOnly.ShouldBe(MultitenantOnly);
    }

    [Fact]
    public void AModuleThatSupportsSingleTenantMode_Should_NotReferenceTheTenantCatalog()
    {
        foreach (var type in Modules().Where(m => m.Module.SupportedTenancyModes.Supports(TenancyMode.SingleTenant)).Select(m => m.Type))
        {
            var references = type.Assembly.GetReferencedAssemblies().Select(a => a.Name).ToList();

            references.ShouldNotContain(
                n => MultitenantOnlyAssemblies.Contains(n),
                $"{type.Name} supports single-tenant mode, so it must not reference the Multitenancy module or its contracts");
        }
    }

    [Fact]
    public void SelectSupported_Should_DropTheMultitenantOnlyModules_InSingleTenantMode()
    {
        var all = ModuleAssemblyDiscovery.GetModuleAssemblies();

        var single = ModuleLoader.SelectSupported(TenancyMode.SingleTenant, all);
        var multi = ModuleLoader.SelectSupported(TenancyMode.Multitenant, all);

        single.Select(a => a.GetName().Name).ShouldNotContain("Trislab.Modules.Multitenancy");
        single.Select(a => a.GetName().Name).ShouldNotContain("Trislab.Modules.SubscriptionsUsage");
        single.Select(a => a.GetName().Name).ShouldContain("Trislab.Modules.Identity");
        multi.Length.ShouldBe(all.Length, "multi-tenant mode supports every module");
    }

    [Fact]
    public void AddModules_Should_Refuse_AMultitenantOnlyModule_InSingleTenantMode()
    {
        var builder = Host.CreateApplicationBuilder();
        builder.AddTrislabTenancy(t => t.UseSingleTenant(o =>
        {
            var f = Fixed();
            o.Id = f.Id;
            o.Name = f.Name;
            o.Country = f.Country;
            o.AdminEmail = f.AdminEmail;
        }));

        var failure = Should.Throw<InvalidOperationException>(
            () => builder.AddModules(typeof(MultitenancyModule).Assembly));

        failure.Message.ShouldContain("MultitenancyModule");
        failure.Message.ShouldContain("Multitenant");
        failure.Message.ShouldContain("SingleTenant");
        failure.Message.ShouldContain("TenancyOptions:Mode");
    }

    [Fact]
    public void EnsureSupports_Should_Pass_AModuleThatSupportsBothModes()
    {
        var module = new BothModesModule();

        Should.NotThrow(() => ModuleLoader.EnsureSupports(module, typeof(BothModesModule), TenancyMode.SingleTenant));
        Should.NotThrow(() => ModuleLoader.EnsureSupports(module, typeof(BothModesModule), TenancyMode.Multitenant));
    }

    [Fact]
    public void EnsureSupports_Should_Refuse_AModuleThatDeclaresNoMode()
    {
        var failure = Should.Throw<InvalidOperationException>(
            () => ModuleLoader.EnsureSupports(new NoModeModule(), typeof(NoModeModule), TenancyMode.Multitenant));

        failure.Message.ShouldContain("declares no tenancy mode");
    }

    [Theory]
    [InlineData("", "Name", "SI", "a@b.test", "Id")]
    [InlineData("root", "Name", "SI", "a@b.test", "root")]
    [InlineData("Bad Id", "Name", "SI", "a@b.test", "Id")]
    [InlineData("main", " ", "SI", "a@b.test", "Name")]
    [InlineData("main", "Name", "Slovenia", "a@b.test", "Country")]
    [InlineData("main", "Name", "SI", "not-an-email", "AdminEmail")]
    public void SingleTenantSettings_Should_BeRefused_When_Invalid(string id, string name, string country, string email, string mentions)
    {
        var options = new SingleTenantOptions { Id = id, Name = name, Country = country, AdminEmail = email };

        options.Validate().ShouldContain(e => e.Contains(mentions, StringComparison.Ordinal));
    }

    [Fact]
    public void SingleTenantSettings_Should_BeAccepted_When_Valid() => Fixed().Validate().ShouldBeEmpty();

    private sealed class BothModesModule : TestModule
    {
        public override TenancyModes SupportedTenancyModes => TenancyModes.All;
    }

    private sealed class NoModeModule : TestModule
    {
        public override TenancyModes SupportedTenancyModes => TenancyModes.None;
    }

    private abstract class TestModule : IModule
    {
        public abstract TenancyModes SupportedTenancyModes { get; }

        public void ConfigureServices(IHostApplicationBuilder builder)
        {
        }

        public void MapEndpoints(Microsoft.AspNetCore.Routing.IEndpointRouteBuilder endpoints)
        {
        }
    }
}
