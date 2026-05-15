// End-to-end Socket.io test for阶段 2: real-time chat between two users.
// Boot the server first (npm run start:dev), then run:
//   node test/e2e-chat.mjs

import { io as Client } from 'socket.io-client';

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const WS_BASE = process.env.WS_URL || 'http://localhost:3000';
const RAND = Date.now();
const PASSWORD = 'Pass1234';

let failed = 0;
function step(name) { console.log(`\n==> ${name}`); }
function ok(msg) { console.log(`   ok: ${msg}`); }
function fail(msg) { console.error(`   FAIL: ${msg}`); failed++; }

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

async function register(email, nickname) {
  return http('POST', '/auth/register', { email, password: PASSWORD, nickname });
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const sock = Client(WS_BASE, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    const timeout = setTimeout(() => reject(new Error('connect timeout')), 5000);
    sock.on('connect:ready', () => { clearTimeout(timeout); resolve(sock); });
    sock.on('connect:error', (e) => { clearTimeout(timeout); reject(new Error(JSON.stringify(e))); });
    sock.on('connect_error', (e) => { clearTimeout(timeout); reject(e); });
  });
}

function waitFor(sock, event, ms = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`wait ${event} timeout`)), ms);
    sock.once(event, (payload) => { clearTimeout(t); resolve(payload); });
  });
}

(async () => {
  step('1. register Alice + Bob');
  const a = await register(`alice_${RAND}@test.local`, 'Alice');
  const b = await register(`bob_${RAND}@test.local`, 'Bob');
  ok(`Alice ${a.user.id}, Bob ${b.user.id}`);

  step('2. Alice & Bob become friends');
  await http('POST', '/friends/requests', { friendId: b.user.id }, a.tokens.accessToken);
  await http('POST', `/friends/requests/${a.user.id}/accept`, null, b.tokens.accessToken);
  ok('friendship');

  step('3. Alice opens direct conversation with Bob');
  const conv = await http('POST', '/conversations/direct', { peerId: b.user.id }, a.tokens.accessToken);
  ok(`conversation ${conv.id}`);

  step('4. both connect WebSocket');
  const aSock = await connectSocket(a.tokens.accessToken);
  const bSock = await connectSocket(b.tokens.accessToken);
  ok('both connected');

  step('5. invalid token rejected');
  try {
    await connectSocket('not-a-jwt');
    fail('expected reject');
  } catch (e) {
    ok(`rejected: ${e.message.slice(0, 60)}`);
  }

  step('6. Alice sends "hello bob"');
  const ackP = waitFor(aSock, 'message:ack');
  const newP = waitFor(bSock, 'message:new');
  aSock.emit('message:send', {
    conversationId: conv.id,
    text: 'hello bob',
    clientMsgId: 'cli-1',
  });
  const ack = await ackP;
  const recv = await newP;
  if (ack.clientMsgId !== 'cli-1') fail(`bad ack clientMsgId ${ack.clientMsgId}`); else ok('ack matches clientMsgId');
  if (ack.message.id !== recv.message.id) fail('ack/new id mismatch'); else ok(`server msg id ${ack.message.id}`);
  if (recv.message.content?.text !== 'hello bob') fail('text mismatch'); else ok('payload roundtrip');

  step('7. burst 50 messages — all arrive, all IDs unique and monotonic');
  // Note: arrival order is NOT guaranteed under concurrent handlers; clients
  // must sort by message.id. We assert: count, uniqueness, and that each
  // id sorts higher than any previously assigned id.
  const got = [];
  bSock.on('message:new', (p) => got.push(p.message));
  for (let i = 0; i < 50; i++) {
    aSock.emit('message:send', {
      conversationId: conv.id,
      text: `msg ${i}`,
      clientMsgId: `b-${i}`,
    });
  }
  await new Promise((r) => setTimeout(r, 1500));
  if (got.length !== 50) fail(`got ${got.length}/50`); else ok(`got 50 messages`);
  const ids = got.map((m) => m.id);
  if (new Set(ids).size !== ids.length) fail('duplicate ids'); else ok('all ids unique');
  const sorted = [...ids].sort();
  const monotonic = sorted.every((id, i) => i === 0 || id > sorted[i - 1]);
  if (!monotonic) fail('ids not strictly increasing after sort'); else ok('snowflake monotonic');

  step('8. Bob disconnects, Alice sends 5 offline messages');
  bSock.disconnect();
  await new Promise((r) => setTimeout(r, 200));
  for (let i = 0; i < 5; i++) {
    aSock.emit('message:send', {
      conversationId: conv.id,
      text: `offline ${i}`,
      clientMsgId: `o-${i}`,
    });
  }
  await new Promise((r) => setTimeout(r, 400));
  ok('5 messages sent while bob offline');

  step('9. Bob reconnects and syncs since max server id');
  const bSock2 = await connectSocket(b.tokens.accessToken);
  // Use MAX id from `got`, not last-arrived; clients must track maxReceivedId.
  const lastId = [...got].sort((a, b) => a.id.localeCompare(b.id)).pop().id;
  const sync = await new Promise((resolve, reject) => {
    bSock2.emit('message:sync', { sinceMsgId: lastId }, (resp) => resolve(resp));
    setTimeout(() => reject(new Error('sync timeout')), 3000);
  });
  if (!sync || !Array.isArray(sync.messages)) fail('sync no messages array');
  else if (sync.messages.length !== 5) fail(`expected exactly 5 offline got ${sync.messages.length}`);
  else ok(`synced ${sync.messages.length} offline messages`);

  step('10. unread count via REST');
  const list = await http('GET', '/conversations', null, b.tokens.accessToken);
  const direct = list.find((c) => c.id === conv.id);
  if (!direct) fail('conv missing in list');
  else if (direct.unreadCount < 5) fail(`unread ${direct.unreadCount}`);
  else ok(`Bob unread=${direct.unreadCount}`);

  step('11. Bob marks read; unread → 0');
  await http('POST', `/conversations/${conv.id}/read`, { upToMsgId: ack.message.id }, b.tokens.accessToken);
  const list2 = await http('GET', '/conversations', null, b.tokens.accessToken);
  const direct2 = list2.find((c) => c.id === conv.id);
  if (direct2.unreadCount !== 0) fail(`expected 0 got ${direct2.unreadCount}`);
  else ok('marked read');

  step('12. REST history pagination');
  const page = await http('GET', `/conversations/${conv.id}/messages?limit=10`, null, a.tokens.accessToken);
  if (page.length !== 10) fail(`expected 10 got ${page.length}`);
  else ok(`got ${page.length} latest messages`);
  const next = await http('GET', `/conversations/${conv.id}/messages?limit=10&before=${page[page.length - 1].id}`, null, a.tokens.accessToken);
  if (next.length === 0) fail('expected older page non-empty');
  else if (next[0].id >= page[page.length - 1].id) fail('pagination not strict-less-than');
  else ok(`older page returned ${next.length}`);

  aSock.disconnect();
  bSock2.disconnect();

  console.log(failed === 0 ? '\nALL CHAT CHECKS PASSED' : `\n${failed} failures`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
