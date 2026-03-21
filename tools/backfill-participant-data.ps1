param(
  [Parameter(Mandatory = $true)]
  [string] $ParticipantId,

  [Parameter(Mandatory = $true)]
  [string] $FromDate,

  [Parameter(Mandatory = $true)]
  [string] $AppToken,

  [string] $ApiBaseUrl = 'http://localhost:7071/api',

  [string] $UserId,

  [switch] $DryRun,

  [switch] $SkipMedicationLogs,

  [switch] $SkipIncidents,

  [switch] $SkipReflections,

  [int] $IncidentsCount = 5
)

<#
Example — dry run:
  .\tools\backfill-participant-data.ps1 `
    -AppToken "<token>" `
    -ParticipantId "participant_<id>" `
    -FromDate "2025-12-01" `
    -DryRun

Example — live run (last 5 days):
  .\tools\backfill-participant-data.ps1 `
    -AppToken "<token>" `
    -ParticipantId "participant_<id>" `
    -FromDate (Get-Date).AddDays(-5).ToString('yyyy-MM-dd')
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ─── Helpers ────────────────────────────────────────────────────────────────

function Build-Headers {
  param([Parameter(Mandatory = $true)][string] $Token)
  return @{
    'Authorization' = "Bearer $Token"
    'Content-Type'  = 'application/json'
  }
}

function Get-DateRange {
  param(
    [Parameter(Mandatory = $true)][datetime] $From,
    [Parameter(Mandatory = $true)][datetime] $To
  )
  $dates = [System.Collections.Generic.List[datetime]]::new()
  $cursor = $From.Date
  $end = $To.Date
  while ($cursor -le $end) {
    $dates.Add($cursor)
    $cursor = $cursor.AddDays(1)
  }
  return $dates.ToArray()
}

function Get-RandomInt {
  param(
    [Parameter(Mandatory = $true)][int] $Min,
    [Parameter(Mandatory = $true)][int] $Max
  )
  return Get-Random -Minimum $Min -Maximum ($Max + 1)
}

function Invoke-ApiCall {
  param(
    [Parameter(Mandatory = $true)][string] $Method,
    [Parameter(Mandatory = $true)][string] $Url,
    [Parameter(Mandatory = $true)] $Headers,
    [string] $Body
  )
  try {
    $params = @{
      Method  = $Method
      Uri     = $Url
      Headers = $Headers
    }
    if ($Body) {
      $params.Body = $Body
    }
    $value = Invoke-RestMethod @params
    return @{ ok = $true; value = $value; error = $null }
  }
  catch {
    $msg = $_.Exception.Message
    try {
      $detail = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
      if ($detail.message) { $msg = $detail.message }
      elseif ($detail.errors) { $msg = ($detail.errors | ForEach-Object { $_.message }) -join '; ' }
    }
    catch { }
    return @{ ok = $false; value = $null; error = $msg }
  }
}

# ─── Startup ────────────────────────────────────────────────────────────────

$tzOffsetMinutes = [int][System.TimeZoneInfo]::Local.GetUtcOffset([DateTime]::Now).TotalMinutes

$today = [datetime]::Today
$fromParsed = [datetime]::ParseExact($FromDate, 'yyyy-MM-dd', $null)
if ($fromParsed -gt $today) {
  throw "FromDate ($FromDate) cannot be in the future."
}

$cutoff30 = $today.AddDays(-30)
$dateRange = Get-DateRange -From $fromParsed -To $today

$datesOutside30 = @($dateRange | Where-Object { $_ -lt $cutoff30 })
$datesInWindow  = @($dateRange | Where-Object { $_ -ge $cutoff30 })

Write-Host "Starting participant data backfill..."
Write-Host "API base:          $ApiBaseUrl"
Write-Host "Participant:       $ParticipantId"
if ($UserId) {
  Write-Host "User:              $UserId"
}
Write-Host "Date range:        $FromDate -> $($today.ToString('yyyy-MM-dd'))  ($($dateRange.Count) days)"
Write-Host "TZ offset:         $tzOffsetMinutes min"
Write-Host "Dry run:           $($DryRun.IsPresent)"
Write-Host "Skip reflections:  $($SkipReflections.IsPresent)"
Write-Host "Skip med logs:     $($SkipMedicationLogs.IsPresent)"
Write-Host "Skip incidents:    $($SkipIncidents.IsPresent)"
Write-Host "Incidents count:   $IncidentsCount"

if ($datesOutside30.Count -gt 0) {
  Write-Warning "$($datesOutside30.Count) date(s) in the range fall outside the 30-day medication-log window and will be skipped for medication logs."
}

Write-Host ""

$headers = Build-Headers -Token $AppToken

# ─── Counters ───────────────────────────────────────────────────────────────

$reflectionStats  = @{ created = 0; failed = 0 }
$medLogStats      = @{ created = 0; failed = 0; skipped = 0 }
$incidentStats    = @{ created = 0; failed = 0 }

# ─── Daily Reflections ──────────────────────────────────────────────────────

if (-not $SkipReflections.IsPresent) {
  Write-Host "── Daily reflections ───────────────────────────────────────"
  foreach ($date in $dateRange) {
    $dateStr = $date.ToString('yyyy-MM-dd')
    if ($DryRun.IsPresent) {
      Write-Host "  [DRY RUN] Would create daily-reflection for $dateStr"
      $reflectionStats.created++
      continue
    }

    $body = @{
      logTzOffsetMinutes = $tzOffsetMinutes
      moodScore          = Get-RandomInt -Min 40 -Max 80
      focusScore         = Get-RandomInt -Min 40 -Max 80
      energyScore        = Get-RandomInt -Min 40 -Max 80
      sleepScore         = Get-RandomInt -Min 40 -Max 80
    } | ConvertTo-Json

    $url    = "$ApiBaseUrl/participants/$ParticipantId/daily-reflections/$dateStr"
    $result = Invoke-ApiCall -Method PUT -Url $url -Headers $headers -Body $body

    if ($result.ok) {
      Write-Host "  Created daily-reflection $dateStr v"
      $reflectionStats.created++
    }
    else {
      Write-Warning "  FAILED daily-reflection ${dateStr}: $($result.error)"
      $reflectionStats.failed++
    }
  }
  Write-Host ""
}

# ─── Medication Logs ─────────────────────────────────────────────────────────

if (-not $SkipMedicationLogs.IsPresent) {
  Write-Host "── Medication logs ─────────────────────────────────────────"

  if ($datesInWindow.Count -eq 0) {
    Write-Warning "  All dates fall outside the 30-day window. Skipping medication logs."
    $medLogStats.skipped = $dateRange.Count
  }
  else {
    # Paginate medications list (active only)
    $medications = [System.Collections.Generic.List[object]]::new()
    $nextToken = $null
    do {
      $medsUrl = "$ApiBaseUrl/participants/$ParticipantId/medications?pageSize=100"
      if ($nextToken) {
        $medsUrl += "&nextToken=$([System.Uri]::EscapeDataString($nextToken))"
      }
      $result = Invoke-ApiCall -Method GET -Url $medsUrl -Headers $headers
      if (-not $result.ok) {
        throw "Failed to list medications: $($result.error)"
      }
      foreach ($med in $result.value.items) {
        $medications.Add($med)
      }
      $nextToken = $result.value.nextToken
    } while ($nextToken)

    $scheduledMeds = @($medications | Where-Object { $_.frequency -ne 'as-needed' -and $null -eq $_.archivedAtUtc })
    Write-Host "  Found $($scheduledMeds.Count) active scheduled medication(s)."

    foreach ($med in $scheduledMeds) {
      $occurrenceKeys = switch ($med.frequency) {
        'once-daily'        { @('dose-1') }
        'twice-daily'       { @('dose-1', 'dose-2') }
        'three-times-daily' { @('dose-1', 'dose-2', 'dose-3') }
        default             { @() }
      }

      if ($occurrenceKeys.Count -eq 0) { continue }

      foreach ($date in $datesInWindow) {
        $dateStr = $date.ToString('yyyy-MM-dd')

        # Check medication date window
        if ($dateStr -lt $med.startDateUtc) {
          $medLogStats.skipped++
          continue
        }
        if ($med.endDateUtc -and $dateStr -gt $med.endDateUtc) {
          $medLogStats.skipped++
          continue
        }

        foreach ($occKey in $occurrenceKeys) {
          if ($DryRun.IsPresent) {
            Write-Host "  [DRY RUN] Would create med-log $($med.name) / $dateStr / $occKey"
            $medLogStats.created++
            continue
          }

          $body = @{
            status             = 'taken'
            logTzOffsetMinutes = $tzOffsetMinutes
            occurrenceKey      = $occKey
          } | ConvertTo-Json

          $url    = "$ApiBaseUrl/participants/$ParticipantId/medication-logs/$($med.id)/$dateStr"
          $result = Invoke-ApiCall -Method PUT -Url $url -Headers $headers -Body $body

          if ($result.ok) {
            Write-Host "  Created med-log $($med.name) / $dateStr / $occKey v"
            $medLogStats.created++
          }
          else {
            Write-Warning "  FAILED med-log $($med.name) / ${dateStr} / ${occKey}: $($result.error)"
            $medLogStats.failed++
          }
        }
      }
    }

    # Count dates outside window as skipped
    $medLogStats.skipped += $datesOutside30.Count * ($scheduledMeds.Count * 1)
  }
  Write-Host ""
}

# ─── Behavior Incidents ──────────────────────────────────────────────────────

if (-not $SkipIncidents.IsPresent) {
  Write-Host "── Behavior incidents ──────────────────────────────────────"

  $Antecedents  = @('Transition between activities', 'Denied preferred item', 'Loud environment', 'Demand presented', 'Waiting for preferred activity')
  $Behaviors    = @('Hit peer', 'Threw object', 'Ran away', 'Verbal outburst', 'Self-injury')
  $Consequences = @('Redirection offered', 'Break provided', 'Verbal prompt given', 'Peer moved away', 'Task modified')
  $Places       = @('home', 'school', 'community', 'therapy', 'clinic')
  $Functions    = @('sensory', 'tangible', 'escape', 'attention')
  $Times        = @('09:15', '11:30', '14:00', '15:45', '17:00')

  $totalDays = $dateRange.Count
  $count = [Math]::Min($IncidentsCount, $totalDays)

  # Spread incidents evenly across the date range
  $incidentDates = @()
  if ($count -ge $totalDays) {
    $incidentDates = $dateRange
  }
  else {
    for ($i = 0; $i -lt $count; $i++) {
      $idx = [int][Math]::Round(($i / $count) * ($totalDays - 1))
      $incidentDates += $dateRange[$idx]
    }
    # Deduplicate while preserving order
    $incidentDates = $incidentDates | Select-Object -Unique
  }

  foreach ($date in $incidentDates) {
    $dateStr = $date.ToString('yyyy-MM-dd')
    $ant     = $Antecedents  | Get-Random
    $beh     = $Behaviors    | Get-Random
    $con     = $Consequences | Get-Random
    $place   = $Places       | Get-Random
    $func    = $Functions    | Get-Random
    $time    = $Times        | Get-Random

    if ($DryRun.IsPresent) {
      Write-Host "  [DRY RUN] Would create incident for $dateStr ($beh)"
      $incidentStats.created++
      continue
    }

    $body = @{
      antecedent         = $ant
      behavior           = $beh
      consequence        = $con
      logLocalDate       = $dateStr
      logLocalTime       = $time
      logTzOffsetMinutes = $tzOffsetMinutes
      place              = $place
      function           = $func
      antecedentChips    = @($ant)
      behaviorChips      = @($beh)
      consequenceChips   = @($con)
      placeChip          = $place
    } | ConvertTo-Json

    $url    = "$ApiBaseUrl/participants/$ParticipantId/incidents"
    $result = Invoke-ApiCall -Method POST -Url $url -Headers $headers -Body $body

    if ($result.ok) {
      Write-Host "  Created incident $dateStr ($beh) v"
      $incidentStats.created++
    }
    else {
      Write-Warning "  FAILED incident ${dateStr}: $($result.error)"
      $incidentStats.failed++
    }
  }
  Write-Host ""
}

# ─── Summary ─────────────────────────────────────────────────────────────────

Write-Host "─── Seed summary ───────────────────────────────────────────────"
if (-not $SkipReflections.IsPresent) {
  Write-Host ("Daily reflections:  created={0}  failed={1}" -f $reflectionStats.created, $reflectionStats.failed)
}
if (-not $SkipMedicationLogs.IsPresent) {
  Write-Host ("Medication logs:    created={0}  failed={1}  skipped={2} (outside window or date constraints)" -f $medLogStats.created, $medLogStats.failed, $medLogStats.skipped)
}
if (-not $SkipIncidents.IsPresent) {
  Write-Host ("Incidents:          created={0}  failed={1}" -f $incidentStats.created, $incidentStats.failed)
}
Write-Host "────────────────────────────────────────────────────────────────"
