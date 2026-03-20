
const https = require('https');

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aXJrZXZtcHVrc2hiZ2RpdHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTAxNjcsImV4cCI6MjA4ODY2NjE2N30.m4vNNZ33EUfcCxjeU78ctFyPIKxu9nFgPdLE9Y5xGDw';
const BASE_URL = 'syirkevmpukshbgditwz.supabase.co';

const data = JSON.stringify({
  action: "activate-account",
  student_id: 143,
  password: "TestPassword123"
});

const options = {
  hostname: BASE_URL,
  path: '/functions/v1/bubble-integration',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('--- TESTE DE ATIVAÇÃO DE CONTA (BUBBLE -> SUPABASE) ---');
console.log('Enviando ativação para o Aluno ID: 143 (Lucas Lima)...');

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => {
    console.log('\n--- RESPOSTA ---');
    console.log('Status HTTP:', res.statusCode);
    try {
      const parsed = JSON.parse(responseData);
      console.log('Corpo:', JSON.stringify(parsed, null, 2));
      if (parsed.success) {
        console.log('\n✅ SUCESSO: Conta ativada e senha definida.');
      } else {
        console.log('\n❌ FALHA:', parsed.error);
      }
    } catch (e) {
      console.log('Resposta (Raw):', responseData);
    }
  });
});

req.on('error', (e) => console.error('\n--- ERRO NA REQUISIÇÃO ---', e.message));
req.write(data);
req.end();
