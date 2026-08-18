# ============================================================================
# Patch GLB to embed a texture image
# 
# Reads an existing GLB file, injects a JPEG texture into the binary buffer,
# and updates the glTF JSON to reference it via baseColorTexture on material 0.
# ============================================================================

param(
    [string]$GlbPath = (Join-Path $PSScriptRoot "..\public\models\mapa.glb"),
    [string]$TexturePath = (Join-Path $PSScriptRoot "texture_4k.jpg"),
    [string]$OutputPath = (Join-Path $PSScriptRoot "..\public\models\mapa.glb")
)

Write-Host "=========================================="
Write-Host "  GLB Texture Patcher"
Write-Host "=========================================="
Write-Host ""

# Validate inputs
if (-not (Test-Path $GlbPath)) {
    Write-Error "GLB file not found: $GlbPath"
    exit 1
}
if (-not (Test-Path $TexturePath)) {
    Write-Error "Texture file not found: $TexturePath"
    exit 1
}

Write-Host "Input GLB:  $GlbPath"
Write-Host "Texture:    $TexturePath"
Write-Host "Output GLB: $OutputPath"
Write-Host ""

# --- Step 1: Read the GLB file ---
Write-Host "Step 1: Reading GLB file..."
$glbBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $GlbPath).Path)
$glbLength = $glbBytes.Length
Write-Host "  GLB size: $([math]::Round($glbLength / 1MB, 1)) MB"

# Parse GLB header
$magic = [System.BitConverter]::ToUInt32($glbBytes, 0)
$version = [System.BitConverter]::ToUInt32($glbBytes, 4)
# $totalLength = [System.BitConverter]::ToUInt32($glbBytes, 8)

if ($magic -ne 0x46546C67) {
    Write-Error "Not a valid GLB file (bad magic number)"
    exit 1
}
if ($version -ne 2) {
    Write-Error "Unsupported GLB version: $version"
    exit 1
}

Write-Host "  GLB version: $version"

# Parse JSON chunk
$jsonChunkLength = [System.BitConverter]::ToUInt32($glbBytes, 12)
$jsonChunkType = [System.BitConverter]::ToUInt32($glbBytes, 16)

if ($jsonChunkType -ne 0x4E4F534A) {
    Write-Error "First chunk is not JSON"
    exit 1
}

$jsonBytes = New-Object byte[] $jsonChunkLength
[Array]::Copy($glbBytes, 20, $jsonBytes, 0, $jsonChunkLength)
$jsonStr = [System.Text.Encoding]::UTF8.GetString($jsonBytes).TrimEnd()

Write-Host "  JSON chunk: $jsonChunkLength bytes"

# Parse BIN chunk
$binOffset = 20 + $jsonChunkLength
$binChunkLength = [System.BitConverter]::ToUInt32($glbBytes, $binOffset)
$binChunkType = [System.BitConverter]::ToUInt32($glbBytes, $binOffset + 4)

if ($binChunkType -ne 0x004E4942) {
    Write-Error "Second chunk is not BIN"
    exit 1
}

$binBytes = New-Object byte[] $binChunkLength
[Array]::Copy($glbBytes, $binOffset + 8, $binBytes, 0, $binChunkLength)

Write-Host "  BIN chunk: $([math]::Round($binChunkLength / 1MB, 1)) MB"
Write-Host ""

# --- Step 2: Read the texture image ---
Write-Host "Step 2: Reading texture image..."
$textureBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $TexturePath).Path)
$textureSize = $textureBytes.Length
Write-Host "  Texture size: $([math]::Round($textureSize / 1MB, 1)) MB"
Write-Host ""

# --- Step 3: Modify the glTF JSON ---
Write-Host "Step 3: Updating glTF JSON..."

# Parse JSON
$gltf = $jsonStr | ConvertFrom-Json

# Current buffer views count (for new buffer view index)
$existingBufViews = $gltf.bufferViews.Count
$newBufViewIndex = $existingBufViews

# Image byte offset in the binary buffer (appended after existing data)
$imageByteOffset = $binChunkLength
# Pad to 4-byte alignment
$padding = (4 - ($imageByteOffset % 4)) % 4
$imageByteOffset += $padding

# Add a new bufferView for the image
$imageBufView = [PSCustomObject]@{
    buffer     = 0
    byteOffset = $imageByteOffset
    byteLength = $textureSize
}

# Determine mime type
$ext = [System.IO.Path]::GetExtension($TexturePath).ToLower()
$mimeType = switch ($ext) {
    ".jpg"  { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".png"  { "image/png" }
    default { "image/jpeg" }
}

# Add image
$imageObj = [PSCustomObject]@{
    bufferView = $newBufViewIndex
    mimeType   = $mimeType
}

# Add sampler (linear filtering, repeat wrapping)
$samplerObj = [PSCustomObject]@{
    magFilter = 9729  # LINEAR
    minFilter = 9987  # LINEAR_MIPMAP_LINEAR
    wrapS     = 10497 # REPEAT
    wrapT     = 10497 # REPEAT
}

# Add texture
$textureObj = [PSCustomObject]@{
    sampler = 0
    source  = 0
}

# Initialize arrays if they don't exist
if (-not $gltf.PSObject.Properties['images']) {
    $gltf | Add-Member -NotePropertyName 'images' -NotePropertyValue @()
}
if (-not $gltf.PSObject.Properties['samplers']) {
    $gltf | Add-Member -NotePropertyName 'samplers' -NotePropertyValue @()
}
if (-not $gltf.PSObject.Properties['textures']) {
    $gltf | Add-Member -NotePropertyName 'textures' -NotePropertyValue @()
}

# Add to arrays
$bufViewsList = [System.Collections.ArrayList]@($gltf.bufferViews)
$bufViewsList.Add($imageBufView) | Out-Null
$gltf.bufferViews = $bufViewsList.ToArray()

$imagesList = [System.Collections.ArrayList]@($gltf.images)
$imagesList.Add($imageObj) | Out-Null
$gltf.images = $imagesList.ToArray()

$samplersList = [System.Collections.ArrayList]@($gltf.samplers)
$samplersList.Add($samplerObj) | Out-Null
$gltf.samplers = $samplersList.ToArray()

$texturesList = [System.Collections.ArrayList]@($gltf.textures)
$texturesList.Add($textureObj) | Out-Null
$gltf.textures = $texturesList.ToArray()

# Update material 0 to use baseColorTexture
$mat = $gltf.materials[0]
$pbr = $mat.pbrMetallicRoughness
$pbr | Add-Member -NotePropertyName 'baseColorTexture' -NotePropertyValue ([PSCustomObject]@{
    index = 0
}) -Force
# Set baseColorFactor to white (let texture show through fully)
$pbr.baseColorFactor = @(1.0, 1.0, 1.0, 1.0)

# Update total buffer size
$newBinSize = $imageByteOffset + $textureSize
# Pad to 4-byte alignment
$newBinPadding = (4 - ($newBinSize % 4)) % 4
$newBinSize += $newBinPadding

$gltf.buffers[0].byteLength = $newBinSize

Write-Host "  Added bufferView[$newBufViewIndex]: offset=$imageByteOffset, length=$textureSize"
Write-Host "  Added image[0]: $mimeType"
Write-Host "  Added sampler[0] and texture[0]"
Write-Host "  Updated material[0] with baseColorTexture"
Write-Host "  New buffer size: $([math]::Round($newBinSize / 1MB, 1)) MB"
Write-Host ""

# --- Step 4: Build new GLB ---
Write-Host "Step 4: Building new GLB file..."

# Serialize JSON
$newJsonStr = $gltf | ConvertTo-Json -Depth 20 -Compress
$newJsonBytes = [System.Text.Encoding]::UTF8.GetBytes($newJsonStr)
# Pad JSON to 4-byte alignment with spaces
$jsonPad = (4 - ($newJsonBytes.Length % 4)) % 4
if ($jsonPad -gt 0) {
    $spaces = [System.Text.Encoding]::UTF8.GetBytes((" " * $jsonPad))
    $paddedJson = New-Object byte[] ($newJsonBytes.Length + $jsonPad)
    [Array]::Copy($newJsonBytes, 0, $paddedJson, 0, $newJsonBytes.Length)
    [Array]::Copy($spaces, 0, $paddedJson, $newJsonBytes.Length, $spaces.Length)
    $newJsonBytes = $paddedJson
}

# Build binary buffer: original data + padding + texture + final padding
$newBinBytes = New-Object byte[] $newBinSize
[Array]::Copy($binBytes, 0, $newBinBytes, 0, $binChunkLength)
# Padding between original data and texture is already zeros
[Array]::Copy($textureBytes, 0, $newBinBytes, $imageByteOffset, $textureSize)
# Final padding is already zeros

# Compute total GLB size
$headerSize = 12
$jsonChunkHeaderSize = 8
$binChunkHeaderSize = 8
$totalGlbSize = $headerSize + $jsonChunkHeaderSize + $newJsonBytes.Length + $binChunkHeaderSize + $newBinBytes.Length

Write-Host "  JSON chunk: $($newJsonBytes.Length) bytes"
Write-Host "  BIN chunk: $($newBinBytes.Length) bytes"
Write-Host "  Total GLB: $([math]::Round($totalGlbSize / 1MB, 1)) MB"

# Assemble GLB
$outputBytes = New-Object byte[] $totalGlbSize
$offset = 0

# GLB header
[Array]::Copy([System.BitConverter]::GetBytes([uint32]0x46546C67), 0, $outputBytes, $offset, 4); $offset += 4  # magic
[Array]::Copy([System.BitConverter]::GetBytes([uint32]2), 0, $outputBytes, $offset, 4); $offset += 4            # version
[Array]::Copy([System.BitConverter]::GetBytes([uint32]$totalGlbSize), 0, $outputBytes, $offset, 4); $offset += 4 # total length

# JSON chunk header
[Array]::Copy([System.BitConverter]::GetBytes([uint32]$newJsonBytes.Length), 0, $outputBytes, $offset, 4); $offset += 4
[Array]::Copy([System.BitConverter]::GetBytes([uint32]0x4E4F534A), 0, $outputBytes, $offset, 4); $offset += 4  # 'JSON'

# JSON chunk data
[Array]::Copy($newJsonBytes, 0, $outputBytes, $offset, $newJsonBytes.Length); $offset += $newJsonBytes.Length

# BIN chunk header
[Array]::Copy([System.BitConverter]::GetBytes([uint32]$newBinBytes.Length), 0, $outputBytes, $offset, 4); $offset += 4
[Array]::Copy([System.BitConverter]::GetBytes([uint32]0x004E4942), 0, $outputBytes, $offset, 4); $offset += 4  # 'BIN\0'

# BIN chunk data
[Array]::Copy($newBinBytes, 0, $outputBytes, $offset, $newBinBytes.Length)

Write-Host ""

# --- Step 5: Write output ---
Write-Host "Step 5: Writing output..."

# Ensure output directory exists
$outDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

[System.IO.File]::WriteAllBytes((Resolve-Path $outDir).Path + "\" + (Split-Path $OutputPath -Leaf), $outputBytes)

$finalSize = $outputBytes.Length
Write-Host "  Written: $OutputPath"
Write-Host "  Size: $([math]::Round($finalSize / 1MB, 1)) MB"
Write-Host ""
Write-Host "=========================================="
Write-Host "  Done! Texture embedded successfully."
Write-Host "=========================================="
