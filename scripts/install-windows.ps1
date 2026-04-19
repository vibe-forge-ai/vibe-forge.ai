param(
  [string]$Version = "latest",
  [switch]$NoInstallNode,
  [switch]$Force,
  [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[vibe-forge] $Message"
}

function Test-Command {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Update-ProcessPath {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $processPath = [Environment]::GetEnvironmentVariable("Path", "Process")
  $env:Path = @($processPath, $machinePath, $userPath) -join ";"
}

function Add-PathForCurrentProcess {
  param([string]$PathToAdd)
  if ([string]::IsNullOrWhiteSpace($PathToAdd)) {
    return
  }
  if (!(Test-Path $PathToAdd)) {
    return
  }

  $entries = $env:Path -split ";" | Where-Object { $_ -ne "" }
  if ($entries -notcontains $PathToAdd) {
    $env:Path = "$PathToAdd;$env:Path"
  }
}

function Install-Node {
  if ($NoInstallNode) {
    throw "Node.js 22+ is required. Install or upgrade Node.js and rerun this script."
  }

  if (Test-Command winget) {
    Write-Step "Installing Node.js LTS with winget"
    winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
    Update-ProcessPath
    return
  }

  if (Test-Command scoop) {
    Write-Step "Installing Node.js LTS with Scoop"
    scoop install nodejs-lts
    Update-ProcessPath
    return
  }

  throw "Node.js is required. Install Node.js 22+ first, or install winget/Scoop so this script can install it."
}

function Get-NodeMajorVersion {
  if (!(Test-Command node)) {
    return $null
  }

  $nodeVersion = (& node --version).Trim()
  if ($nodeVersion -match "^v?(\d+)\.") {
    return [int]$Matches[1]
  }

  return $null
}

function Test-NodeRuntime {
  $major = Get-NodeMajorVersion
  return $major -ne $null -and $major -ge 22 -and (Test-Command npm)
}

if (!(Test-NodeRuntime)) {
  Install-Node
}

if (!(Test-NodeRuntime)) {
  throw "Node.js 22+ and npm are still not available. Open a new PowerShell window and rerun this script."
}

$packageSpec = if ($Version -eq "latest") {
  "@vibe-forge/cli@latest"
} else {
  "@vibe-forge/cli@$Version"
}

$npmArgs = @("install", "--global", $packageSpec)
if ($Force) {
  $npmArgs += "--force"
}

Write-Step "Installing $packageSpec"
& npm @npmArgs

$npmPrefix = (& npm config get prefix).Trim()
Update-ProcessPath
Add-PathForCurrentProcess $npmPrefix
Add-PathForCurrentProcess (Join-Path $npmPrefix "bin")

if (!$SkipVerify) {
  if (!(Test-Command vf)) {
    throw "vf was installed but is not on PATH yet. Open a new PowerShell window and run 'vf --version'."
  }

  Write-Step "Verifying vf"
  vf --version
}

Write-Step "Done. Try: vf run --help"
