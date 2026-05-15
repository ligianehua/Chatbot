import { io as Client } from 'socket.io-client';
const BASE = 'http://localhost:3000/api/v1';

async function http(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

(async () => {
  const b = await http('POST', '/auth/login', { email: 'bob@demo.local', password: 'DemoPass1' });
  const convs = await http('GET', '/conversations', null, b.tokens.accessToken);
  const botConv = convs.find((c) => c.type === 'bot');
  console.log('→ bot conversation:', botConv.id, '| bot:', botConv.peer.nickname);

  const sock = await new Promise((resolve, reject) => {
    const s = Client('http://localhost:3000', {
      auth: { token: b.tokens.accessToken },
      transports: ['websocket'], reconnection: false,
    });
    s.on('connect:ready', () => resolve(s));
    s.on('connect_error', reject);
  });

  console.log('\n→ Bob says: "我最近压力很大，怎么办？"');
  process.stdout.write('   ← bot streaming: ');

  let fullText = '';
  await new Promise((resolve) => {
    sock.on('bot:chunk', (e) => {
      fullText += e.delta;
      process.stdout.write(e.delta);
    });
    sock.on('bot:done', (e) => {
      console.log('\n\n→ bot final message id:', e.message.id);
      console.log('→ persisted text:', JSON.stringify(e.message.content.text));
      resolve();
    });
    sock.emit('message:send', {
      conversationId: botConv.id,
      type: 'text',
      text: '我最近压力很大，怎么办？',
      clientMsgId: 'demo-bot-1',
    });
  });

  console.log('\n→ chunk-concatenated length:', fullText.length, 'chars');
  sock.disconnect();
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
