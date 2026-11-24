#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Turns a new copy of tl-product-saas into a product: keeps only the modules the product chooses.

.DESCRIPTION
  Run it once, in the first pull request of a new SaaS product repository (onboarding copies the starter there).
  Identity, Multitenancy and Auditing are always kept: Multitenancy makes the host multi-tenant, and Identity writes
  its security events through Auditing (it does not start without it). Every other module is optional:

    framework modules   Billing, Files, Notifications, Webhooks
    samples             Catalog (needs Files), Tickets, Chat (needs Files and Notifications)

  A module that is not kept is removed at creation, so the product never carries code it does not use:
    - the lines tagged `[module:<Name>]` and the blocks between `[module:<Name>:begin]` and `[module:<Name>:end]`
      in the host, the migrator, the demo seed, the solution, the front end and the smoke test;
    - a sample's folder in src/Samples, its integration tests, its pages, API calls and catalogs in clients/dashboard,
      and its coding rule;
    - when no sample is kept, src/Samples itself.
  Every tag of a module that is kept is stripped, so no tag is left in the product. A framework module's pages in the
  two front ends stay: delete them by hand, as docs/modules.md section 3 says.

  Last, it removes what only the template needs: every path of template-manifest.yaml whose ownership is
  `template-only` or `sample`, the manifest itself and this script. `.template-version` records the release of the
  template the product starts from (update-from-template reads it).

.PARAMETER Keep
  The optional modules to keep, for example -Keep Files,Notifications,Catalog. Pass -Keep none to keep none of them.

.PARAMETER Slug
  The product's id in kebab-case, for example timesheets. Names the compose project and the database trislab_<slug>
  (docs/local-ports.md).

.PARAMETER PortBlock
  The product's local port block, from 2 to 99 (0 and 1 are the starters'): the dashboard on 8080 + 10n, the admin on
  the next port, its own Postgres on 5433 + n and the Aspire dashboard on 18888 + n (docs/local-ports.md).

.PARAMETER TemplateVersion
  The template release the copy comes from, for example v0.1.0. Writes .template-version when given with -TemplateCommit.

.PARAMETER TemplateCommit
  The full commit sha of that release's tag.

.PARAMETER DryRun
  Prints what would change, and changes nothing.

.EXAMPLE
  pwsh scripts/init-product.ps1 -Keep Files,Notifications -Slug timesheets -PortBlock 2 -TemplateVersion v0.1.0 -TemplateCommit <sha>
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string[]] $Keep,
  [Parameter(Mandatory = $true)] [ValidatePattern('^[a-z][a-z0-9-]{1,40}$')] [string] $Slug,
  [Parameter(Mandatory = $true)] [ValidateRange(2, 99)] [int] $PortBlock,
  [string] $TemplateVersion,
  [string] $TemplateCommit,
  [switch] $DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Module -> what it needs.
$modules = [ordered]@{
  Billing       = @{ Kind = 'framework'; Requires = @() }
  Files         = @{ Kind = 'framework'; Requires = @() }
  Notifications = @{ Kind = 'framework'; Requires = @() }
  Webhooks      = @{ Kind = 'framework'; Requires = @() }
  Catalog       = @{ Kind = 'sample'; Requires = @('Files') }
  Tickets       = @{ Kind = 'sample'; Requires = @() }
  Chat          = @{ Kind = 'sample'; Requires = @('Files', 'Notifications') }
}
$alwaysKept = @('Identity', 'Multitenancy', 'Auditing')

# What a sample owns outside src/Samples/<Name>.
$sampleFiles = @{
  Catalog = @(
    'src/Tests/Integration.Tests/Tests/Catalog',
    'clients/dashboard/src/pages/catalog', 'clients/dashboard/src/api/catalog.ts',
    'clients/dashboard/src/components/file/product-image-manager.tsx',
    'clients/dashboard/src/locales/en-US/catalog.json', 'clients/dashboard/src/locales/sl-SI/catalog.json',
    'clients/dashboard/tests/catalog', '.claude/rules/modules/catalog.md')
  Tickets = @(
    'src/Tests/Integration.Tests/Tests/Tickets',
    'clients/dashboard/src/pages/tickets', 'clients/dashboard/src/api/tickets.ts', 'clients/dashboard/src/lib/ticket-enums.ts',
    'clients/dashboard/src/locales/en-US/tickets.json', 'clients/dashboard/src/locales/sl-SI/tickets.json',
    'clients/dashboard/tests/tickets', '.claude/rules/modules/tickets.md')
  Chat = @(
    'src/Tests/Integration.Tests/Tests/Chat',
    'clients/dashboard/src/pages/chat', 'clients/dashboard/src/api/chat.ts', 'clients/dashboard/src/realtime/use-presence.ts',
    'clients/dashboard/src/components/notifications/chat-global-notifier.tsx',
    'clients/dashboard/src/components/notifications/chat-unread-badge.tsx',
    'clients/dashboard/src/locales/en-US/chat.json', 'clients/dashboard/src/locales/sl-SI/chat.json',
    'clients/dashboard/tests/chat', '.claude/rules/modules/chat.md')
}

# ---- check the choice --------------------------------------------------------------------------------------------
$Keep = @($Keep | Where-Object { $_ -and $_ -ne 'none' } | ForEach-Object { $_.Trim() })
foreach ($k in $Keep) {
  if ($alwaysKept -contains $k) { Write-Warning "$k is always kept; ignoring it in -Keep."; continue }
  if (-not $modules.Contains($k)) { throw "Unknown module '$k'. Optional modules: $($modules.Keys -join ', '). Always kept: $($alwaysKept -join ', ')." }
}
$Keep = @($Keep | Where-Object { $modules.Contains($_) })
foreach ($k in $Keep) {
  foreach ($need in $modules[$k].Requires) {
    if ($Keep -notcontains $need) { throw "${k} needs ${need}: add ${need} to -Keep, or drop ${k}." }
  }
}
$removed = @($modules.Keys | Where-Object { $Keep -notcontains $_ })
$anySample = @($Keep | Where-Object { $modules[$_].Kind -eq 'sample' }).Count -gt 0
$keptText = (@($alwaysKept) + $Keep) -join ', '
$removedText = if ($removed.Count -gt 0) { $removed -join ', ' } else { 'nothing' }
Write-Host "init-product: keeping $keptText; removing $removedText"

# ---- the tagged lines --------------------------------------------------------------------------------------------
$tagText = '\[module:(?<name>[A-Za-z]+)(?::(?<edge>begin|end))?\]'
$trailing = '\s*(?:#|//|<!--|/\*|\{/\*)\s*' + $tagText + '\s*(?:-->|\*/\}|\*/)?\s*$'
$extensions = '.cs', '.csproj', '.slnx', '.ts', '.tsx', '.css', '.sh', '.props'
$skip = '[\\/](bin|obj|node_modules|dist|\.git)[\\/]'
$scanRoots = @('src', 'clients', 'scripts') | Where-Object { Test-Path $_ }

function Update-TaggedFile([string] $path) {
  $text = [System.IO.File]::ReadAllText($path)
  if ($text -notmatch '\[module:') { return 0 }
  $bom = $text.Length -gt 0 -and $text[0] -eq [char]0xFEFF
  $newline = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
  $lines = $text.TrimStart([char]0xFEFF) -split '\r?\n', 0
  $out = [System.Collections.Generic.List[string]]::new()
  $skipping = $null
  $changed = 0
  foreach ($line in $lines) {
    $m = [regex]::Match($line, $tagText)
    if ($skipping) {
      $changed++
      if ($m.Success -and $m.Groups['name'].Value -eq $skipping -and $m.Groups['edge'].Value -eq 'end') { $skipping = $null }
      continue
    }
    if (-not $m.Success) { $out.Add($line); continue }
    $name = $m.Groups['name'].Value
    $edge = $m.Groups['edge'].Value
    $gone = ($removed -contains $name) -or ($name -eq 'Samples' -and -not $anySample)   # Samples tags the solution folder of src/Samples
    if ($edge -eq 'begin') {
      $changed++
      if ($gone) { $skipping = $name }
      continue
    }
    if ($edge -eq 'end') { $changed++; continue }
    $changed++
    if ($gone) { continue }
    $out.Add(([regex]::Replace($line, $trailing, '')))   # a kept module's tag is stripped
  }
  if ($skipping) { throw "${path}: [module:${skipping}:begin] has no matching end." }
  if ($changed -gt 0 -and -not $DryRun) {
    $prefix = if ($bom) { [string][char]0xFEFF } else { '' }
    [System.IO.File]::WriteAllText($path, $prefix + ($out -join $newline))
  }
  return $changed
}

$touched = 0
$files = Get-ChildItem -Path $scanRoots -Recurse -File | Where-Object { $extensions -contains $_.Extension -and $_.FullName -notmatch $skip }
foreach ($file in $files) {
  if ((Update-TaggedFile $file.FullName) -gt 0) { $touched++ }
}
Write-Host "init-product: tags handled in $touched files"

# ---- a removed module's own files --------------------------------------------------------------------------------
function Remove-Path([string] $path) {
  if (Test-Path $path) {
    Write-Host "  delete $path"
    if (-not $DryRun) { Remove-Item -Recurse -Force $path }
  }
}
foreach ($name in $removed) {
  if ($modules[$name].Kind -eq 'sample') {
    Remove-Path "src/Samples/$name"
    foreach ($p in $sampleFiles[$name]) { Remove-Path $p }
  }
}
if (-not $anySample) { Remove-Path 'src/Samples' }

# ---- what only the template needs ---------------------------------------------------------------------------------
if (Test-Path 'template-manifest.yaml') {
  $manifest = Get-Content 'template-manifest.yaml' -Raw
  $rules = [regex]::Matches($manifest, '-\s*\{\s*path:\s*(?<path>\S+),\s*ownership:\s*(?<own>[a-z-]+)\s*\}')
  $all = @(git ls-files 2>$null)
  if ($all.Count -eq 0) {
    $all = @(Get-ChildItem -Recurse -File -Force | Where-Object { $_.FullName -notmatch $skip } | ForEach-Object { [System.IO.Path]::GetRelativePath($root, $_.FullName).Replace('\', '/') })
  }
  foreach ($rule in $rules) {
    if ($rule.Groups['own'].Value -notin 'template-only', 'sample') { continue }
    $glob = $rule.Groups['path'].Value
    $re = '^' + ([regex]::Escape($glob).Replace('\*\*', '.*').Replace('\*', '[^/]*')) + '$'
    foreach ($f in ($all | Where-Object { $_ -match $re })) { Remove-Path $f }
  }
  Remove-Path 'template-manifest.yaml'
}
Remove-Path 'scripts/init-product.ps1'

# ---- the local ports, database and compose project (docs/local-ports.md) ------------------------------------------
$db = 'trislab_' + $Slug.Replace('-', '_')
$web = 8080 + 10 * $PortBlock
$ports = [ordered]@{ WEB_PORT = $web; ADMIN_PORT = $web + 1; POSTGRES_PORT = 5433 + $PortBlock; ASPIRE_PORT = 18888 + $PortBlock }
$envText = Get-Content '.env.example' -Raw
foreach ($name in $ports.Keys) { $envText = $envText -replace "(?m)^$name=.*$", "$name=$($ports[$name])" }
$envText = $envText -replace '(?m)^POSTGRES_DB=.*$', "POSTGRES_DB=$db"
$envText = $envText -replace '(postgresql://[^\s/]+/)trislab_[a-z0-9_]+', "`${1}$db"
$envText = $envText -replace '(?m)^(S3_PUBLIC_ENDPOINT|PUBLIC_DASHBOARD_URL)=http://localhost:\d+', "`${1}=http://localhost:$web"
$compose = (Get-Content 'docker-compose.yml' -Raw) -replace '(?m)^name: .*$', "name: $Slug"
if (-not $DryRun) {
  [System.IO.File]::WriteAllText((Join-Path $root '.env.example'), $envText)
  [System.IO.File]::WriteAllText((Join-Path $root 'docker-compose.yml'), $compose)
}
Write-Host "init-product: local ports of block $PortBlock (dashboard $web, admin $($web + 1)), database $db, compose project $Slug"

if ($TemplateVersion -and $TemplateCommit) {
  if (-not $DryRun) {
    Set-Content -Path '.template-version' -Value @('template: template-saas', "version: $TemplateVersion", "commit: $TemplateCommit") -Encoding utf8
  }
  Write-Host "init-product: wrote .template-version ($TemplateVersion)"
} else {
  Write-Host 'init-product: no -TemplateVersion and -TemplateCommit given; write .template-version by hand (docs/upgrading/README.md).'
}

Write-Host ''
Write-Host 'init-product: done. Next:'
Write-Host '  1. dotnet build src/App.slnx && dotnet test src/App.slnx'
Write-Host '  2. npm --prefix clients/dashboard ci && npm --prefix clients/dashboard run build   (same for clients/admin)'
Write-Host '  3. bash scripts/smoke-test.sh'
Write-Host '  4. Delete the pages of a removed framework module in both front ends (docs/modules.md, section 3).'
Write-Host '  5. Rewrite README.md and AGENTS.md for the product, and commit.'
