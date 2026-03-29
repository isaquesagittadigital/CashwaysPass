# ============================================================
# deploy-edge-function.ps1
# Faz o deploy da Edge Function via Supabase Management API
# ============================================================

# PASSO 1: Ler o token do usuário
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  DEPLOY: process-event-invitations" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para gerar seu Personal Access Token:" -ForegroundColor Yellow
Write-Host "  1. Acesse: https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
Write-Host "  2. Clique em 'Generate new token'" -ForegroundColor Yellow
Write-Host "  3. Copie o token e cole abaixo" -ForegroundColor Yellow
Write-Host ""

$SUPABASE_ACCESS_TOKEN = Read-Host "Cole seu Supabase Personal Access Token"

if (-not $SUPABASE_ACCESS_TOKEN) {
    Write-Host "Token nao fornecido. Abortando." -ForegroundColor Red
    exit 1
}

# PASSO 2: Configuracoes
$PROJECT_REF = "syirkevmpukshbgditwz"
$FUNCTION_NAME = "process-event-invitations"
$FUNCTION_FILE = Join-Path $PSScriptRoot "supabase\functions\process-event-invitations\index.ts"

Write-Host ""
Write-Host "Lendo arquivo da funcao..." -ForegroundColor Cyan
$CODE = Get-Content $FUNCTION_FILE -Raw -Encoding UTF8

# PASSO 3: Criar o arquivo ZIP em memória (Supabase API requer multipart/form-data com ZIP)
# Alternativa: usar a CLI com o token
Write-Host "Configurando ambiente..." -ForegroundColor Cyan

$env:SUPABASE_ACCESS_TOKEN = $SUPABASE_ACCESS_TOKEN

# Verificar se supabase CLI esta no PATH ou no node_modules
$supabaseBin = $null

# Tentar encontrar o CLI
$possiblePaths = @(
    "npx",
    "$env:APPDATA\npm\supabase.cmd",
    "$env:APPDATA\npm\supabase"
)

Write-Host "Fazendo deploy via NPX Supabase CLI..." -ForegroundColor Cyan

# Usar npx com o token de ambiente
$result = & npx supabase@"1.224.0" functions deploy $FUNCTION_NAME --project-ref $PROJECT_REF 2>&1
Write-Host $result

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deploy realizado com sucesso!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Falha no deploy via CLI. Tentando via API REST..." -ForegroundColor Yellow
    Write-Host ""

    # FALLBACK: API REST direta
    # A Supabase Management API aceita o código via multipart/form-data com um ZIP
    # Vamos montar o ZIP em PowerShell
    
    $tempDir = Join-Path $env:TEMP "supabase-deploy-$(Get-Date -Format 'yyyyMMddHHmmss')"
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    
    # Copiar o arquivo para temp
    Copy-Item $FUNCTION_FILE "$tempDir\index.ts"
    
    # Criar ZIP
    $zipPath = "$tempDir\function.zip"
    Compress-Archive -Path "$tempDir\index.ts" -DestinationPath $zipPath -Force
    
    $zipBytes = [System.IO.File]::ReadAllBytes($zipPath)
    $boundary = [System.Guid]::NewGuid().ToString()
    
    # Montar multipart body
    $bodyLines = @()
    $bodyLines += "--$boundary"
    $bodyLines += 'Content-Disposition: form-data; name="file"; filename="function.zip"'
    $bodyLines += "Content-Type: application/zip"
    $bodyLines += ""
    
    $headerBytes = [System.Text.Encoding]::UTF8.GetBytes(($bodyLines -join "`r`n") + "`r`n")
    $footerBytes = [System.Text.Encoding]::UTF8.GetBytes("`r`n--$boundary--`r`n")
    
    # Combinar bytes
    $totalLength = $headerBytes.Length + $zipBytes.Length + $footerBytes.Length
    $body = New-Object byte[] $totalLength
    [System.Array]::Copy($headerBytes, 0, $body, 0, $headerBytes.Length)
    [System.Array]::Copy($zipBytes, 0, $body, $headerBytes.Length, $zipBytes.Length)
    [System.Array]::Copy($footerBytes, 0, $body, $headerBytes.Length + $zipBytes.Length, $footerBytes.Length)
    
    $apiUrl = "https://api.supabase.com/v1/projects/$PROJECT_REF/functions/$FUNCTION_NAME"
    
    try {
        $response = Invoke-RestMethod -Uri $apiUrl `
            -Method PUT `
            -Headers @{
                "Authorization" = "Bearer $SUPABASE_ACCESS_TOKEN"
                "Content-Type" = "multipart/form-data; boundary=$boundary"
            } `
            -Body $body
        
        Write-Host ""
        Write-Host "✅ Deploy via API REST realizado com sucesso!" -ForegroundColor Green
        Write-Host ($response | ConvertTo-Json)
    } catch {
        Write-Host "❌ Falha no deploy via API: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "INSTRUÇÃO MANUAL:" -ForegroundColor Yellow
        Write-Host "1. Acesse: https://supabase.com/dashboard/project/syirkevmpukshbgditwz/functions/process-event-invitations/edit"
        Write-Host "2. Substitua o código pelo conteúdo do arquivo:"
        Write-Host "   $FUNCTION_FILE"
    }
    
    # Cleanup
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
