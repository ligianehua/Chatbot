// End-to-end for Bot 市场 + 订阅 + 钱包流转 (P1 step 2).
// Boots assume server running.

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
  step('1. creator + 2 buyers register');
  const creator = await http('POST', '/auth/register', { email: `mk_c_${RAND}@t.local`, password: PW, nickname: 'Creator' });
  const buyer = await http('POST', '/auth/register', { email: `mk_b_${RAND}@t.local`, password: PW, nickname: 'Buyer' });
  const lurker = await http('POST', '/auth/register', { email: `mk_l_${RAND}@t.local`, password: PW, nickname: 'Lurker' });
  ok(`Creator ${creator.user.id} / Buyer ${buyer.user.id} / Lurker ${lurker.user.id}`);

  step('2. creator publishes free + paid bots');
  const freeBot = await http('POST', '/bots', {
    name: `公测助手_${RAND}`, systemPrompt: '免费版的虚拟助手，简短回答。',
    welcomeMsg: '欢迎免费试用！', isPublic: true, priceType: 'free',
  }, creator.tokens.accessToken);
  const paidBot = await http('POST', '/bots', {
    name: `专家_${RAND}`, systemPrompt: '专业咨询师，根据问题给出具体建议。',
    welcomeMsg: '你好，需要咨询什么？', isPublic: true, priceType: 'monthly', priceCents: 999,
  }, creator.tokens.accessToken);
  const privateBot = await http('POST', '/bots', {
    name: `私人助手_${RAND}`, systemPrompt: '这是一个仅供创建者使用的私人 Bot。', isPublic: false,
  }, creator.tokens.accessToken);
  ok(`free=${freeBot.id} paid=${paidBot.id} private=${privateBot.id}`);

  step('3. marketplace search returns public bots, not private');
  const mp = await http('GET', `/bots/marketplace?q=${RAND}`, null, buyer.tokens.accessToken);
  if (!mp.find((b) => b.id === freeBot.id)) fail('free bot not in mp');
  else if (!mp.find((b) => b.id === paidBot.id)) fail('paid bot not in mp');
  else if (mp.find((b) => b.id === privateBot.id)) fail('private bot leaked into mp');
  else ok(`${mp.length} bots found, private excluded`);

  step('4. cannot chat with public bot without subscription');
  let err = null;
  try { await http('POST', `/bots/${freeBot.id}/conversation`, null, buyer.tokens.accessToken); }
  catch (e) { err = e; }
  if (err && /403/.test(err.message)) ok('403 as expected');
  else fail(`expected 403, got ${err?.message ?? 'no error'}`);

  step('5. subscribe to free bot → active, no charge');
  const sub1 = await http('POST', `/bots/${freeBot.id}/subscribe`, null, buyer.tokens.accessToken);
  if (sub1.status !== 'active') fail(`status ${sub1.status}`); else ok('subscribed for free');
  const balAfterFree = await http('GET', '/wallet', null, buyer.tokens.accessToken);
  if (balAfterFree.balanceCents !== 0) fail(`balance ${balAfterFree.balanceCents}, expected 0`);
  else ok('no charge for free bot');

  step('6. open free bot conversation now succeeds');
  const conv = await http('POST', `/bots/${freeBot.id}/conversation`, null, buyer.tokens.accessToken);
  if (conv.type !== 'bot') fail('not bot conv'); else ok(`conversation ${conv.id}`);

  step('7. try paid bot subscribe with empty wallet → 400');
  let payErr = null;
  try { await http('POST', `/bots/${paidBot.id}/subscribe`, null, buyer.tokens.accessToken); }
  catch (e) { payErr = e; }
  if (payErr && /400/.test(payErr.message)) ok('400 insufficient balance');
  else fail(`expected 400, got ${payErr?.message ?? 'no error'}`);

  step('8. recharge wallet, then subscribe to paid bot');
  await http('POST', '/wallet/recharge', { amountCents: 2000 }, buyer.tokens.accessToken);
  const balBefore = await http('GET', '/wallet', null, buyer.tokens.accessToken);
  if (balBefore.balanceCents !== 2000) fail(`recharge wrong: ${balBefore.balanceCents}`);
  else ok('recharged to 2000¢');

  const paySub = await http('POST', `/bots/${paidBot.id}/subscribe`, null, buyer.tokens.accessToken);
  if (paySub.status !== 'active') fail(`paid status ${paySub.status}`);
  else if (paySub.paid !== 999) fail(`paid amount ${paySub.paid}`);
  else if (paySub.creatorEarned !== Math.floor(999 * 0.7)) fail(`creator earned ${paySub.creatorEarned}`);
  else ok(`paid ¥${paySub.paid}¢, creator gets ¥${paySub.creatorEarned}¢ (30% platform fee)`);

  step('9. buyer balance debited, creator credited');
  const buyerBal = await http('GET', '/wallet', null, buyer.tokens.accessToken);
  const creatorBal = await http('GET', '/wallet', null, creator.tokens.accessToken);
  if (buyerBal.balanceCents !== 2000 - 999) fail(`buyer ${buyerBal.balanceCents}`);
  else ok(`buyer balance ${buyerBal.balanceCents}¢`);
  if (creatorBal.balanceCents !== Math.floor(999 * 0.7)) fail(`creator ${creatorBal.balanceCents}`);
  else ok(`creator balance ${creatorBal.balanceCents}¢`);

  step('10. paid bot conversation now opens for buyer');
  const paidConv = await http('POST', `/bots/${paidBot.id}/conversation`, null, buyer.tokens.accessToken);
  if (paidConv.type !== 'bot') fail('not bot conv'); else ok(`conversation ${paidConv.id}`);

  step('11. subscribe again returns already_subscribed (no double charge)');
  const sub2 = await http('POST', `/bots/${paidBot.id}/subscribe`, null, buyer.tokens.accessToken);
  if (sub2.status !== 'already_subscribed') fail(`status ${sub2.status}`);
  else ok('idempotent subscribe');
  const buyerBal2 = await http('GET', '/wallet', null, buyer.tokens.accessToken);
  if (buyerBal2.balanceCents !== buyerBal.balanceCents) fail('charged twice!');
  else ok('balance unchanged');

  step('12. /bots/subscribed lists the bots');
  const subscribed = await http('GET', '/bots/subscribed', null, buyer.tokens.accessToken);
  const ids = subscribed.map((b) => b.id);
  if (!ids.includes(freeBot.id) || !ids.includes(paidBot.id)) fail(`subscribed list missing bots: ${ids}`);
  else ok(`subscribed: ${subscribed.length} bots`);

  step('13. creator cannot subscribe to own bot');
  let ownErr = null;
  try { await http('POST', `/bots/${freeBot.id}/subscribe`, null, creator.tokens.accessToken); }
  catch (e) { ownErr = e; }
  if (ownErr && /400/.test(ownErr.message)) ok('400 as expected');
  else fail(`expected 400, got ${ownErr?.message ?? 'no error'}`);

  step('14. real LLM streaming over paid subscription still works');
  const sock = await connectSocket(buyer.tokens.accessToken);
  const startP = new Promise((res) => sock.once('bot:start', res));
  const doneP = new Promise((res) => sock.once('bot:done', res));
  sock.emit('message:send', {
    conversationId: paidConv.id,
    text: '帮我评估下学英语的方法',
    clientMsgId: 'mk-1',
  });
  await Promise.race([startP, new Promise((_, j) => setTimeout(() => j(new Error('start timeout')), 5000))]);
  const done = await Promise.race([doneP, new Promise((_, j) => setTimeout(() => j(new Error('done timeout')), 8000))]);
  if (!done.message?.id) fail('no bot reply'); else ok(`bot replied: "${done.message.content?.text?.slice(0, 50)}…"`);
  sock.disconnect();

  step('15. unsubscribe → conversation locked again');
  await http('DELETE', `/bots/${paidBot.id}/subscribe`, null, buyer.tokens.accessToken);
  let lockErr = null;
  try { await http('POST', `/bots/${paidBot.id}/conversation`, null, buyer.tokens.accessToken); }
  catch (e) { lockErr = e; }
  if (lockErr && /403/.test(lockErr.message)) ok('403 after unsubscribe');
  else fail(`expected 403, got ${lockErr?.message ?? 'no error'}`);

  step('16. Lurker cannot subscribe to private bot');
  let pErr = null;
  try { await http('POST', `/bots/${privateBot.id}/subscribe`, null, lurker.tokens.accessToken); }
  catch (e) { pErr = e; }
  if (pErr && /403/.test(pErr.message)) ok('403 as expected');
  else fail(`expected 403, got ${pErr?.message ?? 'no error'}`);

  console.log(failed === 0 ? '\nALL MARKETPLACE CHECKS PASSED' : `\n${failed} failures`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
