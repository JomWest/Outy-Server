const https = require('https');
const http = require('http');
const fs = require('fs');

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
      if (options.binary) {
        // Para archivos binarios
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ 
            ok: res.statusCode >= 200 && res.statusCode < 300, 
            status: res.statusCode, 
            buffer: buffer,
            headers: res.headers
          });
        });
      } else {
        // Para respuestas JSON
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
      }
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

async function testFileRetrieval() {
  console.log('📥 Iniciando pruebas de recuperación de archivos BLOB...\n');

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
    const userId = loginData.user.id;
    console.log('✅ Token obtenido exitosamente');
    console.log(`👤 User ID: ${userId}\n`);

    // 2. Intentar recuperar imagen de perfil
    console.log('2️⃣ Probando recuperación de imagen de perfil...');
    const profileImageResponse = await makeRequest(`${API_URL}/api/files-blob/profile_image/${userId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
      binary: true
    });

    if (profileImageResponse.ok) {
      console.log('✅ Imagen de perfil recuperada exitosamente');
      console.log(`📊 Tamaño: ${profileImageResponse.buffer.length} bytes`);
      console.log(`📋 Content-Type: ${profileImageResponse.headers['content-type']}`);
      
      // Guardar archivo para verificación
      fs.writeFileSync('retrieved_profile_image.png', profileImageResponse.buffer);
      console.log('💾 Imagen guardada como "retrieved_profile_image.png"');
    } else {
      console.log('❌ Error recuperando imagen de perfil:', profileImageResponse.status);
    }

    // 3. Intentar recuperar CV
    console.log('\n3️⃣ Probando recuperación de CV...');
    const resumeResponse = await makeRequest(`${API_URL}/api/files-blob/resume/${userId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
      binary: true
    });

    if (resumeResponse.ok) {
      console.log('✅ CV recuperado exitosamente');
      console.log(`📊 Tamaño: ${resumeResponse.buffer.length} bytes`);
      console.log(`📋 Content-Type: ${resumeResponse.headers['content-type']}`);
      
      // Guardar archivo para verificación
      fs.writeFileSync('retrieved_resume.pdf', resumeResponse.buffer);
      console.log('💾 CV guardado como "retrieved_resume.pdf"');
    } else {
      console.log('❌ Error recuperando CV:', resumeResponse.status);
    }

    // 4. Verificar archivos guardados
    console.log('\n4️⃣ Verificando archivos recuperados...');
    
    if (fs.existsSync('retrieved_profile_image.png')) {
      const imageStats = fs.statSync('retrieved_profile_image.png');
      console.log(`✅ Imagen verificada: ${imageStats.size} bytes`);
    }
    
    if (fs.existsSync('retrieved_resume.pdf')) {
      const resumeStats = fs.statSync('retrieved_resume.pdf');
      console.log(`✅ CV verificado: ${resumeStats.size} bytes`);
    }

    // 5. Limpiar archivos de prueba
    console.log('\n5️⃣ Limpiando archivos de prueba...');
    try {
      if (fs.existsSync('retrieved_profile_image.png')) {
        fs.unlinkSync('retrieved_profile_image.png');
      }
      if (fs.existsSync('retrieved_resume.pdf')) {
        fs.unlinkSync('retrieved_resume.pdf');
      }
      console.log('✅ Archivos de prueba eliminados');
    } catch (cleanupError) {
      console.log('⚠️ Error limpiando archivos:', cleanupError.message);
    }

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
  }
}

// Ejecutar pruebas
testFileRetrieval();