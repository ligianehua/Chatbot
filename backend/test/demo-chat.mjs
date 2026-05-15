// Quick demo: full real-time chat flow.
import { io as Client } from 'socket.io-client';

const RAND = Date.now();
const BASE = 'http://localhost:3000/api/v1';
const WS = 'http://localhost:3000';

async function http(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

function conn(tok) {
  return new Promise((resolve, reject) => {
    const s = Client(WS, { auth: { token: tok }, transports: ['websocket'], reconnection: false });
    s.on('connect:ready', () => resolve(s));
    s.on('connect_error', reject);
    setTimeout(() => reject(new Error('timeout')), 5000);
  });
}

const log = (...a) => console.log(...a);

(async () => {
  const a = await http('POST', '/auth/login', { email: 'alice@demo.local', password: 'DemoPass1' });
  const b = await http('POST', '/auth/login', { email: 'bob@demo.local', password: 'DemoPass1' });

  // Open or reuse the direct conversation
  const conv = await http('POST', '/conversations/direct',
    { peerId: b.user.id }, a.tokens.accessToken);
  log('\n→ conversation:', conv.id);

  // Bob registers a push token so we can see the offline-push path
  await http('POST', '/users/me/devices',
    { deviceId: `dev-bob-${RAND}`, platform: 'ios', pushToken: `bob-fcm-${RAND}` },
    b.tokens.accessToken);
  log('→ Bob registered push token bob-fcm-' + RAND);

  // Alice connects, Bob stays offline.
  const aSock = await conn(a.tokens.accessToken);
  log('→ Alice connected, Bob is offline\n');

  log('### Alice sends "Hi Bob!" while Bob is offline');
  await new Promise((res) => {
    aSock.once('message:ack', (ack) => {
      log('   ← ack:', JSON.stringify({ clientMsgId: ack.clientMsgId, serverId: ack.message.id, text: ack.message.content.text }));
      res();
    });
    aSock.emit('message:send', {
      conversationId: conv.id,
      type: 'text',
      text: 'Hi Bob!',
      clientMsgId: 'demo-1',
    });
  });

  await new Promise((r) => setTimeout(r, 400));
  const pushes = await http('GET', '/admin/push/log', null, a.tokens.accessToken);
  const lastPush = pushes[pushes.length - 1];
  log('   ← push fired to:', lastPush?.tokens, JSON.stringify(lastPush?.notification));

  log('\n### Bob comes online, message:new lands instantly');
  const bSock = await conn(b.tokens.accessToken);
  await new Promise((res) => {
    bSock.once('message:new', (m) => {
      log('   ← Bob got:', JSON.stringify({ from: m.message.senderId, text: m.message.content.text }));
      res();
    });
    aSock.emit('message:send', {
      conversationId: conv.id,
      type: 'text',
      text: 'You online now?',
      clientMsgId: 'demo-2',
    });
  });

  log('\n### Bob unread count via REST');
  const list = await http('GET', '/conversations', null, b.tokens.accessToken);
  log('   ', list.map((c) => ({ peer: c.peer?.nickname, unread: c.unreadCount, lastMsg: c.lastMessage?.content?.text })));

  aSock.disconnect();
  bSock.disconnect();
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
