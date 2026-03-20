
const https = require('https');

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aXJrZXZtcHVrc2hiZ2RpdHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTAxNjcsImV4cCI6MjA4ODY2NjE2N30.m4vNNZ33EUfcCxjeU78ctFyPIKxu9nFgPdLE9Y5xGDw';
const BASE_URL = 'syirkevmpukshbgditwz.supabase.co';

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- TESTANDO INTEGRAÇÃO BUBBLE.IO ---');

  // 1. Listar Escolas
  console.log('\n[1] Testando list-schools...');
  const schoolsRes = await makeRequest('/functions/v1/bubble-integration?action=list-schools');
  console.log('Status:', schoolsRes.status);
  
  const schools = Array.isArray(schoolsRes.data) ? schoolsRes.data : (schoolsRes.data?.data || []);
  console.log('Dados:', JSON.stringify(schools, null, 2));

  if (schools.length > 0) {
    const schoolId = schools[0].id;
    console.log(`\n[2] Testando list-turmas para escola: ${schoolId}`);
    const turmasRes = await makeRequest(`/functions/v1/bubble-integration?action=list-turmas&escola_id=${schoolId}`);
    console.log('Status:', turmasRes.status);
    
    const turmas = Array.isArray(turmasRes.data) ? turmasRes.data : (turmasRes.data?.data || []);
    console.log('Dados:', JSON.stringify(turmas, null, 2));

    if (turmas.length > 0) {
        const turmaId = turmas[0].id;
        console.log(`\n[3] Testando list-alunos para turma: ${turmaId}`);
        const alunosRes = await makeRequest(`/functions/v1/bubble-integration?action=list-alunos&turma_id=${turmaId}`);
        console.log('Status:', alunosRes.status);
        
        const alunos = Array.isArray(alunosRes.data) ? alunosRes.data : (alunosRes.data?.data || []);
        console.log('Dados:', JSON.stringify(alunos, null, 2));
    }
  }
}

runTests().catch(console.error);
