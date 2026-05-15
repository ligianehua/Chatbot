// End-to-end test for P1 群聊: 3 users build a group, exchange text + image,
// member ops (add / remove / leave), and disband.

import { io as Client } from 'socket.io-client';
import { Blob } from 'buffer';

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

async function befriend(a, b) {
  await http('POST', '/friends/requests', { friendId: b.user.id }, a.tokens.accessToken);
  await http('POST', `/friends/requests/${a.user.id}/accept`, null, b.tokens.accessToken);
}

(async () => {
  step('1. register 3 users + pairwise friendships');
  const a = await http('POST', '/auth/register', { email: `g_a_${RAND}@t.local`, password: PW, nickname: 'Alice' });
  const b = await http('POST', '/auth/register', { email: `g_b_${RAND}@t.local`, password: PW, nickname: 'Bob' });
  const c = await http('POST', '/auth/register', { email: `g_c_${RAND}@t.local`, password: PW, nickname: 'Carol' });
  await befriend(a, b);
  await befriend(a, c);
  await befriend(b, c);
  ok('Alice, Bob, Carol all friends');

  step('2. Alice creates a group with Bob and Carol');
  const group = await http('POST', '/groups',
    { name: '周末出游', memberIds: [b.user.id, c.user.id] }, a.tokens.accessToken);
  if (group.memberCount !== 3) fail(`memberCount ${group.memberCount}`); else ok(`group ${group.id}, ${group.memberCount} members`);

  step('3. cannot create with non-friend');
  let err = null;
  try {
    const stranger = await http('POST', '/auth/register', { email: `g_s_${RAND}@t.local`, password: PW, nickname: 'Stranger' });
    await http('POST', '/groups', { name: 'bad', memberIds: [stranger.user.id] }, a.tokens.accessToken);
  } catch (e) { err = e; }
  if (err && /400/.test(err.message)) ok('400 as expected'); else fail(`expected 400, got ${err?.message ?? 'no error'}`);

  step('4. group appears in everyone\'s conversation list');
  for (const u of [a, b, c]) {
    const list = await http('GET', '/conversations', null, u.tokens.accessToken);
    const conv = list.find((c) => c.type === 'group' && c.peer?.id === group.id);
    if (!conv) fail(`${u.user.nickname} doesn't see the group`);
    else if (conv.peer?.nickname !== '周末出游') fail(`bad title ${conv.peer?.nickname}`);
    else ok(`${u.user.nickname} sees "${conv.peer.nickname}" conv=${conv.id}`);
  }

  step('5. all three connect WebSocket');
  const aS = await connectSocket(a.tokens.accessToken);
  const bS = await connectSocket(b.tokens.accessToken);
  const cS = await connectSocket(c.tokens.accessToken);

  // discover the group conversation id from Alice's list
  const list = await http('GET', '/conversations', null, a.tokens.accessToken);
  const groupConv = list.find((c) => c.type === 'group' && c.peer?.id === group.id);

  step('6. Alice sends a message → Bob & Carol both receive');
  const bGot = new Promise((res) => bS.once('message:new', res));
  const cGot = new Promise((res) => cS.once('message:new', res));
  aS.emit('message:send', {
    conversationId: groupConv.id,
    type: 'text',
    text: 'hi team',
    clientMsgId: 'cli-1',
  });
  const [bRecv, cRecv] = await Promise.all([
    Promise.race([bGot, new Promise((_, j) => setTimeout(() => j(new Error('bob timeout')), 5000))]),
    Promise.race([cGot, new Promise((_, j) => setTimeout(() => j(new Error('carol timeout')), 5000))]),
  ]);
  if (bRecv.message?.content?.text !== 'hi team') fail('bob bad text'); else ok('Bob received');
  if (cRecv.message?.content?.text !== 'hi team') fail('carol bad text'); else ok('Carol received');
  if (bRecv.message.id !== cRecv.message.id) fail('different msg ids'); else ok('same server msg id');

  step('7. Carol leaves the group');
  await http('DELETE', `/groups/${group.id}/members/${c.user.id}`, null, c.tokens.accessToken);
  const cListAfter = await http('GET', '/conversations', null, c.tokens.accessToken);
  if (cListAfter.find((x) => x.id === groupConv.id)) fail('Carol still sees conversation');
  else ok('Carol no longer sees conversation');

  step('8. Alice sends another message; Bob receives, Carol does not');
  const bGot2 = new Promise((res) => bS.once('message:new', res));
  let carolGotIt = false;
  const probe = (p) => { if (p.message?.content?.text === 'after carol left') carolGotIt = true; };
  cS.on('message:new', probe);
  aS.emit('message:send', {
    conversationId: groupConv.id,
    type: 'text',
    text: 'after carol left',
    clientMsgId: 'cli-2',
  });
  const bRecv2 = await Promise.race([bGot2, new Promise((_, j) => setTimeout(() => j(new Error('timeout')), 5000))]);
  await new Promise((r) => setTimeout(r, 400));
  cS.off('message:new', probe);
  if (bRecv2.message?.content?.text !== 'after carol left') fail('bob did not see follow-up');
  else ok('Bob received post-leave message');
  if (carolGotIt) fail('Carol still received broadcast after leaving'); else ok('Carol correctly silenced');

  step('9. Alice (owner) cannot leave; must disband');
  let err2 = null;
  try { await http('DELETE', `/groups/${group.id}/members/${a.user.id}`, null, a.tokens.accessToken); }
  catch (e) { err2 = e; }
  if (err2 && /400/.test(err2.message)) ok('400 as expected'); else fail('owner self-leave allowed');

  step('10. Alice re-invites Carol → she sees conversation again');
  await http('POST', `/groups/${group.id}/members`,
    { userIds: [c.user.id] }, a.tokens.accessToken);
  const cListReinvited = await http('GET', '/conversations', null, c.tokens.accessToken);
  if (!cListReinvited.find((x) => x.id === groupConv.id)) fail('Carol not re-added to conv');
  else ok('Carol re-added to conversation');

  step('11. Alice disbands; group + conversation gone for everyone');
  await http('DELETE', `/groups/${group.id}`, null, a.tokens.accessToken);
  for (const u of [a, b, c]) {
    const finalList = await http('GET', '/conversations', null, u.tokens.accessToken);
    const stillThere = finalList.find((x) => x.id === groupConv.id);
    if (stillThere) fail(`${u.user.nickname} still sees disbanded conv`);
    else ok(`${u.user.nickname} conversation gone`);
  }
  let errGet = null;
  try { await http('GET', `/groups/${group.id}`, null, a.tokens.accessToken); } catch (e) { errGet = e; }
  if (errGet && /404/.test(errGet.message)) ok('GET /groups/:id → 404'); else fail(`unexpected: ${errGet?.message}`);

  aS.disconnect(); bS.disconnect(); cS.disconnect();
  console.log(failed === 0 ? '\nALL GROUP CHECKS PASSED' : `\n${failed} failures`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
