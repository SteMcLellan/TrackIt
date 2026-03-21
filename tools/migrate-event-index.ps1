param(
  [Parameter(Mandatory = $true)]
  [string] $AppToken,

  [string] $ApiBaseUrl = 'http://localhost:7071/api',

  [string[]] $Include = @('incidents', 'medicationLogs', 'medications'),

  [int] $MaxItems = 250,

  [string] $ParticipantId,

  [switch] $DryRun,

  [switch] $SkipVerify,

  # 0 means no limit.
  [int] $MaxPages = 0
)

<#
Example:
  .\tools\migrate-event-index.ps1 -AppToken "<token>"

Participant-scoped dry-run without verify:
  .\tools\migrate-event-index.ps1 -AppToken "<token>" -ParticipantId "participant_123" -DryRun -SkipVerify
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$validSources = @('incidents', 'medicationLogs', 'medications')
$invalidSources = @($Include | Where-Object { $_ -notin $validSources })
if ($invalidSources.Count -gt 0) {
  throw "Invalid include sources: $($invalidSources -join ', '). Valid values: $($validSources -join ', ')."
}

if ($MaxItems -le 0) {
  throw 'MaxItems must be greater than zero.'
}

function Build-Headers {
  param([Parameter(Mandatory = $true)][string] $Token)
  return @{
    'Authorization' = "Bearer $Token"
    'Content-Type'  = 'application/json'
  }
}

function Try-GetPropertyValue {
  param(
    $Object,
    [Parameter(Mandatory = $true)][string] $Name
  )

  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Invoke-BackfillPage {
  param(
    [Parameter(Mandatory = $true)][string] $Url,
    [Parameter(Mandatory = $true)] $Headers,
    [Parameter(Mandatory = $true)][bool] $IsDryRun,
    [Parameter(Mandatory = $true)][string[]] $Sources,
    [Parameter(Mandatory = $true)][int] $PageSize,
    [string] $ScopeParticipantId,
    [hashtable] $Continuation
  )

  $body = @{
    dryRun = $IsDryRun
    include = $Sources
    maxItems = $PageSize
  }

  if ($ScopeParticipantId) {
    $body.participantId = $ScopeParticipantId
  }

  if ($Continuation -and $Continuation.Count -gt 0) {
    $body.continuation = $Continuation
  }

  $jsonBody = $body | ConvertTo-Json -Depth 8
  return Invoke-RestMethod -Method Post -Uri $Url -Headers $Headers -Body $jsonBody
}

function Invoke-VerifyPage {
  param(
    [Parameter(Mandatory = $true)][string] $Url,
    [Parameter(Mandatory = $true)] $Headers,
    [Parameter(Mandatory = $true)][string[]] $Sources,
    [Parameter(Mandatory = $true)][int] $PageSize,
    [string] $ScopeParticipantId,
    [hashtable] $Continuation
  )

  $body = @{
    include = $Sources
    maxItems = $PageSize
  }

  if ($ScopeParticipantId) {
    $body.participantId = $ScopeParticipantId
  }

  if ($Continuation -and $Continuation.Count -gt 0) {
    $body.continuation = $Continuation
  }

  $jsonBody = $body | ConvertTo-Json -Depth 8
  return Invoke-RestMethod -Method Post -Uri $Url -Headers $Headers -Body $jsonBody
}

function Get-NextContinuation {
  param(
    $ContinuationObject,
    [Parameter(Mandatory = $true)][string[]] $Sources
  )

  $next = @{}
  foreach ($source in $Sources) {
    $token = Try-GetPropertyValue -Object $ContinuationObject -Name $source
    if ($null -ne $token -and "$token".Length -gt 0) {
      $next[$source] = $token
    }
  }
  return $next
}

$headers = Build-Headers -Token $AppToken
$backfillUrl = "$ApiBaseUrl/internal/admin/migrations/event-index/backfill"
$verifyUrl = "$ApiBaseUrl/internal/admin/migrations/event-index/verify"

Write-Host "Starting event-index backfill..."
Write-Host "API base:        $ApiBaseUrl"
Write-Host "Sources:         $($Include -join ', ')"
Write-Host "Max items/page:  $MaxItems"
Write-Host "Dry run:         $($DryRun.IsPresent)"
if ($ParticipantId) {
  Write-Host "Participant:     $ParticipantId"
} else {
  Write-Host "Participant:     <all>"
}
Write-Host ""

$backfillTotals = @{
  scanned = 0
  projected = 0
  errors = 0
}

$backfillPage = 1
$continuation = @{}

while ($true) {
  if ($MaxPages -gt 0 -and $backfillPage -gt $MaxPages) {
    Write-Host "Reached MaxPages limit ($MaxPages) during backfill."
    break
  }

  $response = Invoke-BackfillPage `
    -Url $backfillUrl `
    -Headers $headers `
    -IsDryRun $DryRun.IsPresent `
    -Sources $Include `
    -PageSize $MaxItems `
    -ScopeParticipantId $ParticipantId `
    -Continuation $continuation

  $backfillTotals.scanned += [int]$response.scanned
  $backfillTotals.projected += [int]$response.projected
  $backfillTotals.errors += @($response.errors).Count

  Write-Host ("Backfill page {0}: scanned={1} projected={2} errors={3}" -f `
    $backfillPage, $response.scanned, $response.projected, @($response.errors).Count)

  if (@($response.errors).Count -gt 0) {
    foreach ($err in @($response.errors | Select-Object -First 5)) {
      Write-Warning ("[{0}] {1}: {2}" -f $err.source, $err.id, $err.error)
    }
    if (@($response.errors).Count -gt 5) {
      Write-Warning "Additional errors omitted for brevity."
    }
  }

  $continuation = Get-NextContinuation -ContinuationObject $response.continuation -Sources $Include
  if ($continuation.Count -eq 0) {
    break
  }

  $backfillPage++
}

Write-Host ""
Write-Host ("Backfill complete: scanned={0} projected={1} errors={2}" -f `
  $backfillTotals.scanned, $backfillTotals.projected, $backfillTotals.errors)

if ($SkipVerify.IsPresent) {
  Write-Host 'Verify step skipped.'
  exit 0
}

Write-Host ""
Write-Host "Starting event-index verify..."

$verifyTotals = @{
  scanned = 0
  matched = 0
  missing = 0
  mismatched = 0
  errors = 0
}

$verifyPage = 1
$continuation = @{}

while ($true) {
  if ($MaxPages -gt 0 -and $verifyPage -gt $MaxPages) {
    Write-Host "Reached MaxPages limit ($MaxPages) during verify."
    break
  }

  $response = Invoke-VerifyPage `
    -Url $verifyUrl `
    -Headers $headers `
    -Sources $Include `
    -PageSize $MaxItems `
    -ScopeParticipantId $ParticipantId `
    -Continuation $continuation

  $verifyTotals.scanned += [int]$response.scanned
  $verifyTotals.matched += [int]$response.matched
  $verifyTotals.missing += [int]$response.missing
  $verifyTotals.mismatched += [int]$response.mismatched
  $verifyTotals.errors += @($response.errors).Count

  Write-Host ("Verify page {0}: scanned={1} matched={2} missing={3} mismatched={4} errors={5}" -f `
    $verifyPage, $response.scanned, $response.matched, $response.missing, $response.mismatched, @($response.errors).Count)

  if (@($response.errors).Count -gt 0) {
    foreach ($err in @($response.errors | Select-Object -First 5)) {
      Write-Warning ("[{0}] {1}: {2}" -f $err.source, $err.id, $err.error)
    }
    if (@($response.errors).Count -gt 5) {
      Write-Warning "Additional errors omitted for brevity."
    }
  }

  $continuation = Get-NextContinuation -ContinuationObject $response.continuation -Sources $Include
  if ($continuation.Count -eq 0) {
    break
  }

  $verifyPage++
}

Write-Host ""
Write-Host ("Verify complete: scanned={0} matched={1} missing={2} mismatched={3} errors={4}" -f `
  $verifyTotals.scanned, $verifyTotals.matched, $verifyTotals.missing, $verifyTotals.mismatched, $verifyTotals.errors)
