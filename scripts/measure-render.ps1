[CmdletBinding()]
param(
    [string]$Executable = 'dist/superint-video.exe',
    [string]$Project = 'examples/demo',
    [string]$Output = 'renders/demo.mp4'
)
$ErrorActionPreference = 'Stop'
$taskExecutable = (Resolve-Path -LiteralPath $Executable).Path
$taskProject = (Resolve-Path -LiteralPath $Project).Path
$taskArtifacts = Join-Path $PSScriptRoot '../artifacts'
New-Item -ItemType Directory -Path $taskArtifacts -Force | Out-Null
$taskStdout = Join-Path $taskArtifacts 'render-result.json'
$taskStderr = Join-Path $taskArtifacts 'render-progress.log'
$taskTimer = [Diagnostics.Stopwatch]::StartNew()
$taskProcess = Start-Process -FilePath $taskExecutable -ArgumentList @('render', ('"' + $taskProject + '"'), '--output', ('"' + $Output + '"'), '--overwrite') -WindowStyle Hidden -PassThru -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr
$taskPeakBytes = 0L
$taskSamples = 0
while (-not $taskProcess.HasExited) {
    $taskInventory = @(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId -ErrorAction SilentlyContinue)
    $taskIds = [Collections.Generic.HashSet[int]]::new()
    [void]$taskIds.Add($taskProcess.Id)
    do {
        $taskFound = $false
        foreach ($taskEntry in $taskInventory) {
            if ($taskIds.Contains([int]$taskEntry.ParentProcessId) -and $taskIds.Add([int]$taskEntry.ProcessId)) { $taskFound = $true }
        }
    } while ($taskFound)
    $taskBytes = 0L
    foreach ($taskProcessId in $taskIds) {
        $taskChild = Get-Process -Id $taskProcessId -ErrorAction SilentlyContinue
        if ($taskChild) { $taskBytes += $taskChild.WorkingSet64 }
    }
    $taskPeakBytes = [Math]::Max($taskPeakBytes, $taskBytes)
    $taskSamples++
    Start-Sleep -Milliseconds 250
    $taskProcess.Refresh()
}
$taskProcess.WaitForExit()
$taskTimer.Stop()
if ($taskProcess.ExitCode -ne 0) { Get-Content -LiteralPath $taskStderr; throw 'Measured render failed.' }
$taskResult = Get-Content -LiteralPath $taskStdout -Raw | ConvertFrom-Json
$taskMeasurement = [ordered]@{
    render = $taskResult
    wallSeconds = [Math]::Round($taskTimer.Elapsed.TotalSeconds, 3)
    renderedFramesPerSecond = [Math]::Round($taskResult.frames / $taskResult.seconds, 3)
    sampledPeakProcessTreeWorkingSetBytes = $taskPeakBytes
    memorySamples = $taskSamples
    memoryNote = 'Sum of process working sets; includes shared pages more than once. Sampled, not an exact peak. Sampling adds overhead.'
    executableBytes = (Get-Item -LiteralPath $taskExecutable).Length
    os = [Environment]::OSVersion.VersionString
    processor = (Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name)
}
$taskMeasurement | ConvertTo-Json -Depth 8 | Tee-Object -FilePath (Join-Path $taskArtifacts 'benchmark.json')
