Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

param(
  # Agent/worktree IDs to create under the worktree root, e.g. a,b,c.
  [string[]] $AgentIds = @('a', 'b'),

  # Optional override for the worktree root folder. Defaults to a sibling folder named "<repo>.wt".
  [string] $WorktreesRoot
)

function Exec {
  param([Parameter(Mandatory = $true)][string] $Command, [string[]] $Args = @())
  $output = & $Command @Args 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($Command $($Args -join ' ')): $output"
  }
  return $output
}

$repoRoot = (Exec git @('rev-parse', '--show-toplevel')).Trim()
if (-not $repoRoot) {
  throw 'Unable to determine repo root via git.'
}

$repoName = Split-Path -Leaf $repoRoot
$repoParent = Split-Path -Parent $repoRoot

if (-not $WorktreesRoot) {
  $WorktreesRoot = Join-Path $repoParent "$repoName.wt"
}

Write-Host "Repo root:      $repoRoot"
Write-Host "Worktrees root: $WorktreesRoot"

New-Item -ItemType Directory -Force -Path $WorktreesRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $WorktreesRoot 'agents') | Out-Null

foreach ($id in $AgentIds) {
  if (-not $id -or $id.Trim().Length -eq 0) {
    continue
  }
  $id = $id.Trim()

  $worktreePath = Join-Path $WorktreesRoot $id
  if (Test-Path $worktreePath) {
    throw "Worktree path already exists: $worktreePath"
  }

  $branch = "agent/$id"

  Write-Host ""
  Write-Host "Creating worktree '$id' at: $worktreePath"
  Write-Host "Branch: $branch"

  # If the branch already exists, add worktree from it; otherwise create it.
  $branchExists = $false
  try {
    Exec git @('show-ref', '--verify', "--refs/heads/$branch")
    $branchExists = $true
  } catch {
    $branchExists = $false
  }

  if ($branchExists) {
    Exec git @('worktree', 'add', $worktreePath, $branch) | Out-Null
  } else {
    Exec git @('worktree', 'add', $worktreePath, '-b', $branch) | Out-Null
  }
}

Write-Host ""
Write-Host "Done."
Write-Host "Shared handoff folder: $(Join-Path $WorktreesRoot 'agents')"
