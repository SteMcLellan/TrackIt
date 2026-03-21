param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('plan', 'build')]
  [string] $Mode,

  [int] $MaxIterations = 0
)

<#
Example - run the planning loop once:
  .\tools\ralph-loop.ps1 -Mode plan -MaxIterations 1

Example - run the build loop three times:
  .\tools\ralph-loop.ps1 -Mode build -MaxIterations 3
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ScriptRepoRoot {
  $scriptDirectory = Split-Path -Parent $PSCommandPath
  return [System.IO.Path]::GetFullPath((Join-Path $scriptDirectory '..'))
}

function Ensure-Directory {
  param([Parameter(Mandatory = $true)][string] $PathValue)

  if (-not (Test-Path -LiteralPath $PathValue)) {
    New-Item -ItemType Directory -Path $PathValue | Out-Null
  }
}

function Get-BranchName {
  try {
    $branch = git branch --show-current 2>$null
    if ([string]::IsNullOrWhiteSpace($branch)) {
      return '<detached>'
    }
    return $branch.Trim()
  }
  catch {
    return '<unknown>'
  }
}

function Get-PromptPath {
  param(
    [Parameter(Mandatory = $true)][string] $SelectedMode,
    [Parameter(Mandatory = $true)][string] $ResolvedRepoRoot
  )

  $fileName = switch ($SelectedMode) {
    'plan' { 'PROMPT_plan.md' }
    'build' { 'PROMPT_build.md' }
    default { throw "Unsupported mode: $SelectedMode" }
  }

  return Join-Path $ResolvedRepoRoot $fileName
}

function Write-NewLogContent {
  param(
    [Parameter(Mandatory = $true)][string] $LogPath,
    [Parameter(Mandatory = $true)][ref] $Offset
  )

  if (-not (Test-Path -LiteralPath $LogPath)) {
    return
  }

  $fileStream = [System.IO.File]::Open($LogPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    $null = $fileStream.Seek($Offset.Value, [System.IO.SeekOrigin]::Begin)
    $remainingBytes = $fileStream.Length - $Offset.Value
    if ($remainingBytes -le 0) {
      return
    }

    $buffer = New-Object byte[] $remainingBytes
    $bytesRead = $fileStream.Read($buffer, 0, $buffer.Length)
    if ($bytesRead -gt 0) {
      $Offset.Value = $fileStream.Position
      [Console]::Write([System.Text.Encoding]::UTF8.GetString($buffer, 0, $bytesRead))
    }
  }
  finally {
    $fileStream.Dispose()
  }
}

function Invoke-CodexIteration {
  param(
    [Parameter(Mandatory = $true)][string] $PromptPath,
    [Parameter(Mandatory = $true)][string] $ResolvedRepoRoot,
    [Parameter(Mandatory = $true)][string] $OutputLastMessagePath,
    [Parameter(Mandatory = $true)][string] $LogPath
  )

  Set-Content -LiteralPath $LogPath -Value ''
  $escapedPromptPath = $PromptPath.Replace("'", "''")
  $escapedRepoRoot = $ResolvedRepoRoot.Replace('"', '\"')
  $escapedLastMessagePath = $OutputLastMessagePath.Replace('"', '\"')
  $command = @(
    "`$ErrorActionPreference = 'Continue'"
    '[Console]::InputEncoding = [System.Text.Encoding]::UTF8'
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8'
    "Get-Content -LiteralPath '$escapedPromptPath' -Raw | codex exec - --full-auto --cd ""$escapedRepoRoot"" --output-last-message ""$escapedLastMessagePath"" 2>&1"
    'exit $LASTEXITCODE'
  ) -join "`n"

  $process = Start-Process `
    -FilePath powershell.exe `
    -ArgumentList @('-NoProfile', '-Command', $command) `
    -NoNewWindow `
    -PassThru `
    -RedirectStandardOutput $LogPath

  $offset = 0L
  while (-not $process.HasExited) {
    Write-NewLogContent -LogPath $LogPath -Offset ([ref]$offset)
    Start-Sleep -Milliseconds 250
    $process.Refresh()
  }

  Write-NewLogContent -LogPath $LogPath -Offset ([ref]$offset)
  return $process.ExitCode
}

$codexCommand = Get-Command codex -ErrorAction SilentlyContinue
if ($null -eq $codexCommand) {
  throw 'codex is not available on PATH.'
}

if ($MaxIterations -lt 0) {
  throw 'MaxIterations cannot be negative.'
}

$resolvedRepoRoot = Get-ScriptRepoRoot
$promptPath = Get-PromptPath -SelectedMode $Mode -ResolvedRepoRoot $resolvedRepoRoot
if (-not (Test-Path -LiteralPath $promptPath)) {
  throw "Prompt file not found: $promptPath"
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$sessionName = "$Mode-$timestamp"
$artifactsRoot = Join-Path $resolvedRepoRoot 'artifacts'
$sessionDirectory = Join-Path $artifactsRoot (Join-Path 'ralph-loop' $sessionName)

$branchName = Get-BranchName

Write-Host '========================================'
Write-Host "Mode:         $Mode"
Write-Host "Prompt:       $promptPath"
Write-Host "Branch:       $branchName"
if ($MaxIterations -gt 0) {
  Write-Host "Max:          $MaxIterations iteration(s)"
}
else {
  Write-Host 'Max:          unlimited'
}
Write-Host 'Codex mode:   safe'
Write-Host "Artifacts:    $sessionDirectory"
Write-Host '========================================'

Ensure-Directory -PathValue $artifactsRoot
Ensure-Directory -PathValue (Join-Path $artifactsRoot 'ralph-loop')
Ensure-Directory -PathValue $sessionDirectory

$iteration = 0
$lastExitCode = 0
while ($true) {
  if ($MaxIterations -gt 0 -and $iteration -ge $MaxIterations) {
    break
  }

  $iteration++
  $lastMessagePath = Join-Path $sessionDirectory ("iteration-{0}-last-message.md" -f $iteration)
  $codexLogPath = Join-Path $sessionDirectory ("iteration-{0}-codex-output.log" -f $iteration)

  Write-Host ''
  Write-Host ("======================== LOOP {0} ========================" -f $iteration)

  $lastExitCode = Invoke-CodexIteration `
    -PromptPath $promptPath `
    -ResolvedRepoRoot $resolvedRepoRoot `
    -OutputLastMessagePath $lastMessagePath `
    -LogPath $codexLogPath

  if ($lastExitCode -ne 0) {
    Write-Warning "Codex exited with code $lastExitCode during iteration $iteration."
  }
}

if ($MaxIterations -gt 0) {
  Write-Host ''
  Write-Host "Reached max iterations: $MaxIterations"
}

exit $lastExitCode
