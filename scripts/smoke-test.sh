#!/usr/bin/env bash
# The smoke test of ci / ci, and of the framework release gate: the app starts, migrates and seeds in
# multi-tenant mode.
#
# It starts a throw-away Postgres, runs the real migrator (`apply --seed`, then `seed-demo`), starts the
# real API, waits for /readyz, signs in as the demo admin of two tenants and reads the demo data of the
# samples Catalog and Tickets, so a broken migration, a missing seed or a module that does not start
# fails here. A product that removed a sample has the matching check removed by init-product.
#
#   bash scripts/smoke-test.sh        # needs Docker, the .NET SDK and, for the packages, PACKAGES_TOKEN
#
# SMOKE_DATABASE_URL uses a Postgres you already have instead of starting one.
set -euo pipefail

cd "$(dirname "$0")/.."
port=${SMOKE_API_PORT:-5099}
work=$(mktemp -d)
container=""
api_pid=""

cleanup() {
  [ -n "$api_pid" ] && kill "$api_pid" 2>/dev/null || true
  [ -n "$container" ] && docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

fail() { echo "smoke-test: FAILED: $*" >&2; [ -f "$work/api.log" ] && tail -n 40 "$work/api.log" >&2; exit 1; }

if [ -n "${SMOKE_DATABASE_URL:-}" ]; then
  export DATABASE_URL=$SMOKE_DATABASE_URL
else
  container=$(docker run -d --rm -e POSTGRES_PASSWORD=smoke -e POSTGRES_DB=smoke -p 127.0.0.1::5432 \
    postgres:17.11-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b)
  pg_port=$(docker port "$container" 5432/tcp | head -n1 | sed 's/.*://')
  export DATABASE_URL="postgresql://postgres:smoke@127.0.0.1:$pg_port/smoke"
fi

export PLATFORM_ENVIRONMENT=smoke
export JWT_SIGNING_KEY=smoke-test-only-jwt-signing-key-at-least-32-characters
export HANGFIRE_PASSWORD=smoke-test-hangfire-password
export SEED_ADMIN_PASSWORD='Smoke-admin-123!'
export SEED_DEMO=true
export ASPNETCORE_ENVIRONMENT=Development
export DOTNET_ENVIRONMENT=Development
export DOTNET_NOLOGO=1

echo "smoke-test: building"
dotnet build src/Host/App.DbMigrator -c Release --nologo -v q >"$work/build.log" 2>&1 || { cat "$work/build.log"; fail "build of the migrator"; }
dotnet build src/Host/App.Api -c Release --nologo -v q >>"$work/build.log" 2>&1 || { cat "$work/build.log"; fail "build of the API"; }

echo "smoke-test: migrate and seed (apply --seed)"
dotnet run --no-build -c Release --no-launch-profile --project src/Host/App.DbMigrator -- apply --seed >"$work/migrator.log" 2>&1 \
  || { cat "$work/migrator.log"; fail "the migrator failed on apply --seed"; }
echo "smoke-test: demo data (seed-demo)"
dotnet run --no-build -c Release --no-launch-profile --project src/Host/App.DbMigrator -- seed-demo >>"$work/migrator.log" 2>&1 \
  || { cat "$work/migrator.log"; fail "the migrator failed on seed-demo"; }
grep -q "\[demo-seed\] done" "$work/migrator.log" || fail "seed-demo did not finish"

echo "smoke-test: start the API"
ASPNETCORE_URLS="http://127.0.0.1:$port" dotnet run --no-build -c Release --no-launch-profile --project src/Host/App.Api >"$work/api.log" 2>&1 &
api_pid=$!
base="http://127.0.0.1:$port"
for _ in $(seq 1 90); do
  curl -fsS "$base/readyz" >/dev/null 2>&1 && break
  kill -0 "$api_pid" 2>/dev/null || fail "the API exited"
  sleep 2
done
curl -fsS "$base/readyz" >/dev/null 2>&1 || fail "/readyz never answered"
curl -fsS "$base/healthz" >/dev/null || fail "/healthz"
curl -fsS "$base/api/health/info" | grep -q '"name":"App.Api"' || fail "/api/health/info"

token_of() { # tenant email password
  local body
  body=$(curl -sS -X POST "$base/api/v1/identity/token/issue" -H 'Content-Type: application/json' -H "tenant: $1"     -d "{\"email\":\"$2\",\"password\":\"$3\"}") || true
  printf '%s' "$body" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p'
}

for who in "acme admin@acme.com Password123!" "globex admin@globex.com Password123!"; do
  set -- $who
  [ -n "$(token_of "$1" "$2" "$3")" ] || fail "$2 could not sign in to tenant $1"
  echo "smoke-test: $2 signed in"
done

acme_token=$(token_of acme admin@acme.com 'Password123!')
auth=(-H "Authorization: Bearer $acme_token" -H "tenant: acme")
curl -fsS "${auth[@]}" "$base/api/v1/catalog/products?pageNumber=1&pageSize=5" | grep -qi '"totalCount": *[1-9]' || fail "no demo products in the Catalog of acme" # [module:Catalog]
curl -fsS "${auth[@]}" "$base/api/v1/tickets?pageNumber=1&pageSize=5" | grep -qi '"totalCount": *[1-9]' || fail "no demo tickets of acme" # [module:Tickets]

echo "smoke-test: OK (migrated, seeded and started in multi-tenant mode)"
