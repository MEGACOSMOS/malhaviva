$ErrorActionPreference = "Stop"

$baseUrl = "https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/"
$videosDir = Join-Path -Path $PSScriptRoot -ChildPath "..\public\videos"

if (-not (Test-Path -Path $videosDir)) {
    New-Item -ItemType Directory -Path $videosDir | Out-Null
}

$videos = @(
    "Dulce.mp4",
    "Luna.mp4",
    "Sofia.mp4",
    "Frei.mp4",
    "Edson.mp4",
    "Edmilson.mp4",
    "Carlos.mp4",
    "Esvarena - 360 - A.mp4",
    "Esvarena - 360 - B.mp4",
    "Esvarena - 360 - C.mp4"
)

foreach ($video in $videos) {
    # Encode the URL properly for the spaces
    $encodedName = $video -replace " ", "%20"
    $videoUrl = "$baseUrl$encodedName"
    
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($video)
    $ext = [System.IO.Path]::GetExtension($video)
    
    $out1440p = Join-Path -Path $videosDir -ChildPath "$baseName`_1440p$ext"
    $out720p = Join-Path -Path $videosDir -ChildPath "$baseName`_720p$ext"
    
    $tempFile = Join-Path -Path $videosDir -ChildPath "$baseName`_temp$ext"
    
    if (-not (Test-Path -Path $out1440p) -or -not (Test-Path -Path $out720p)) {
        Write-Host "Processando: $video"
        
        # Download
        Write-Host "  Baixando $videoUrl ..."
        Invoke-WebRequest -Uri $videoUrl -OutFile $tempFile -TimeoutSec 0
        
        # Convert to 1440p
        if (-not (Test-Path -Path $out1440p)) {
            Write-Host "  Convertendo para 1440p..."
            & ffmpeg -y -i $tempFile -vf "scale=-2:1440" -c:v libx264 -preset fast -crf 20 -c:a aac -b:a 192k $out1440p
        }
        
        # Convert to 720p
        if (-not (Test-Path -Path $out720p)) {
            Write-Host "  Convertendo para 720p..."
            & ffmpeg -y -i $tempFile -vf "scale=-2:720" -c:v libx264 -preset fast -crf 25 -c:a aac -b:a 128k $out720p
        }
        
        # Cleanup temp file
        if (Test-Path -Path $tempFile) {
            Remove-Item -Path $tempFile -Force
        }
        Write-Host "  Concluído: $video"
    } else {
        Write-Host "Ignorado: $video (Já existem as versões 1440p e 720p)"
    }
}

Write-Host "Processamento concluído!"
