[CmdletBinding()]
param(
    [switch]$DebugBuild,
    [switch]$SkipInstall,
    [switch]$SkipChecks
)

$ErrorActionPreference = 'Stop'
$taskRepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskTargetRoot = Join-Path $taskRepoRoot 'target'
$taskDistRoot = Join-Path $taskRepoRoot 'dist'

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    # Windows PowerShell 5.1 turns native stderr (npm warnings, cargo progress) into a terminating
    # error under 'Stop' once output is redirected. The exit code below is the real check.
    $ErrorActionPreference = 'Continue'
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed with exit code $LASTEXITCODE."
    }
}

foreach ($taskTool in @('cargo', 'node', 'npm.cmd')) {
    if (-not (Get-Command $taskTool -ErrorAction SilentlyContinue)) {
        throw "Missing build dependency: $taskTool. Install it and restart this shell."
    }
}

Push-Location -LiteralPath $taskRepoRoot
try {
    Invoke-Checked 'node' @('scripts/generate-types.mjs')
    Push-Location -LiteralPath (Join-Path $taskRepoRoot 'studio')
    try {
        if (-not $SkipInstall) { Invoke-Checked 'npm.cmd' @('ci') }
        if (-not $SkipChecks) { Invoke-Checked 'npm.cmd' @('run', 'check') }
        Invoke-Checked 'npm.cmd' @('run', 'build')
    }
    finally { Pop-Location }

    if (-not $SkipChecks) {
        Invoke-Checked 'node' @('--test', 'runtime/scene.test.js')
        Invoke-Checked 'cargo' @('fmt', '--all', '--', '--check')
        Invoke-Checked 'cargo' @('test', '--locked', '--lib', '--target-dir', $taskTargetRoot)
    }

    $taskBuildArgs = @('build', '--locked', '--target-dir', $taskTargetRoot)
    $taskProfile = 'debug'
    $taskRustFlags = $null
    if (-not $DebugBuild) {
        $taskBuildArgs += '--release'
        $taskProfile = 'release'
        # rustc writes the source path of every dependency into the executable (panic locations).
        # On Windows those paths start with the user folder, which holds the user's name, so the
        # shipped build gets short names instead. The last matching remap wins: widest first.
        $taskCargoHome = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE '.cargo' }
        $taskRustFlags = @(
            if ($env:CARGO_ENCODED_RUSTFLAGS) { $env:CARGO_ENCODED_RUSTFLAGS -split [char]0x1f }
            elseif ($env:RUSTFLAGS) { $env:RUSTFLAGS -split '\s+' | Where-Object { $_ } }
            "--remap-path-prefix=$($env:USERPROFILE.TrimEnd('\'))=~"
            "--remap-path-prefix=$($taskCargoHome.TrimEnd('\'))=cargo"
            "--remap-path-prefix=$($taskRepoRoot.TrimEnd('\'))=superint-video"
        )
    }
    $taskSavedRustFlags = $env:CARGO_ENCODED_RUSTFLAGS
    try {
        if ($taskRustFlags) { $env:CARGO_ENCODED_RUSTFLAGS = $taskRustFlags -join [char]0x1f }
        Invoke-Checked 'cargo' $taskBuildArgs
    }
    finally { $env:CARGO_ENCODED_RUSTFLAGS = $taskSavedRustFlags }

    if (-not $DebugBuild) {
        # Nothing shipped may name the build machine's user folder or checkout, in either slash.
        $taskLatin1 = [System.Text.Encoding]::GetEncoding(28591)
        foreach ($taskShipped in @('superint-video.exe', 'superint-video-app.exe')) {
            $taskShippedText = $taskLatin1.GetString([System.IO.File]::ReadAllBytes((Join-Path $taskTargetRoot "release/$taskShipped")))
            foreach ($taskLocalPath in @($env:USERPROFILE, $taskRepoRoot)) {
                $taskTrimmed = $taskLocalPath.TrimEnd('\')
                foreach ($taskSpelling in @($taskTrimmed, $taskTrimmed.Replace('\', '/'))) {
                    $taskNeedle = $taskLatin1.GetString([System.Text.Encoding]::UTF8.GetBytes($taskSpelling))
                    if ($taskShippedText.IndexOf($taskNeedle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                        throw "$taskShipped contains the local path $taskSpelling. Check the --remap-path-prefix flags in scripts/build.ps1."
                    }
                }
            }
        }
    }

    $taskBinary = Join-Path $taskTargetRoot "$taskProfile/superint-video.exe"
    $taskSchema = & $taskBinary schema
    if ($LASTEXITCODE -ne 0) { throw 'The built executable could not export its schema.' }
    $taskSchemaText = ($taskSchema -join "`n").Trim()
    $taskCheckedSchema = [System.IO.File]::ReadAllText((Join-Path $taskRepoRoot 'docs/video.schema.json')).Replace("`r`n", "`n").Trim()
    if ($taskSchemaText -ne $taskCheckedSchema) {
        throw 'Rust schema changed. Export cargo run -- schema to docs/video.schema.json, run node scripts/generate-types.mjs, then rebuild.'
    }
    if (-not $SkipChecks) {
        Invoke-Checked 'node' @('studio/verify-api.mjs', $taskBinary)
    }

    # The package is zipped from these folders, so they start empty: a file removed from the
    # repository must not linger in dist and travel into the next ZIP.
    foreach ($taskAssembled in @('docs', 'skills', 'prompts')) {
        $taskAssembledPath = Join-Path $taskDistRoot $taskAssembled
        if (Test-Path -LiteralPath $taskAssembledPath) { Remove-Item -LiteralPath $taskAssembledPath -Recurse -Force }
    }
    New-Item -ItemType Directory -Path $taskDistRoot -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $taskDistRoot 'docs') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $taskDistRoot 'skills') -Force | Out-Null
    Copy-Item -LiteralPath $taskBinary -Destination (Join-Path $taskDistRoot 'superint-video.exe') -Force
    # The app people double-click: it starts `superint-video app` from its own folder.
    Copy-Item -LiteralPath (Join-Path $taskTargetRoot "$taskProfile/superint-video-app.exe") -Destination (Join-Path $taskDistRoot 'Superint Video.exe') -Force
    Copy-Item -LiteralPath (Join-Path $taskRepoRoot 'README.md') -Destination (Join-Path $taskDistRoot 'README.md') -Force
    Copy-Item -LiteralPath (Join-Path $taskRepoRoot 'CONTRIBUTING.md') -Destination (Join-Path $taskDistRoot 'CONTRIBUTING.md') -Force
    Copy-Item -LiteralPath (Join-Path $taskRepoRoot 'CHANGELOG.md') -Destination (Join-Path $taskDistRoot 'CHANGELOG.md') -Force
    Copy-Item -LiteralPath (Join-Path $taskRepoRoot 'THIRD_PARTY_NOTICES.md') -Destination (Join-Path $taskDistRoot 'THIRD_PARTY_NOTICES.md') -Force
    Copy-Item -LiteralPath (Join-Path $taskRepoRoot 'LICENSE') -Destination (Join-Path $taskDistRoot 'LICENSE') -Force
    foreach ($taskDocument in @('HANDBUCH.md', 'FORMAT.md', 'video.schema.json', 'INTERFACES.md', 'design.md', 'REDESIGN.md', 'THIRD_PARTY_LICENSES.txt')) {
        Copy-Item -LiteralPath (Join-Path $taskRepoRoot "docs/$taskDocument") -Destination (Join-Path $taskDistRoot "docs/$taskDocument") -Force
    }
    $taskDistSkills = Join-Path $taskDistRoot 'skills'
    Get-ChildItem -LiteralPath $taskDistSkills -Directory | Remove-Item -Recurse -Force
    foreach ($taskSkill in Get-ChildItem -LiteralPath (Join-Path $taskRepoRoot 'skills') -Directory) {
        Copy-Item -LiteralPath $taskSkill.FullName -Destination $taskDistSkills -Recurse -Force
    }
    Copy-Item -LiteralPath (Join-Path $taskRepoRoot 'docs/images') -Destination (Join-Path $taskDistRoot 'docs') -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $taskRepoRoot 'prompts') -Destination $taskDistRoot -Recurse -Force

    [System.IO.File]::WriteAllLines((Join-Path $taskDistRoot 'docs/video.schema.json'), [string[]]$taskSchema, [System.Text.UTF8Encoding]::new($false))
    $taskVersion = [regex]::Match([System.IO.File]::ReadAllText((Join-Path $taskRepoRoot 'Cargo.toml')), '(?m)^version\s*=\s*"([^"]+)"').Groups[1].Value
    if (-not $taskVersion) { throw 'Could not read package version from Cargo.toml.' }
    $taskBuildSuffix = if ($DebugBuild) { '-debug' } else { '' }
    $taskArchiveName = "superint-video-$taskVersion-windows-x64$taskBuildSuffix.zip"
    $taskArchivePath = Join-Path $taskDistRoot $taskArchiveName
    $taskArchiveInputs = @('Superint Video.exe', 'superint-video.exe', 'README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'docs', 'prompts', 'skills') | ForEach-Object { Join-Path $taskDistRoot $_ }
    Compress-Archive -LiteralPath $taskArchiveInputs -DestinationPath $taskArchivePath -Force
    $taskChecksumLines = @('Superint Video.exe', 'superint-video.exe', $taskArchiveName) | ForEach-Object {
        $taskFileHash = (Get-FileHash -LiteralPath (Join-Path $taskDistRoot $_) -Algorithm SHA256).Hash.ToLowerInvariant()
        "$taskFileHash  $_"
    }
    [System.IO.File]::WriteAllLines((Join-Path $taskDistRoot 'SHA256SUMS.txt'), [string[]]$taskChecksumLines, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Built: $(Join-Path $taskDistRoot 'superint-video.exe')"
    Write-Host "App:   $(Join-Path $taskDistRoot 'Superint Video.exe')"
    Write-Host "Package: $taskArchivePath"
    Write-Host 'Run dist/superint-video.exe doctor --json to check Chrome and FFmpeg.'
}
finally { Pop-Location }
