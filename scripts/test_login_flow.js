const http = require('http');

function request(path, { method = 'GET', body = null, headers = {} } = {}) {
  const options = {
    hostname: 'localhost',
    port: parseInt(process.env.PORT || '4000', 10),
    path,
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
  };
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json;
        try { json = data ? JSON.parse(data) : null; } catch (e) { json = { parseError: e.message, raw: data }; }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const results = [];
  try {
    // 1) Login OK
    const loginOkBody = { email: 'admin@outy.local', password: 'Outy123!' };
    const loginOk = await request('/api/auth/login', { method: 'POST', body: loginOkBody });
    const token = loginOk.json && loginOk.json.token;
    results.push({ step: 'login_ok', status: loginOk.status, hasToken: !!token, user: loginOk.json && loginOk.json.user });

    // 2) Use token in protected POST
    let createdCategory = null;
    if (token) {
      const name = 'Prueba Login ' + new Date().toISOString().replace(/[:.]/g, '-');
      const postRes = await request('/api/job_categories', {
        method: 'POST',
        body: { name },
        headers: { Authorization: 'Bearer ' + token }
      });
      createdCategory = postRes.json;
      results.push({ step: 'protected_post', status: postRes.status, created: createdCategory });
    } else {
      results.push({ step: 'protected_post', status: 0, error: 'No token from login_ok' });
    }

    // 3) Wrong password
    const loginBadBody = { email: 'admin@outy.local', password: 'WrongPass123!' };
    const loginBad = await request('/api/auth/login', { method: 'POST', body: loginBadBody });
    results.push({ step: 'login_wrong_password', status: loginBad.status, error: loginBad.json && loginBad.json.error });

    // 4) Missing fields
    const loginMissing = await request('/api/auth/login', { method: 'POST', body: {} });
    results.push({ step: 'login_missing_fields', status: loginMissing.status, error: loginMissing.json && loginMissing.json.error });

    // 5) Invalid token on protected POST
    const invalidTokPost = await request('/api/job_categories', {
      method: 'POST',
      body: { name: 'Prueba Token Invalido' },
      headers: { Authorization: 'Bearer ' + 'invalid.token.value' }
    });
    results.push({ step: 'protected_post_invalid_token', status: invalidTokPost.status, error: invalidTokPost.json && invalidTokPost.json.error });

    // Output summary
    console.log(JSON.stringify({ results }, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

run();