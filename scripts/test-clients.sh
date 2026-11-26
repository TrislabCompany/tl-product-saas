#!/usr/bin/env bash
# Lints each React app and runs its Playwright tests (ci / ci runs this). The tests start the app's Vite dev
# server and answer every API call with page.route() mocks, so no backend runs. With CI set, playwright.config.ts
# uses two workers and two retries.
#
# Locally: bash scripts/test-clients.sh, with PACKAGES_TOKEN set for the framework packages (docs/getting-started.md).
# With app names (bash scripts/test-clients.sh admin), only those; scripts/affected-tests.mjs passes the apps a change
# affects.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

apps=("$@")
[ ${#apps[@]} -gt 0 ] || apps=(admin dashboard)

for app in "${apps[@]}"; do
  [ -d "$root/clients/$app" ] || { echo "test-clients: no app clients/$app" >&2; exit 1; }
  echo "== clients/$app"
  cd "$root/clients/$app"
  npm ci
  npm run lint
  # No raw colour outside a theme.css (docs/theme.md).
  npx framework-ui-check-colors src
  # Skips the download when this Chromium is already installed. --with-deps adds the system libraries on CI.
  if [ -n "${CI:-}" ]; then npx playwright install --with-deps chromium; else npx playwright install chromium; fi
  npx playwright test
done
