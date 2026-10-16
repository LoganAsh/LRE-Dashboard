<#
.SYNOPSIS
  Tells the LRE dashboard whether someone is using THIS computer through Chrome Remote Desktop.

.DESCRIPTION
  Runs quietly in the background on the dedicated Bid2Win computer. Every few seconds it checks whether a Chrome Remote
  Desktop session is live, and how long it has been since anyone touched the keyboard or mouse, and reports that to the
  dashboard's database. The Bid Dashboard shows it as "Available" or "In Use".

  It sends ONLY: this computer's name, connected yes/no, and seconds since the last keyboard/mouse activity.
  It does not look at the screen, keystrokes, files, or Bid2Win itself.

  Works with the Windows PowerShell that comes with Windows (5.1) and with PowerShell 7.

.EXAMPLE
  .\Bid2Win-RemoteStatus.ps1 -Learn -Label idle        # check what this computer looks like (run once idle, once connected)
  .\Bid2Win-RemoteStatus.ps1 -Install                  # start automatically every time you sign in
  .\Bid2Win-RemoteStatus.ps1 -Uninstall                # remove it
  .\Bid2Win-RemoteStatus.ps1 -Once                     # report one time and stop (for testing)
#>
[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$Learn,
  [string]$Label = '',
  [switch]$Once,

  # Where to report (the same public address and key the dashboard website itself uses)
  [string]$SupabaseUrl = 'https://vdbrbtuidsfftgotmlol.supabase.co',
  [string]$ApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkYnJidHVpZHNmZnRnb3RtbG9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjcxNzAsImV4cCI6MjA5MTcwMzE3MH0.AKx9HFGDKU9G8g-ECr2_jm9Z281G4j58Fz8n8GDBufo',

  # A Chrome Remote Desktop session is "live" while any of these programs is running. Chrome starts the
  # "desktop process" (remoting_desktop) only when someone connects. Use -Learn to confirm this on your computer.
  [string[]]$SessionProcess = @('remoting_desktop'),

  [int]$CheckSeconds = 10,       # how often to look
  [int]$HeartbeatSeconds = 30,   # how often to report when nothing has changed (a change is reported straight away)

  [Parameter(DontShow)][int]$TestIdleSeconds = -1    # for testing only
)

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$TaskName  = 'LRE Bid2Win Status'
$IsWindowsPC = [Environment]::OSVersion.Platform -eq 'Win32NT'
$LogDir  = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'LRE'
$LogFile = Join-Path $LogDir 'bid2win-status.log'

function Write-Log([string]$Message) {
  try {
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 200KB)) { Remove-Item $LogFile -Force }   # keep the log small
    Add-Content -Path $LogFile -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
  } catch { }
}

# ── seconds since the last keyboard / mouse activity (Windows only; $null if it cannot be read) ──
if ($IsWindowsPC) {
  try {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class LreIdle {
  [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  public static long IdleSeconds() {
    LASTINPUTINFO info = new LASTINPUTINFO();
    info.cbSize = (uint)Marshal.SizeOf(info);
    if (!GetLastInputInfo(ref info)) return -1;
    return (long)(((uint)Environment.TickCount - info.dwTime) / 1000);
  }
}
"@ -ErrorAction SilentlyContinue
  } catch { }
}
function Get-IdleSeconds {
  if ($TestIdleSeconds -ge 0) { return $TestIdleSeconds }
  if (-not $IsWindowsPC) { return $null }
  try { $s = [LreIdle]::IdleSeconds(); if ($s -ge 0) { return [int]$s } } catch { }
  return $null
}

# ── is a Chrome Remote Desktop session live right now? ──
function Test-RemoteSession {
  foreach ($name in $SessionProcess) {
    if (Get-Process -Name $name -ErrorAction SilentlyContinue) { return $true }
  }
  return $false
}

# ── report to the dashboard's database ──
function Send-Status([bool]$Connected, $Idle) {
  $body = @{ p_connected = $Connected; p_host = [Environment]::MachineName }
  if ($null -ne $Idle) { $body['p_idle_seconds'] = [int]$Idle }
  Invoke-RestMethod -Method Post -Uri ($SupabaseUrl.TrimEnd('/') + '/rest/v1/rpc/lre_report_remote_status') `
    -Headers @{ apikey = $ApiKey; Authorization = "Bearer $ApiKey" } `
    -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress) -TimeoutSec 15 | Out-Null
}

# ── -Install / -Uninstall (Windows) ──
if ($Install -or $Uninstall) {
  if (-not $IsWindowsPC) { Write-Host 'Install and Uninstall are for the Windows computer that runs Bid2Win.'; exit 1 }
  if ($Uninstall) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed '$TaskName'. It will no longer start when you sign in."
    exit 0
  }
  $me = "$env:USERDOMAIN\$env:USERNAME"
  $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  if ($PSBoundParameters.ContainsKey('SessionProcess')) { $arg += ' -SessionProcess ' + (($SessionProcess | ForEach-Object { "'$_'" }) -join ',') }
  $action    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
  $trigger   = New-ScheduledTaskTrigger -AtLogOn -User $me
  $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
                 -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
  $principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "Installed and started '$TaskName' for $me."
  Write-Host 'It starts by itself every time this user signs in. Look at the Bid Dashboard: the Bid2Win Computer strip should say Available within about 30 seconds.'
  exit 0
}

# ── -Learn: print what this computer looks like, so we can confirm the detection works ──
if ($Learn) {
  $lines = New-Object System.Collections.Generic.List[string]
  function Add-Line([string]$t) { $lines.Add($t); Write-Host $t }
  Add-Line "=== Bid2Win status check ($(if ($Label) { $Label } else { 'no label' })) ==="
  Add-Line ("Time:      {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
  Add-Line ("Computer:  {0}   Windows: {1}   PowerShell: {2}" -f [Environment]::MachineName, [Environment]::OSVersion.VersionString, $PSVersionTable.PSVersion)
  Add-Line ("User:      {0}   Session: {1}" -f [Environment]::UserName, $(if ($env:SESSIONNAME) { $env:SESSIONNAME } else { '(none)' }))
  $svc = $null
  if ($IsWindowsPC) { try { $svc = Get-Service -Name chromoting -ErrorAction SilentlyContinue } catch { } }
  Add-Line ("Chrome Remote Desktop service ('chromoting'): {0}" -f $(if ($svc) { $svc.Status } else { 'not found' }))
  Add-Line ''
  Add-Line 'Chrome Remote Desktop programs running right now:'
  $procs = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'remoting*' -or $_.Name -like '*chromoting*' -or $_.Name -like 'chrome-remote*' })
  if ($procs.Count -eq 0) { Add-Line '   (none)' }
  foreach ($p in ($procs | Sort-Object Name, Id)) {
    $cmd = ''
    if ($IsWindowsPC) { try { $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)").CommandLine } catch { } }
    $extra = ''
    if ($IsWindowsPC) {
      try { $tcp = @(Get-NetTCPConnection -OwningProcess $p.Id -State Established -ErrorAction SilentlyContinue).Count } catch { $tcp = '?' }
      try { $udp = @(Get-NetUDPEndpoint -OwningProcess $p.Id -ErrorAction SilentlyContinue).Count } catch { $udp = '?' }
      $extra = "   TCP connections: $tcp   UDP endpoints: $udp"
    }
    Add-Line ("   {0,-24} id {1,-6} windows-session {2}{3}" -f $p.Name, $p.Id, $p.SessionId, $extra)
    if ($cmd) { Add-Line ("      command: {0}" -f $cmd) }
  }
  Add-Line ''
  Add-Line ("Seconds since last keyboard/mouse activity: {0}" -f $(if ($null -ne (Get-IdleSeconds)) { Get-IdleSeconds } else { '(could not read)' }))
  Add-Line ''
  foreach ($name in $SessionProcess) {
    Add-Line ("Detection by program '{0}': {1}" -f $name, $(if (Get-Process -Name $name -ErrorAction SilentlyContinue) { 'PRESENT  (would report: IN USE)' } else { 'absent   (would report: AVAILABLE)' }))
  }
  Add-Line ''
  Add-Line 'What to look for: run this once while NOBODY is connected (label: idle) and once while you ARE connected (label: connected).'
  Add-Line "The line above should say AVAILABLE when idle and IN USE when connected. If it does not, send both files so the check can be adjusted."
  $out = Join-Path $PSScriptRoot ("bid2win-check{0}.txt" -f $(if ($Label) { "-$Label" } else { '' }))
  Set-Content -Path $out -Value $lines
  Write-Host ''; Write-Host "Saved to: $out"
  exit 0
}

# ── the normal loop ──
Write-Log ("Started. Reporting to {0}; detecting by program(s): {1}" -f $SupabaseUrl, ($SessionProcess -join ', '))
$lastState = $null; $lastSent = [datetime]::MinValue; $failures = 0
while ($true) {
  $connected = Test-RemoteSession
  $due = ($null -eq $lastState) -or ($lastState -ne $connected) -or (((Get-Date) - $lastSent).TotalSeconds -ge $HeartbeatSeconds)
  if ($due) {
    try {
      Send-Status -Connected $connected -Idle (Get-IdleSeconds)
      if ($lastState -ne $connected) { Write-Log $(if ($connected) { 'Session detected: IN USE' } else { 'Session ended: AVAILABLE' }) }
      if ($failures -gt 0) { Write-Log "Reporting again after $failures failed attempt(s)."; $failures = 0 }
      $lastState = $connected; $lastSent = Get-Date
    } catch {
      $failures++
      if ($failures -eq 1 -or ($failures % 30) -eq 0) { Write-Log ("Could not report (attempt {0}): {1}" -f $failures, $_.Exception.Message) }
    }
  }
  if ($Once) { if ($failures -gt 0) { exit 2 } else { exit 0 } }
  Start-Sleep -Seconds $CheckSeconds
}
