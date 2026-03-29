$TOKEN  = 'sbp_e00892ee5e9a0faa0a348fce29a03c2f27d9a1f5'
$PROJECT = 'syirkevmpukshbgditwz'
$EMAIL   = 'er7579345@gmail.com'
$HEADERS = @{ 'Authorization' = "Bearer $TOKEN"; 'Content-Type' = 'application/json' }
$BASE    = "https://api.supabase.com/v1/projects/$PROJECT"

Write-Host "Removendo email: $EMAIL" -ForegroundColor Cyan
Write-Host ""

# --- 1. Buscar usuario na tabela usuarios ---
Write-Host "[1/4] Buscando em 'usuarios'..." -ForegroundColor Yellow
$resp = Invoke-RestMethod -Uri "https://syirkevmpukshbgditwz.supabase.co/rest/v1/usuarios?email=eq.$EMAIL&select=id,UserID,email" `
    -Headers @{
        'Authorization' = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aXJrZXZtcHVrc2hiZ2RpdHd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjgzNjM3MiwiZXhwIjoyMDU4NDEyMzcyfQ.Y_3aLJWz0B15Mk63RKqz8DgfwOlI2Nnqt-lI7iE2sJY"
        'apikey'        = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aXJrZXZtcHVrc2hiZ2RpdHd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjgzNjM3MiwiZXhwIjoyMDU4NDEyMzcyfQ.Y_3aLJWz0B15Mk63RKqz8DgfwOlI2Nnqt-lI7iE2sJY"
    } -ErrorAction SilentlyContinue

if ($resp) {
    Write-Host "  Encontrado em 'usuarios': $($resp | ConvertTo-Json -Depth 2)" -ForegroundColor Green
} else {
    Write-Host "  Nao encontrado em 'usuarios'" -ForegroundColor Gray
}

$SB_URL = "https://syirkevmpukshbgditwz.supabase.co/rest/v1"
$SB_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aXJrZXZtcHVrc2hiZ2RpdHd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjgzNjM3MiwiZXhwIjoyMDU4NDEyMzcyfQ.Y_3aLJWz0B15Mk63RKqz8DgfwOlI2Nnqt-lI7iE2sJY"

$SB_HEADERS = @{
    'Authorization' = "Bearer $SB_KEY"
    'apikey'        = $SB_KEY
    'Content-Type'  = 'application/json'
    'Prefer'        = 'return=representation'
}

function Invoke-SupabaseGet($table, $filter) {
    $url = "$SB_URL/$table`?$filter&select=*"
    try {
        return Invoke-RestMethod -Uri $url -Headers $SB_HEADERS -Method GET -ErrorAction Stop
    } catch {
        Write-Host "    Erro GET $table`: $($_.Exception.Message)" -ForegroundColor DarkRed
        return @()
    }
}

function Invoke-SupabaseDelete($table, $filter) {
    $url = "$SB_URL/$table`?$filter"
    try {
        $result = Invoke-RestMethod -Uri $url -Headers $SB_HEADERS -Method DELETE -ErrorAction Stop
        return $true
    } catch {
        Write-Host "    Erro DELETE $table`: $($_.Exception.Message)" -ForegroundColor DarkRed
        return $false
    }
}

# --- 2. Deletar de 'usuarios' ---
Write-Host ""
Write-Host "[2/4] Deletando de 'usuarios'..." -ForegroundColor Yellow
$usuarios = Invoke-SupabaseGet "usuarios" "email=eq.$EMAIL"
if ($usuarios -and $usuarios.Count -gt 0) {
    foreach ($u in $usuarios) {
        Write-Host "  Deletando usuario ID: $($u.id) (UserID: $($u.UserID))" -ForegroundColor Cyan
        $ok = Invoke-SupabaseDelete "usuarios" "email=eq.$EMAIL"
        if ($ok) { Write-Host "  ✅ Deletado de 'usuarios'" -ForegroundColor Green }
    }
} else {
    Write-Host "  Nenhum registro encontrado em 'usuarios'" -ForegroundColor Gray
}

# --- 3. Deletar de 'aluno' ---
Write-Host ""
Write-Host "[3/4] Deletando de 'aluno'..." -ForegroundColor Yellow
$alunos = Invoke-SupabaseGet "aluno" "email=eq.$EMAIL"
if ($alunos -and $alunos.Count -gt 0) {
    foreach ($a in $alunos) {
        Write-Host "  Encontrado aluno ID: $($a.id), nome: $($a.nome)" -ForegroundColor Cyan
    }
    $ok = Invoke-SupabaseDelete "aluno" "email=eq.$EMAIL"
    if ($ok) { Write-Host "  ✅ Deletado de 'aluno'" -ForegroundColor Green }
} else {
    Write-Host "  Nenhum registro encontrado em 'aluno'" -ForegroundColor Gray
}

# --- 4. Deletar do Auth via Management API ---
Write-Host ""
Write-Host "[4/4] Verificando no Auth do Supabase..." -ForegroundColor Yellow
try {
    $authUsers = Invoke-RestMethod `
        -Uri "https://api.supabase.com/v1/projects/$PROJECT/auth/users?email=$EMAIL" `
        -Headers $HEADERS `
        -Method GET `
        -ErrorAction Stop

    if ($authUsers -and $authUsers.users -and $authUsers.users.Count -gt 0) {
        foreach ($authUser in $authUsers.users) {
            Write-Host "  Encontrado no Auth: $($authUser.id) ($($authUser.email))" -ForegroundColor Cyan
            try {
                Invoke-RestMethod `
                    -Uri "https://api.supabase.com/v1/projects/$PROJECT/auth/users/$($authUser.id)" `
                    -Headers $HEADERS `
                    -Method DELETE `
                    -ErrorAction Stop
                Write-Host "  ✅ Deletado do Auth" -ForegroundColor Green
            } catch {
                Write-Host "  ⚠️  Erro ao deletar do Auth: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  Nao encontrado no Auth (ou ja removido)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Nao foi possivel acessar o Auth via API: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Operacao concluida para o email: $EMAIL" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
