#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Checks template-manifest.yaml in the template repository (docs/template-releases.md). A product repository has no
  manifest, so there it passes at once.

.DESCRIPTION
  It fails when:
    - a tracked file matches no rule of the manifest;
    - a folder in .agents/skills/ is not listed under `skills`, or a listed skill has no SKILL.md;
    - a skill's front matter does not name the template and its ownership, or its path has another ownership;
    - a skill has no pointer .claude/skills/<name>/SKILL.md with the same front matter, or a pointer has no skill;
    - the template block of AGENTS.md does not list exactly the `platform` and `shared` skills.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path 'template-manifest.yaml')) {
  Write-Host 'check-template-manifest: no template-manifest.yaml (a product repository): nothing to check.'
  exit 0
}

$manifest = Get-Content 'template-manifest.yaml' -Raw
$errors = [System.Collections.Generic.List[string]]::new()
$ownerships = 'platform', 'shared', 'product', 'template-only', 'sample'

$template = [regex]::Match($manifest, '(?m)^template:\s*(\S+)').Groups[1].Value
if ($template -ne 'template-saas') { $errors.Add("template must be template-saas, not '$template'") }

$rules = @([regex]::Matches($manifest, '(?m)^\s*-\s*\{\s*path:\s*(?<path>\S+),\s*ownership:\s*(?<own>[a-z-]+)\s*\}') | ForEach-Object {
    $glob = $_.Groups['path'].Value
    $re = '^' + ([regex]::Escape($glob).Replace('\*\*', '.*').Replace('\*', '[^/]*')) + '$'
    [pscustomobject]@{ Glob = $glob; Regex = $re; Ownership = $_.Groups['own'].Value }
  })
foreach ($rule in $rules) {
  if ($rule.Ownership -notin $ownerships) { $errors.Add("rule $($rule.Glob): unknown ownership $($rule.Ownership)") }
}

function Get-Ownership([string] $path) {
  foreach ($rule in $rules) { if ($path -match $rule.Regex) { return $rule.Ownership } }
  return $null
}

$files = @(git ls-files --cached --others --exclude-standard) | Where-Object { $_ }
foreach ($file in $files) {
  if (-not (Get-Ownership $file)) { $errors.Add("$file matches no rule in template-manifest.yaml") }
}

# skills: block
$skills = [ordered]@{}
$inSkills = $false
foreach ($line in ($manifest -split '\r?\n')) {
  if ($line -match '^skills:\s*$') { $inSkills = $true; continue }
  if ($inSkills -and $line -match '^\S') { $inSkills = $false }
  if ($inSkills -and $line -match '^\s+([a-z0-9-]+):\s*([a-z-]+)\s*(#.*)?$') { $skills[$Matches[1]] = $Matches[2] }
}

function Get-FrontMatter([string] $text) {
  $m = [regex]::Match($text, '(?s)^---\r?\n(.*?)\r?\n---')
  if ($m.Success) { return ($m.Groups[1].Value -replace '\r', '') } else { return '' }
}

$skillFolders = @(Get-ChildItem '.agents/skills' -Directory | ForEach-Object { $_.Name })
foreach ($name in $skillFolders) {
  if (-not $skills.Contains($name)) { $errors.Add(".agents/skills/$name is not listed under skills in template-manifest.yaml") }
}
foreach ($name in $skills.Keys) {
  $ownership = $skills[$name]
  if ($ownership -notin 'platform', 'shared', 'template-only') {
    $errors.Add("skill ${name}: ownership must be platform, shared or template-only, not $ownership"); continue
  }
  $path = ".agents/skills/$name/SKILL.md"
  if (-not (Test-Path $path)) { $errors.Add("skill $name is listed but $path does not exist"); continue }
  $fm = Get-FrontMatter (Get-Content $path -Raw)
  if ($fm -notmatch "(?m)^name:\s*$([regex]::Escape($name))\s*$") { $errors.Add("skill ${name}: front matter name differs") }
  if ($fm -notmatch "(?m)^\s+owner:\s*$template\s*$") { $errors.Add("skill ${name}: metadata.owner must be $template") }
  if ($fm -notmatch "(?m)^\s+ownership:\s*$ownership\s*$") { $errors.Add("skill ${name}: metadata.ownership must be $ownership") }
  $byPath = Get-Ownership $path
  if ($byPath -ne $ownership) { $errors.Add("skill ${name} is ${ownership} under skills but its path is ${byPath}") }
  $pointer = ".claude/skills/$name/SKILL.md"
  if (-not (Test-Path $pointer)) { $errors.Add("skill $name has no pointer $pointer"); continue }
  if ((Get-FrontMatter (Get-Content $pointer -Raw)) -ne $fm) { $errors.Add("${pointer}: front matter must be the same as ${path}") }
  $pointerOwnership = Get-Ownership $pointer
  if ($pointerOwnership -ne $ownership) { $errors.Add("${pointer} is ${pointerOwnership} but the skill is ${ownership}") }
}
foreach ($pointer in @(Get-ChildItem '.claude/skills' -Directory | ForEach-Object { $_.Name })) {
  if ($skillFolders -notcontains $pointer) { $errors.Add(".claude/skills/$pointer has no skill in .agents/skills") }
}

# the template block of AGENTS.md
$agents = Get-Content 'AGENTS.md' -Raw
$block = [regex]::Match($agents, '(?s)<!-- template-skills:start -->(.*?)<!-- template-skills:end -->')
if (-not $block.Success) {
  $errors.Add('AGENTS.md has no template skills block (template-skills:start and template-skills:end)')
} else {
  $listed = @([regex]::Matches($block.Groups[1].Value, '(?m)^\|\s*\[?`([a-z0-9-]+)`') | ForEach-Object { $_.Groups[1].Value } | Sort-Object)
  $expected = @($skills.Keys | Where-Object { $skills[$_] -in 'platform', 'shared' } | Sort-Object)
  if (($listed -join ',') -ne ($expected -join ',')) {
    $errors.Add("the template skills block of AGENTS.md lists [$($listed -join ', ')]; it must list the platform and shared skills [$($expected -join ', ')]")
  }
}

if ($errors.Count -gt 0) {
  $errors | ForEach-Object { Write-Host "check-template-manifest: $_" }
  Write-Host "check-template-manifest: FAILED ($($errors.Count) problems)"
  exit 1
}
Write-Host "check-template-manifest: OK ($($files.Count) files, $($skills.Count) skills)"
