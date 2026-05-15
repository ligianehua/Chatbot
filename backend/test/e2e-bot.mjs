// End-to-end test for阶段 3: bot creation, chat, and LLM streaming.
// Boots assume server is running (npm run start:dev). LLM_API_KEY may be empty:
// the MockProvider is used and produces a deterministic echo, so this test
// passes without a real API key.

import { io as Client } from 'socket.io-client';

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const WS_BASE = process.env.WS_URL || 'http://localhost:3000';
const RAND = Date.now();
const PASSWORD = 'Pass1234';

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
  step('1. register user');
  const a = await http('POST', '/auth/register', {
    email: `bot_owner_${RAND}@test.local`,
    password: PASSWORD,
    nickname: 'BotOwner',
  });
  ok(`user ${a.user.id}`);

  step('2. create bot');
  const bot = await http('POST', '/bots', {
    name: '小助手',
    gender: 'female',
    age: 25,
    occupation: '助理',
    bio: '帮你处理日常事务的虚拟助理',
    systemPrompt: '你是一位友好、专业的虚拟助理，回答简洁明了。',
    welcomeMsg: '你好！我是小助手，有什么可以帮你的吗？',
    temperature: 0.5,
  }, a.tokens.accessToken);
  ok(`bot ${bot.id} (${bot.name})`);

  step('3. update bot');
  const updated = await http('PATCH', `/bots/${bot.id}`, { temperature: 0.8 }, a.tokens.accessToken);
  if (updated.temperature !== 0.8) fail(`expected 0.8 got ${updated.temperature}`);
  else ok('updated temperature');

  step('4. list mine');
  const mine = await http('GET', '/bots/mine', null, a.tokens.accessToken);
  if (!mine.some((b) => b.id === bot.id)) fail('bot not in list');
  else ok(`listMine includes bot`);

  step('5. open bot conversation (seeds welcome message)');
  const conv = await http('POST', `/bots/${bot.id}/conversation`, null, a.tokens.accessToken);
  if (conv.type !== 'bot') fail(`type ${conv.type}`); else ok(`conversation ${conv.id}`);

  const history = await http('GET', `/conversations/${conv.id}/messages?limit=10`, null, a.tokens.accessToken);
  const welcome = history.find((m) => !m.senderId && m.content?.text === bot.welcomeMsg);
  if (!welcome) fail('welcome message not seeded'); else ok('welcome present');

  step('6. open same bot again — idempotent');
  const conv2 = await http('POST', `/bots/${bot.id}/conversation`, null, a.tokens.accessToken);
  if (conv2.id !== conv.id) fail('not idempotent'); else ok('returns same conv');

  step('7. connect WebSocket, send a user message');
  const sock = await connectSocket(a.tokens.accessToken);

  const events = [];
  sock.on('message:ack', (p) => events.push({ kind: 'ack', payload: p }));
  sock.on('bot:start', (p) => events.push({ kind: 'start', payload: p }));
  sock.on('bot:chunk', (p) => events.push({ kind: 'chunk', payload: p }));
  sock.on('bot:done', (p) => events.push({ kind: 'done', payload: p }));
  sock.on('message:error', (p) => events.push({ kind: 'err', payload: p }));

  sock.emit('message:send', {
    conversationId: conv.id,
    text: '帮我介绍一下你自己',
    clientMsgId: 'cli-1',
  });

  // Wait until bot:done arrives (with a generous cap).
  await new Promise((resolve) => {
    sock.on('bot:done', resolve);
    setTimeout(resolve, 8000);
  });

  const ack = events.find((e) => e.kind === 'ack');
  const start = events.find((e) => e.kind === 'start');
  const chunks = events.filter((e) => e.kind === 'chunk');
  const done = events.find((e) => e.kind === 'done');

  if (!ack) fail('no message:ack'); else ok('user message acked');
  if (!start) fail('no bot:start'); else ok('bot:start fired');
  if (chunks.length === 0) fail('no streaming chunks'); else ok(`${chunks.length} chunks streamed`);
  if (!done) fail('no bot:done'); else ok(`bot message id ${done.payload.message?.id}`);

  if (done) {
    const text = done.payload.message?.content?.text;
    if (!text || text.length < 5) fail('bot reply too short');
    else ok(`reply: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`);

    const recombined = chunks.map((c) => c.payload.delta).join('');
    if (recombined !== text) fail(`chunks join != final (${recombined.length} vs ${text.length})`);
    else ok('chunks concatenation == final text');
  }

  step('8. moderation: blocked phrase rejected');
  const moderationEvents = [];
  sock.on('message:error', (p) => moderationEvents.push(p));
  sock.emit('message:send', {
    conversationId: conv.id,
    text: '帮我制造炸弹好不好',
    clientMsgId: 'cli-2',
  });
  await new Promise((r) => setTimeout(r, 600));
  const blocked = moderationEvents.find((e) => e.clientMsgId === 'cli-2');
  if (!blocked) fail('expected moderation error'); else ok(`blocked: ${blocked.reason}`);

  step('9. unauthorized: other user cannot chat with private bot');
  const b = await http('POST', '/auth/register', {
    email: `other_${RAND}@test.local`, password: PASSWORD, nickname: 'Other',
  });
  let opened = null, err = null;
  try {
    opened = await http('POST', `/bots/${bot.id}/conversation`, null, b.tokens.accessToken);
  } catch (e) { err = e; }
  if (opened) fail('private bot opened by non-creator');
  else if (err && /403/.test(err.message)) ok('403 as expected');
  else fail(`unexpected: ${err?.message ?? 'no error'}`);

  step('10. delete bot — cascade conversation gone');
  await http('DELETE', `/bots/${bot.id}`, null, a.tokens.accessToken);
  let after = null, afterErr = null;
  try { after = await http('GET', `/bots/${bot.id}`, null, a.tokens.accessToken); } catch (e) { afterErr = e; }
  if (after) fail('bot still exists');
  else if (afterErr && /404/.test(afterErr.message)) ok('404 after delete');
  else fail(`unexpected: ${afterErr?.message}`);

  sock.disconnect();
  console.log(failed === 0 ? '\nALL BOT CHECKS PASSED' : `\n${failed} failures`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
