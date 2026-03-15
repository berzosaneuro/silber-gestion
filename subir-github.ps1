# Silber Gestion - Crear repo en GitHub y subir codigo
# Uso: $env:GITHUB_TOKEN = "tu_token"; .\subir-github.ps1
# O: .\subir-github.ps1 -Token "ghp_xxxx"

param([string]$Token = $env:GITHUB_TOKEN)

$repoName = "silber-gestion"
$user = "berzosaneuro"

if (-not $Token) {
    Write-Host "Necesitas un token de GitHub (con permiso repo)." -ForegroundColor Yellow
    Write-Host "1. Ve a https://github.com/settings/tokens" -ForegroundColor Cyan
    Write-Host "2. Generate new token (classic), marca 'repo'" -ForegroundColor Cyan
    Write-Host "3. Ejecuta: " -NoNewline; Write-Host "`$env:GITHUB_TOKEN = 'tu_token'; .\subir-github.ps1" -ForegroundColor Green
    exit 1
}

Write-Host "Creando repositorio en GitHub..." -ForegroundColor Cyan
$body = @{ name = $repoName; description = "Silber Gestion (NEXUS ERP)"; private = $false } | ConvertTo-Json
$headers = @{
    Authorization = "Bearer $Token"
    "Content-Type" = "application/json"
}
try {
    $r = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Body $body -Headers $headers
    Write-Host "Repo creado: $($r.html_url)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 422) {
        Write-Host "El repo ya existe, subiendo codigo..." -ForegroundColor Yellow
    } else {
        Write-Host "Error: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Subiendo codigo..." -ForegroundColor Cyan
git branch -M main 2>$null
git push -u origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "Listo: https://github.com/$user/$repoName" -ForegroundColor Green
} else {
    Write-Host "Push fallo. Comprueba que el remote sea: https://github.com/$user/$repoName" -ForegroundColor Red
}
