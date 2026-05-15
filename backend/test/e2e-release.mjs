// End-to-end test for阶段 4: image upload, image messages, device registration,
// account deletion, legal endpoints. Boots assume server is running.

import { io as Client } from 'socket.io-client';
import { Blob } from 'buffer';

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const WS_BASE = process.env.WS_URL || 'http://localhost:3000';
const RAND = Date.now();
const PASSWORD = 'Pass1234';

let failed = 0;
const step = (n) => console.log(`\n==> ${n}`);
const ok = (m) => console.log(`   ok: ${m}`);
const fail = (m) => { console.error(`   FAIL: ${m}`); failed++; };

async function http(method, path, body, token, isForm = false) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return data;
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const sock = Client(WS_BASE, { auth: { token }, transports: ['websocket'], reconnection: false });
    const t = setTimeout(() => reject(new Error('connect timeout')), 5000);
    sock.on('connect:ready', () => { clearTimeout(t); resolve(sock); });
    sock.on('connect:error', (e) => { clearTimeout(t); reject(new Error(JSON.stringify(e))); });
    sock.on('connect_error', (e) => { clearTimeout(t); reject(e); });
  });
}

// 1x1 transparent PNG (smallest valid image we can ship as a byte buffer)
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

(async () => {
  step('1. legal endpoints are public and have content');
  const privacy = await http('GET', '/legal/privacy', null, null);
  const terms = await http('GET', '/legal/terms', null, null);
  if (!privacy?.body || privacy.body.length < 50) fail('privacy too short');
  else ok(`privacy v${privacy.version} (${privacy.body.length} chars)`);
  if (!terms?.body || terms.body.length < 50) fail('terms too short');
  else ok(`terms v${terms.version}`);

  step('2. register Alice + Bob, make them friends');
  const a = await http('POST', '/auth/register', {
    email: `rel_alice_${RAND}@test.local`, password: PASSWORD, nickname: 'RelAlice',
  });
  const b = await http('POST', '/auth/register', {
    email: `rel_bob_${RAND}@test.local`, password: PASSWORD, nickname: 'RelBob',
  });
  await http('POST', '/friends/requests', { friendId: b.user.id }, a.tokens.accessToken);
  await http('POST', `/friends/requests/${a.user.id}/accept`, null, b.tokens.accessToken);
  const conv = await http('POST', '/conversations/direct', { peerId: b.user.id }, a.tokens.accessToken);
  ok(`conversation ${conv.id}`);

  step('3. register a device for push (FCM token placeholder)');
  const dev = await http('POST', '/users/me/devices', {
    deviceId: `dev-${RAND}`, platform: 'ios', pushToken: 'apns-placeholder-token', appVersion: '0.1.0',
  }, a.tokens.accessToken);
  if (!dev?.id) fail('device not registered'); else ok(`device ${dev.id}`);

  step('4. upload an image (multipart/form-data)');
  const form = new FormData();
  form.append('file', new Blob([PNG_BYTES], { type: 'image/png' }), 'pixel.png');
  const uploaded = await http('POST', '/uploads/image', form, a.tokens.accessToken, true);
  if (!uploaded?.url?.startsWith('/uploads/')) fail(`bad upload url ${uploaded?.url}`);
  else ok(`uploaded → ${uploaded.url} (${uploaded.size}B, ${uploaded.mime})`);

  step('5. uploaded file is retrievable via static server');
  const fileUrl = new URL(uploaded.url, WS_BASE);
  const dl = await fetch(fileUrl);
  if (!dl.ok) fail(`download ${dl.status}`);
  else if (dl.headers.get('content-type')?.indexOf('image/') !== 0) fail(`bad content-type`);
  else ok('public download ok');

  step('6. send image message over Socket.io');
  const sock = await connectSocket(a.tokens.accessToken);
  const bSock = await connectSocket(b.tokens.accessToken);

  const ackP = new Promise((res) => sock.once('message:ack', res));
  const newP = new Promise((res) => bSock.once('message:new', res));

  sock.emit('message:send', {
    conversationId: conv.id,
    type: 'image',
    url: uploaded.url,
    mime: uploaded.mime,
    size: uploaded.size,
    width: 1, height: 1,
    clientMsgId: 'img-1',
  });

  const ack = await Promise.race([ackP, new Promise((_, rej) => setTimeout(() => rej(new Error('ack timeout')), 5000))]);
  const recv = await Promise.race([newP, new Promise((_, rej) => setTimeout(() => rej(new Error('new timeout')), 5000))]);
  if (ack.message?.type !== 'image') fail(`ack type ${ack.message?.type}`); else ok('ack.type == image');
  if (recv.message?.content?.url !== uploaded.url) fail('recv content.url mismatch'); else ok('peer received image url');
  if (recv.message?.content?.mime !== uploaded.mime) fail('mime mismatch'); else ok('mime preserved');

  step('7. reject upload of non-image mimetype');
  const badForm = new FormData();
  badForm.append('file', new Blob([Buffer.from('hello')], { type: 'text/plain' }), 'x.txt');
  const badRes = await fetch(`${BASE}/uploads/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${a.tokens.accessToken}` },
    body: badForm,
  });
  if (badRes.ok) fail(`expected 400 got ${badRes.status}`); else ok(`non-image rejected (${badRes.status})`);

  sock.disconnect(); bSock.disconnect();

  step('8. delete account → access blocked');
  await http('DELETE', '/users/me', null, a.tokens.accessToken);
  let after = null, afterErr = null;
  try { after = await http('GET', '/users/me', null, a.tokens.accessToken); } catch (e) { afterErr = e; }
  if (after) fail('user still accessible after delete');
  else if (afterErr && /401|404/.test(afterErr.message)) ok(`access denied after delete`);
  else fail(`unexpected: ${afterErr?.message}`);

  step('9. login with deleted account fails');
  let loginAfter = null, loginErr = null;
  try {
    loginAfter = await http('POST', '/auth/login', { email: `rel_alice_${RAND}@test.local`, password: PASSWORD });
  } catch (e) { loginErr = e; }
  if (loginAfter) fail('login succeeded for deleted user');
  else if (loginErr && /401/.test(loginErr.message)) ok('401 on deleted login');
  else fail(`unexpected: ${loginErr?.message}`);

  console.log(failed === 0 ? '\nALL RELEASE CHECKS PASSED' : `\n${failed} failures`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
