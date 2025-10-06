const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const http = require('http');

const API_PORT = process.env.PORT || 4002; // usar .env si está corriendo el server
const API_URL = `http://localhost:${API_PORT}`;
const ADMIN_EMAIL = 'admin@outy.local';
const ADMIN_PASS = 'Outy123!';

function request(pathname, { method = 'GET', body = null, headers = {} } = {}) {
  const options = {
    hostname: 'localhost',
    port: API_PORT,
    path: pathname,
    method,
    headers,
  };
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch (e) { json = { raw: data }; }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    if (body) {
      if (body instanceof FormData) {
        body.pipe(req);
      } else {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
      }
    } else {
      req.end();
    }
  });
}

async function run() {
  const result = { steps: [] };
  try {
    // 1) Login
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS })
    });
    const token = loginRes.json && loginRes.json.token;
    const adminId = loginRes.json && loginRes.json.user && loginRes.json.user.id;
    result.steps.push({ step: 'login', status: loginRes.status, ok: !!token, adminId });
    if (!token) throw new Error('No token from login');

    // 2) Buscar receptor (primer usuario que no sea admin)
    const usersRes = await request('/api/users', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token }
    });
    const users = usersRes.json || [];
    const recipient = users.find(u => u.email !== ADMIN_EMAIL) || users[0];
    if (!recipient) throw new Error('No recipient user found');
    result.steps.push({ step: 'list_users', status: usersRes.status, recipient });

    // 3) Crear conversación (si no existe)
    const convCreateRes = await request('/api/conversations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ user1Id: adminId, user2Id: recipient.id })
    });
    const conversationId = convCreateRes.json.conversation_id;
    result.steps.push({ step: 'create_conversation', status: convCreateRes.status, conversationId, created: convCreateRes.json.created });

    // 4) Subir archivo (usar asset del proyecto)
    const assetPath = path.resolve(__dirname, '../../Outy-App/assets/adaptive-icon.png');
    if (!fs.existsSync(assetPath)) throw new Error('Asset not found: ' + assetPath);
    const form = new FormData();
    form.append('file', fs.createReadStream(assetPath), { filename: 'outy_logo (1).png', contentType: 'image/png' });
    // Nota: el fileFilter lee req.query.type durante parseo de file; usar query en lugar de body
    form.append('type', 'figan');
    const uploadHeaders = Object.assign({ Authorization: 'Bearer ' + token }, form.getHeaders());
    const uploadRes = await request('/api/files/upload?type=figan', { method: 'POST', headers: uploadHeaders, body: form });
    result.steps.push({ step: 'upload_file', status: uploadRes.status, upload: uploadRes.json });
    const fileUrl = uploadRes.json && uploadRes.json.url;
    const originalName = uploadRes.json && uploadRes.json.originalName;
    if (!fileUrl) throw new Error('Upload did not return url');

    // 5) Enviar mensaje con token [[FILE:url|name|mime]]
    const tokenStr = `[[FILE:${fileUrl}|${originalName}|image/png]]`;
    const msgBody = { message_text: `Adjunto de prueba ${tokenStr}` };
    const sendRes = await request(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(msgBody)
    });
    result.steps.push({ step: 'send_message', status: sendRes.status, message: sendRes.json });

    // 6) Verificar que el mensaje aparece en el listado
    const listRes = await request(`/api/conversations/${conversationId}/messages?page=1&pageSize=5`, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token }
    });
    result.steps.push({ step: 'list_messages', status: listRes.status, messages_count: (listRes.json || []).length });

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    result.error = err.message;
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

run();