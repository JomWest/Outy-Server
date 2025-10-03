const https = require('https');
const http = require('http');

const API_URL = 'http://localhost:4000';
const TEST_USER_EMAIL = 'admin@outy.local';
const TEST_USER_PASSWORD = 'Outy123!';

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
      req.write(options.body);
    }

    req.end();
  });
}

async function testUpdateSocialFields() {
  console.log('✏️ Probando edición de campos sociales en candidate_profiles...\n');

  try {
    // Login
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
    console.log(`✅ Token OK. User ID: ${userId}\n`);

    // Update candidate profile social fields
    console.log('2️⃣ Actualizando campos sociales...');
    const updateBody = {
      user_id: userId,
      full_name: 'Admin Test',
      website: 'https://example.com',
      linkedin: 'https://www.linkedin.com/in/example',
      instagram: 'https://instagram.com/example',
      tiktok: 'https://www.tiktok.com/@example',
      skills: 'javascript,react,node',
      city: 'Managua',
      country: 'Nicaragua'
    };

    const updateResponse = await makeRequest(`${API_URL}/api/candidate_profiles/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateBody)
    });

    const updateResult = updateResponse.ok ? updateResponse.json() : updateResponse.text();
    if (updateResponse.ok) {
      console.log('✅ Actualización exitosa:', updateResult);
    } else {
      console.log('❌ Error al actualizar:', updateResult);
    }

    // Fetch profile to verify
    console.log('\n3️⃣ Consultando perfil actualizado...');
    const getResponse = await makeRequest(`${API_URL}/api/candidate_profiles/${userId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profile = getResponse.ok ? getResponse.json() : getResponse.text();
    if (getResponse.ok) {
      console.log('📄 Perfil:', profile);
    } else {
      console.log('⚠️ No se pudo recuperar el perfil:', profile);
    }

  } catch (err) {
    console.error('❌ Error en prueba:', err.message);
  }
}

testUpdateSocialFields();