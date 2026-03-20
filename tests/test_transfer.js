
const https = require('https');

const data = JSON.stringify({
  user_id: "272e2d02-0452-49a3-9866-6c6e747ab82b",
  valor: 1,
  origem: "Saldo",
  destino: "Minha Reserva"
});

const options = {
  hostname: 'syirkevmpukshbgditwz.supabase.co',
  path: '/functions/v1/transferir-saldo',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aXJrZXZtcHVrc2hiZ2RpdHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTAxNjcsImV4cCI6MjA4ODY2NjE2N30.m4vNNZ33EUfcCxjeU78ctFyPIKxu9nFgPdLE9Y5xGDw'
  }
};

console.log('--- TESTE DE ENPOINT SUPABASE ---');
console.log('Payload:', data);

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('\n--- RESPOSTA ---');
    console.log('Status:', res.statusCode);
    try {
      console.log('Dados:', JSON.stringify(JSON.parse(responseData), null, 2));
    } catch (e) {
      console.log('Dados (Raw):', responseData);
    }
  });
});

req.on('error', (e) => {
  console.error('\n--- ERRO ---');
  console.error(e.message);
});

req.write(data);
req.end();
