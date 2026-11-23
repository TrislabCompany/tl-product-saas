# The api image. Stage 1 publishes the API with the .NET SDK. Stage 2 is the
# chiseled ASP.NET runtime: no shell, no package manager, a non-root user, and
# the API on port 8080. Both base images are pinned by digest; Renovate bumps
# them from roadmap phase 12 on. The build context is the repository root.

FROM mcr.microsoft.com/dotnet/sdk:10.0.404-noble@sha256:fe0fd4e93bd2fbb47c883b7a6369e5c8d3db8bf01cdc5981f6ee35fbdf3ff4fb AS build
WORKDIR /repo
# The whole of src/ but the tests (.dockerignore): Directory.Build.props and
# Directory.Packages.props hold the versions, the framework packages included.
COPY global.json nuget.config ./
COPY src/ src/
# The Trislab packages come from GitHub Packages (nuget.config). The token is a BuildKit secret, never part of
# a layer: `docker build --secret id=packages,env=PACKAGES_TOKEN` (ci / ci and docker compose do).
RUN --mount=type=secret,id=packages PACKAGES_TOKEN="$(cat /run/secrets/packages)" dotnet restore src/Host/App.Api/App.Api.csproj
RUN dotnet publish src/Host/App.Api/App.Api.csproj --configuration Release --no-restore --output /app \
    && mkdir -p /uploads

FROM mcr.microsoft.com/dotnet/aspnet:10.0.15-noble-chiseled@sha256:7c625e44e5d588b4d7b2a913e94ca4bd5098ce47442da404829e4c7936a764e1
WORKDIR /app
COPY --from=build /app .
# Local disk storage, used when the stamp has no storage service: the only
# folder the non-root user may write. Its files are lost on restart.
COPY --from=build --chown=$APP_UID:$APP_UID /uploads ./wwwroot/uploads
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "App.Api.dll"]
