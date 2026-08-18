$tempDir = "$env:TEMP\mvtemp2"
New-Item -ItemType Directory -Force -Path $tempDir
Copy-Item package.json "$tempDir\package.json" -Force
if (Test-Path package-lock.json) { Copy-Item package-lock.json "$tempDir\package-lock.json" -Force }
Push-Location $tempDir
npm install
Pop-Location
robocopy "$tempDir\node_modules" ".\node_modules" /E /MOVE /NFL /NDL /NJH /NJS /NC /NS /NP
exit 0
