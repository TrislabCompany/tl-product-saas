namespace Integration.Tests.Infrastructure;

/// <summary>The multi-tenant host, shared by every integration test class. Not parallel: the tests share one host.</summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class TrislabCollectionDefinition : ICollectionFixture<TrislabWebApplicationFactory>
{
    public const string Name = "TrislabIntegration";
}
