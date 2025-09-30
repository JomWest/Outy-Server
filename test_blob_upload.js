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

async function testBlobUpload() {
  console.log('🧪 Iniciando pruebas de upload BLOB...\n');

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

    // 2. Crear archivo de prueba (imagen simulada)
    console.log('2️⃣ Creando archivo de prueba...');
    const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync('test_image.png', testImageBuffer);
    console.log('✅ Archivo de prueba creado\n');

    // 3. Test upload de imagen de perfil
    console.log('3️⃣ Probando upload de imagen de perfil...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream('test_image.png'), {
      filename: 'test_profile.png',
      contentType: 'image/png'
    });

    const uploadResponse = await makeRequest(`${API_URL}/api/files-blob/upload?type=profile_image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadResult = uploadResponse.json();
    
    if (uploadResponse.ok) {
      console.log('✅ Upload exitoso:', uploadResult);
    } else {
      console.log('❌ Error en upload:', uploadResult);
    }

    // 4. Limpiar archivos de prueba
    console.log('\n4️⃣ Limpiando archivos de prueba...');
    fs.unlinkSync('test_image.png');
    console.log('✅ Archivos de prueba eliminados');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
  }
}

// Ejecutar pruebas
testBlobUpload();