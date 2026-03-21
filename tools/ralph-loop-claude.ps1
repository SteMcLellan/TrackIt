param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('plan', 'build')]
  [string] $Mode,

  [int] $MaxIterations = 0
)

<#
Example - run the planning loop once:
  .\tools\ralph-loop-claude.ps1 -Mode plan -MaxIterations 1

Example - run the build loop three times:
  .\tools\ralph-loop-claude.ps1 -Mode build -MaxIterations 3
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$claudeCommand = Get-Command claude -ErrorAction SilentlyContinue
if ($null -eq $claudeCommand) {
  throw 'claude is not available on PATH.'
}

if ($MaxIterations -lt 0) {
  throw 'MaxIterations cannot be negative.'
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $PSCommandPath) '..'))

$promptFile = switch ($Mode) {
  'plan'  { 'PROMPT_plan.md' }
  'build' { 'PROMPT_build.md' }
}
$promptPath = Join-Path $repoRoot $promptFile
if (-not (Test-Path -LiteralPath $promptPath)) {
  throw "Prompt file not found: $promptPath"
}

$branchRaw = git branch --show-current 2>$null
$branch = if ($null -ne $branchRaw) { $branchRaw.Trim() } else { '' }
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = '<detached>' }

Write-Host '========================================'
Write-Host "Mode:   $Mode"
Write-Host "Prompt: $promptPath"
Write-Host "Branch: $branch"
if ($MaxIterations -gt 0) {
  Write-Host "Max:    $MaxIterations iteration(s)"
}
Write-Host '========================================'

Set-Location $repoRoot

$iteration = 0
$lastExitCode = 0
while ($true) {
  if ($MaxIterations -gt 0 -and $iteration -ge $MaxIterations) {
    Write-Host "Reached max iterations: $MaxIterations"
    break
  }

  $iteration++
  Write-Host "`n======================== LOOP $iteration ========================`n"

  $promptContent = Get-Content -LiteralPath $promptPath -Raw -Encoding UTF8
  claude -p $promptContent --dangerously-skip-permissions
  $lastExitCode = $LASTEXITCODE

  if ($lastExitCode -ne 0) {
    Write-Warning "Claude exited with code $lastExitCode during iteration $iteration."
  }
}

exit $lastExitCode
