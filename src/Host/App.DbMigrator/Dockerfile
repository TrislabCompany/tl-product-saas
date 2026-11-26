# The migrator image, the init container of the api app. Stage 1 publishes the
# migrator with the .NET SDK. Stage 2 is the same chiseled runtime and non-root
# user as the api image. It applies every module's migrations and the seed data
# under a Postgres advisory lock, and the demo data where SEED_DEMO is true,
# then exits. The build context is the repository root.

FROM mcr.microsoft.com/dotnet/sdk:11.0.100-resolute@sha256:2794448a07118a6eaf00f29ab5d2bf44928517ce5ff86505a63a69230374f599 AS build
WORKDIR /repo
COPY global.json nuget.config ./
COPY src/ src/
# The Trislab packages come from GitHub Packages (nuget.config). The token is a BuildKit secret, never part of
# a layer: `docker build --secret id=packages,env=PACKAGES_TOKEN` (ci / ci and docker compose do).
RUN --mount=type=secret,id=packages PACKAGES_TOKEN="$(cat /run/secrets/packages)" dotnet restore src/Host/App.DbMigrator/App.DbMigrator.csproj
RUN dotnet publish src/Host/App.DbMigrator/App.DbMigrator.csproj --configuration Release --no-restore --output /app

FROM mcr.microsoft.com/dotnet/aspnet:11.0.0-resolute-chiseled@sha256:045ba65412b8edcc2f70a779163bf4353d450f72535a0dddf6188d6d945bfaef
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
ENV DOTNET_ENVIRONMENT=Production
ENTRYPOINT ["dotnet", "App.DbMigrator.dll"]
CMD ["apply", "--seed"]
