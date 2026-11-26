# The api image. Stage 1 publishes the API with the .NET SDK. Stage 2 is the
# chiseled ASP.NET runtime: no shell, no package manager, a non-root user, and
# the API on port 8080. Both base images are pinned by digest; Renovate bumps
# them from roadmap phase 12 on. The build context is the repository root.

FROM mcr.microsoft.com/dotnet/sdk:11.0.100-resolute@sha256:2794448a07118a6eaf00f29ab5d2bf44928517ce5ff86505a63a69230374f599 AS build
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

FROM mcr.microsoft.com/dotnet/aspnet:11.0.0-resolute-chiseled@sha256:045ba65412b8edcc2f70a779163bf4353d450f72535a0dddf6188d6d945bfaef
WORKDIR /app
COPY --from=build /app .
# Local disk storage, used when the stamp has no storage service: the only
# folder the non-root user may write. Its files are lost on restart.
COPY --from=build --chown=$APP_UID:$APP_UID /uploads ./wwwroot/uploads
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "App.Api.dll"]
