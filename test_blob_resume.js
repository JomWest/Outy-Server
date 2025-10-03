const FormData = require('form-data');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Configuración
const API_URL = 'http://localhost:4000';
const TEST_USER_EMAIL = 'admin@outy.local';
const TEST_USER_PASSWORD = 'Outy123!';

// Función helper para hacer requests HTTP
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: () => jsonData });
        } catch (e) {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: () => data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      if (typeof options.body === 'string') {
        req.write(options.body);
      } else {
        options.body.pipe(req);
        return;
      }
    }
    
    req.end();
  });
}

async function testResumeUpload() {
  console.log('📄 Iniciando pruebas de upload de CV/Resume...\n');

  try {
    // 1. Login para obtener token
    console.log('1️⃣ Obteniendo token de autenticación...');
    const loginResponse = await makeRequest(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = loginResponse.json();
    const token = loginData.token;
    console.log('✅ Token obtenido exitosamente\n');

    // 2. Crear archivo PDF de prueba (simulado)
    console.log('2️⃣ Creando archivo PDF de prueba...');
    const testPdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test Resume) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
299
%%EOF`;
    
    // Asegurar tamaño mínimo (>1KB) para pasar validación del servidor
    const paddedPdf = testPdfContent + '\n' + '0'.repeat(2500);
    fs.writeFileSync('test_resume.pdf', paddedPdf);
    console.log('✅ Archivo PDF de prueba creado\n');

    // 3. Test upload de CV
    console.log('3️⃣ Probando upload de CV...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream('test_resume.pdf'), {
      filename: 'test_resume.pdf',
      contentType: 'application/pdf'
    });

    const uploadResponse = await makeRequest(`${API_URL}/api/files-blob/upload?type=resume`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadResult = uploadResponse.json();
    
    if (uploadResponse.ok) {
      console.log('✅ Upload de CV exitoso:', uploadResult);
    } else {
      console.log('❌ Error en upload de CV:', uploadResult);
    }

    // 4. Limpiar archivos de prueba
    console.log('\n4️⃣ Limpiando archivos de prueba...');
    fs.unlinkSync('test_resume.pdf');
    console.log('✅ Archivos de prueba eliminados');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
  }
}

// Ejecutar pruebas
testResumeUpload();