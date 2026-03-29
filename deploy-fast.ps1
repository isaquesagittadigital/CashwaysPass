$TOKEN = 'sbp_e00892ee5e9a0faa0a348fce29a03c2f27d9a1f5'
$PROJECT = 'syirkevmpukshbgditwz'
$SLUG    = $args[0]
$FILE    = Join-Path $PSScriptRoot "supabase\functions\$SLUG\index.ts"

if (-not $SLUG) {
    Write-Host 'Uso: deploy-fast.ps1 <nome-da-funcao>' -ForegroundColor Yellow
    exit 1
}

Write-Host "Lendo arquivo: $FILE" -ForegroundColor Cyan
$codeBytes = [System.IO.File]::ReadAllBytes($FILE)

$boundary = "------" + [System.Guid]::NewGuid().ToString('N')

$metaJson  = "{`"entrypoint_path`":`"index.ts`",`"name`":`"$SLUG`",`"verify_jwt`":false}"
$metaPart  = "--$boundary`r`n"
$metaPart += "Content-Disposition: form-data; name=`"metadata`"`r`n"
$metaPart += "Content-Type: application/json`r`n`r`n"
$metaPart += "$metaJson`r`n"

$filePart  = "--$boundary`r`n"
$filePart += "Content-Disposition: form-data; name=`"file`"; filename=`"index.ts`"`r`n"
$filePart += "Content-Type: application/typescript`r`n`r`n"

$footer    = "`r`n--$boundary--`r`n"

$metaBytes  = [System.Text.Encoding]::UTF8.GetBytes($metaPart)
$fileHeader = [System.Text.Encoding]::UTF8.GetBytes($filePart)
$footBytes  = [System.Text.Encoding]::UTF8.GetBytes($footer)

$totalLen = $metaBytes.Length + $fileHeader.Length + $codeBytes.Length + $footBytes.Length
$body     = New-Object byte[] $totalLen
$offset   = 0

[System.Buffer]::BlockCopy($metaBytes,  0, $body, $offset, $metaBytes.Length);  $offset += $metaBytes.Length
[System.Buffer]::BlockCopy($fileHeader, 0, $body, $offset, $fileHeader.Length); $offset += $fileHeader.Length
[System.Buffer]::BlockCopy($codeBytes,  0, $body, $offset, $codeBytes.Length);  $offset += $codeBytes.Length
[System.Buffer]::BlockCopy($footBytes,  0, $body, $offset, $footBytes.Length)

$url = "https://api.supabase.com/v1/projects/$PROJECT/functions/deploy?slug=$SLUG"
Write-Host "Enviando para: $url" -ForegroundColor Cyan

try {
    $resp = Invoke-RestMethod `
        -Uri $url `
        -Method POST `
        -Headers @{
            'Authorization' = "Bearer $TOKEN"
            'Content-Type'  = "multipart/form-data; boundary=$boundary"
        } `
        -Body $body `
        -ErrorAction Stop

    Write-Host ''
    Write-Host "[OK] DEPLOY '$SLUG' REALIZADO COM SUCESSO!" -ForegroundColor Green
    Write-Host ($resp | ConvertTo-Json -Depth 4)

} catch {
    Write-Host ''
    Write-Host "[ERRO] Deploy de '$SLUG' falhou:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    try {
        $errBody = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host ($errBody | ConvertTo-Json -Depth 3)
    } catch {
        Write-Host $_.ErrorDetails.Message
    }
}
