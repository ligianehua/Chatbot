// End-to-end for FCM-based push. Server must run with PUSH_MODE=mock.
// Mock provider records sends in memory; GET /admin/push/log returns them
// so the test can verify what the backend tried to deliver.

import { io as Client } from 'socket.io-client';

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const WS_BASE = process.env.WS_URL || 'http://localhost:3000';
const RAND = Date.now();
const PW = 'Pass1234';

let failed = 0;
const step = (n) => console.log(`\n==> ${n}`);
const ok = (m) => console.log(`   ok: ${m}`);
const fail = (m) => { console.error(`   FAIL: ${m}`); failed++; };

async function http(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
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

(async () => {
  step('1. register Alice + Bob, befriend them');
  const a = await http('POST', '/auth/register', { email: `push_a_${RAND}@t.local`, password: PW, nickname: 'Alice' });
  const b = await http('POST', '/auth/register', { email: `push_b_${RAND}@t.local`, password: PW, nickname: 'Bob' });

  // Capture initial mock log size so we can isolate this run's pushes.
  let baseline = (await http('GET', '/admin/push/log', null, a.tokens.accessToken)).length;

  // Bob registers a device with a push token.
  const bobToken = `tok-b-${RAND}`;
  await http('POST', '/users/me/devices', {
    deviceId: `dev-b-${RAND}`, platform: 'ios', pushToken: bobToken, appVersion: '0.1.0',
  }, b.tokens.accessToken);
  ok('Bob registered device with push token');

  step('2. friend request triggers a push to Bob');
  baseline = (await http('GET', '/admin/push/log', null, a.tokens.accessToken)).length;
  await http('POST', '/friends/requests', { friendId: b.user.id }, a.tokens.accessToken);
  await new Promise((r) => setTimeout(r, 200));
  let log = await http('GET', '/admin/push/log', null, a.tokens.accessToken);
  const newPushes = log.slice(baseline);
  const friendPush = newPushes.find((e) => e.notification?.data?.type === 'friend_request');
  if (!friendPush) fail('no friend request push');
  else if (!friendPush.tokens.includes(bobToken)) fail(`token ${bobToken} not in ${friendPush.tokens}`);
  else if (!friendPush.notification.body.includes('Alice')) fail('body missing sender name');
  else ok(`pushed to ${friendPush.tokens.length} device(s) with body "${friendPush.notification.body}"`);

  await http('POST', `/friends/requests/${a.user.id}/accept`, null, b.tokens.accessToken);
  const conv = await http('POST', '/conversations/direct', { peerId: b.user.id }, a.tokens.accessToken);

  step('3. message to OFFLINE Bob triggers a push');
  baseline = (await http('GET', '/admin/push/log', null, a.tokens.accessToken)).length;
  const aSock = await connectSocket(a.tokens.accessToken);
  // Note: Bob has no socket connected → he is offline.
  aSock.emit('message:send', {
    conversationId: conv.id, type: 'text', text: 'hi from alice', clientMsgId: 'p-1',
  });
  await new Promise((r) => setTimeout(r, 400));
  log = await http('GET', '/admin/push/log', null, a.tokens.accessToken);
  const offlinePushes = log.slice(baseline);
  const msgPush = offlinePushes.find((e) => e.notification?.data?.type === 'message');
  if (!msgPush) fail('no message push to offline Bob');
  else if (!msgPush.tokens.includes(bobToken)) fail('Bob token not in push');
  else if (msgPush.notification.body !== 'hi from alice') fail(`body ${msgPush.notification.body}`);
  else if (msgPush.notification.title !== 'Alice') fail(`title ${msgPush.notification.title}`);
  else ok('offline Bob got a push with text preview');

  step('4. message to ONLINE Bob does NOT push');
  const bSock = await connectSocket(b.tokens.accessToken);
  const bGot = new Promise((res) => bSock.once('message:new', res));
  baseline = (await http('GET', '/admin/push/log', null, a.tokens.accessToken)).length;
  aSock.emit('message:send', {
    conversationId: conv.id, type: 'text', text: 'while online', clientMsgId: 'p-2',
  });
  await Promise.race([bGot, new Promise((_, j) => setTimeout(() => j(new Error('socket timeout')), 5000))]);
  await new Promise((r) => setTimeout(r, 300));
  log = await http('GET', '/admin/push/log', null, a.tokens.accessToken);
  const onlinePushes = log.slice(baseline);
  const onlineMsgPush = onlinePushes.find((e) => e.notification?.data?.type === 'message');
  if (onlineMsgPush) fail(`expected no push, got: ${JSON.stringify(onlineMsgPush.notification)}`);
  else ok('online Bob skipped — no push sent');

  step('5. image message preview is "[图片]"');
  bSock.disconnect();
  await new Promise((r) => setTimeout(r, 200));
  baseline = (await http('GET', '/admin/push/log', null, a.tokens.accessToken)).length;
  aSock.emit('message:send', {
    conversationId: conv.id, type: 'image',
    url: '/uploads/test.png', mime: 'image/png', size: 12,
    clientMsgId: 'p-3',
  });
  await new Promise((r) => setTimeout(r, 400));
  log = await http('GET', '/admin/push/log', null, a.tokens.accessToken);
  const imgPush = log.slice(baseline).find((e) => e.notification?.data?.type === 'message');
  if (!imgPush) fail('no image push');
  else if (imgPush.notification.body !== '[图片]') fail(`body ${imgPush.notification.body}`);
  else ok('image preview correct');

  step('6. dead token (starts with "bad-") gets pruned from devices');
  // Replace Bob's token with a sentinel that the mock provider marks unregistered.
  await http('POST', '/users/me/devices', {
    deviceId: `dev-b-${RAND}`, platform: 'ios', pushToken: `bad-${RAND}`, appVersion: '0.1.0',
  }, b.tokens.accessToken);
  baseline = (await http('GET', '/admin/push/log', null, a.tokens.accessToken)).length;
  aSock.emit('message:send', {
    conversationId: conv.id, type: 'text', text: 'prune?', clientMsgId: 'p-4',
  });
  await new Promise((r) => setTimeout(r, 400));
  // The token should have been cleaned. Next send should hit zero tokens.
  baseline = (await http('GET', '/admin/push/log', null, a.tokens.accessToken)).length;
  aSock.emit('message:send', {
    conversationId: conv.id, type: 'text', text: 'after prune', clientMsgId: 'p-5',
  });
  await new Promise((r) => setTimeout(r, 400));
  log = await http('GET', '/admin/push/log', null, a.tokens.accessToken);
  const postPrune = log.slice(baseline).filter((e) => e.notification?.data?.type === 'message');
  if (postPrune.length !== 0) fail(`expected no push after prune, got ${postPrune.length}`);
  else ok('dead token pruned, no further pushes');

  step('7. group chat fans pushes to offline members only');
  // Re-register Bob with a fresh token so he can receive.
  await http('POST', '/users/me/devices', {
    deviceId: `dev-b-${RAND}`, platform: 'ios', pushToken: `tok-b2-${RAND}`, appVersion: '0.1.0',
  }, b.tokens.accessToken);
  const c = await http('POST', '/auth/register', { email: `push_c_${RAND}@t.local`, password: PW, nickname: 'Carol' });
  const carolToken = `tok-c-${RAND}`;
  await http('POST', '/users/me/devices', {
    deviceId: `dev-c-${RAND}`, platform: 'android', pushToken: carolToken,
  }, c.tokens.accessToken);
  // Befriend a-c and b-c so we can build a group.
  await http('POST', '/friends/requests', { friendId: c.user.id }, a.tokens.accessToken);
  await http('POST', `/friends/requests/${a.user.id}/accept`, null, c.tokens.accessToken);
  await http('POST', '/friends/requests', { friendId: c.user.id }, b.tokens.accessToken);
  await http('POST', `/friends/requests/${b.user.id}/accept`, null, c.tokens.accessToken);

  const group = await http('POST', '/groups', {
    name: `推送测试群_${RAND}`, memberIds: [b.user.id, c.user.id],
  }, a.tokens.accessToken);
  const groupConv = (await http('GET', '/conversations', null, a.tokens.accessToken))
    .find((cv) => cv.type === 'group' && cv.peer?.id === group.id);

  // Carol comes online, Bob stays offline.
  const cSock = await connectSocket(c.tokens.accessToken);
  await new Promise((r) => setTimeout(r, 100));

  baseline = (await http('GET', '/admin/push/log', null, a.tokens.accessToken)).length;
  aSock.emit('message:send', {
    conversationId: groupConv.id, type: 'text', text: 'group ping', clientMsgId: 'p-6',
  });
  await new Promise((r) => setTimeout(r, 400));
  log = await http('GET', '/admin/push/log', null, a.tokens.accessToken);
  const groupPushes = log.slice(baseline).filter((e) => e.notification?.data?.type === 'message');
  // Bob is offline (has token tok-b2-...), Carol is online (cSock connected).
  const allTokens = groupPushes.flatMap((e) => e.tokens);
  if (!allTokens.some((t) => t.startsWith('tok-b2-'))) fail('Bob (offline) did not get push');
  else if (allTokens.includes(carolToken)) fail('Carol (online) should not have been pushed');
  else ok(`group push targets only offline members (${allTokens.length} tokens)`);

  aSock.disconnect(); cSock.disconnect();

  step('8. PUSH_MODE != mock → /admin/push/log forbidden in prod (sanity)');
  // We can't actually flip env at runtime, but verify auth at least.
  const noAuth = await fetch(`${BASE}/admin/push/log`).then((r) => r.status);
  if (noAuth !== 401) fail(`expected 401, got ${noAuth}`); else ok('endpoint requires auth (401 w/o token)');

  console.log(failed === 0 ? '\nALL PUSH CHECKS PASSED' : `\n${failed} failures`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
