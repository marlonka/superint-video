[CmdletBinding()]
param(
    [string]$Destination = (Join-Path $PSScriptRoot '../examples/demo/assets'),
    [string]$FontFile = (Join-Path $env:WINDIR 'Fonts/consola.ttf'),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$taskAssetRoot = [System.IO.Path]::GetFullPath($Destination)
$taskFfmpeg = if ($env:SUPERINT_FFMPEG) { $env:SUPERINT_FFMPEG } else { 'ffmpeg' }
$taskFfprobe = if ($env:SUPERINT_FFPROBE) { $env:SUPERINT_FFPROBE } else { 'ffprobe' }

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE." }
}

function Assert-AssetPath {
    param([string]$Candidate)
    $taskResolved = [System.IO.Path]::GetFullPath($Candidate)
    $taskPrefix = $taskAssetRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $taskResolved.StartsWith($taskPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Generated file leaves the requested asset directory: $taskResolved"
    }
}

function Read-Probe {
    param([string]$Path)
    $taskProbeText = & $taskFfprobe -v error -show_streams -show_format -of json $Path
    if ($LASTEXITCODE -ne 0) { throw "ffprobe failed for $Path" }
    return (($taskProbeText -join [Environment]::NewLine) | ConvertFrom-Json)
}

New-Item -ItemType Directory -Path $taskAssetRoot -Force | Out-Null
$taskVideoPath = Join-Path $taskAssetRoot 'numbered.mp4'
$taskAudioPath = Join-Path $taskAssetRoot 'tone.wav'

if ($Force -or -not (Test-Path -LiteralPath $taskVideoPath)) {
    if (-not (Test-Path -LiteralPath $FontFile -PathType Leaf)) {
        throw 'Frame numbering needs a local font. Set -FontFile to a TTF/OTF file.'
    }
    $taskFont = [System.IO.Path]::GetFullPath($FontFile).Replace('\', '/').Replace(':', '\:').Replace("'", "\'")
    $taskFilter = "drawtext=fontfile='$taskFont':text='Source frame %{n}':fontcolor=white:fontsize=96:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.75:boxborderw=32"
    $taskTemporary = Join-Path $taskAssetRoot ('.superint-write-' + [guid]::NewGuid().ToString('N') + '.mp4')
    Assert-AssetPath $taskTemporary
    Assert-AssetPath $taskVideoPath
    try {
        Invoke-Checked $taskFfmpeg @('-v', 'error', '-nostdin', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=5', '-vf', $taskFilter, '-frames:v', '150', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', $taskTemporary)
        $taskProbe = Read-Probe $taskTemporary
        $taskStream = @($taskProbe.streams | Where-Object codec_type -eq 'video')[0]
        if ($taskStream.width -ne 1920 -or $taskStream.height -ne 1080 -or $taskStream.nb_frames -ne '150' -or $taskStream.avg_frame_rate -ne '30/1') {
            throw 'Generated video does not meet the 1920x1080 / 30 FPS / 150 frame fixture contract.'
        }
        if ((Test-Path -LiteralPath $taskVideoPath) -and -not $Force) { throw 'numbered.mp4 appeared during generation; use -Force to replace it.' }
        Move-Item -LiteralPath $taskTemporary -Destination $taskVideoPath -Force:$Force
        Write-Host "Generated: $taskVideoPath"
    }
    finally {
        if (Test-Path -LiteralPath $taskTemporary) { Remove-Item -LiteralPath $taskTemporary }
    }
}
else { Write-Host 'Keeping existing numbered.mp4. Use -Force to regenerate.' }

if ($Force -or -not (Test-Path -LiteralPath $taskAudioPath)) {
    $taskTemporary = Join-Path $taskAssetRoot ('.superint-write-' + [guid]::NewGuid().ToString('N') + '.wav')
    Assert-AssetPath $taskTemporary
    Assert-AssetPath $taskAudioPath
    try {
        Invoke-Checked $taskFfmpeg @('-v', 'error', '-nostdin', '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=15', '-ac', '2', '-c:a', 'pcm_s16le', $taskTemporary)
        $taskProbe = Read-Probe $taskTemporary
        $taskStream = @($taskProbe.streams | Where-Object codec_type -eq 'audio')[0]
        if ($taskStream.sample_rate -ne '48000' -or $taskStream.channels -ne 2 -or [Math]::Abs([double]::Parse($taskProbe.format.duration, [Globalization.CultureInfo]::InvariantCulture) - 15) -gt 0.00001) {
            throw 'Generated audio does not meet the stereo / 48 kHz / 15 second fixture contract.'
        }
        if ((Test-Path -LiteralPath $taskAudioPath) -and -not $Force) { throw 'tone.wav appeared during generation; use -Force to replace it.' }
        Move-Item -LiteralPath $taskTemporary -Destination $taskAudioPath -Force:$Force
        Write-Host "Generated: $taskAudioPath"
    }
    finally {
        if (Test-Path -LiteralPath $taskTemporary) { Remove-Item -LiteralPath $taskTemporary }
    }
}
else { Write-Host 'Keeping existing tone.wav. Use -Force to regenerate.' }
