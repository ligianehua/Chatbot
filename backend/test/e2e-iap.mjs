// End-to-end for Apple IAP / Google Play Billing. Server must be running with
// IAP_MODE=mock so receipts use "mock:<product>:<txn>" — real verifiers are
// wired identically and exercised in production.

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
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

(async () => {
  step('1. register user, /iap/products returns the catalog');
  const a = await http('POST', '/auth/register', {
    email: `iap_${RAND}@t.local`, password: PW, nickname: 'IapUser',
  });
  const tok = a.tokens.accessToken;

  const products = await http('GET', '/iap/products', null, tok);
  const expected = ['wallet_topup_100', 'wallet_topup_500', 'wallet_topup_1000', 'wallet_topup_5000'];
  for (const id of expected) {
    if (!products.find((p) => p.productId === id)) fail(`missing ${id}`);
  }
  ok(`catalog has ${products.length} products`);

  step('2. starting wallet balance is 0');
  const b0 = await http('GET', '/wallet', null, tok);
  if (b0.balanceCents !== 0) fail(`expected 0 got ${b0.balanceCents}`); else ok('balance 0');

  step('3. redeem Apple mock receipt for $1 — credits wallet');
  const txn1 = `apple-txn-${RAND}-1`;
  const r1 = await http('POST', '/iap/redeem', {
    provider: 'apple',
    productId: 'wallet_topup_100',
    receipt: `mock:wallet_topup_100:${txn1}`,
  }, tok);
  if (r1.wallet.balanceCents !== 100) fail(`bal ${r1.wallet.balanceCents}`);
  else if (r1.idempotent !== false) fail('first redeem should not be idempotent');
  else ok(`wallet credited to ¢${r1.wallet.balanceCents}`);

  step('4. replay same receipt — idempotent, no double credit');
  const r1b = await http('POST', '/iap/redeem', {
    provider: 'apple',
    productId: 'wallet_topup_100',
    receipt: `mock:wallet_topup_100:${txn1}`,
  }, tok);
  if (r1b.idempotent !== true) fail('expected idempotent=true');
  else if (r1b.wallet.balanceCents !== 100) fail(`bal ${r1b.wallet.balanceCents}, expected unchanged`);
  else ok('replay returned idempotent, balance unchanged');

  step('5. different Apple txn for the same product — credits again');
  const txn2 = `apple-txn-${RAND}-2`;
  const r2 = await http('POST', '/iap/redeem', {
    provider: 'apple',
    productId: 'wallet_topup_100',
    receipt: `mock:wallet_topup_100:${txn2}`,
  }, tok);
  if (r2.wallet.balanceCents !== 200) fail(`bal ${r2.wallet.balanceCents}`);
  else ok(`new txn credited, bal = ¢${r2.wallet.balanceCents}`);

  step('6. Google receipt with same txn id as Apple — credited (different namespace)');
  // External id is `${provider}:${txn}` so 'google:X' and 'apple:X' are distinct.
  const r3 = await http('POST', '/iap/redeem', {
    provider: 'google',
    productId: 'wallet_topup_500',
    receipt: `mock:wallet_topup_500:${txn1}`,
  }, tok);
  if (r3.wallet.balanceCents !== 200 + 500) fail(`bal ${r3.wallet.balanceCents}`);
  else ok(`provider-namespaced, bal = ¢${r3.wallet.balanceCents}`);

  step('7. unknown productId rejected');
  let badProd = null;
  try {
    await http('POST', '/iap/redeem', {
      provider: 'apple', productId: 'wallet_topup_99999', receipt: 'mock:wallet_topup_99999:x',
    }, tok);
  } catch (e) { badProd = e; }
  if (badProd && /400/.test(badProd.message)) ok('400 as expected');
  else fail(`expected 400, got ${badProd?.message ?? 'no error'}`);

  step('8. product mismatch (receipt says X but client asked for Y) rejected');
  let mismatch = null;
  try {
    await http('POST', '/iap/redeem', {
      provider: 'apple',
      productId: 'wallet_topup_500',
      receipt: `mock:wallet_topup_100:${RAND}-mm`,
    }, tok);
  } catch (e) { mismatch = e; }
  if (mismatch && /400/.test(mismatch.message)) ok('400 as expected');
  else fail(`expected 400, got ${mismatch?.message ?? 'no error'}`);

  step('9. malformed receipt rejected');
  let bad = null;
  try {
    await http('POST', '/iap/redeem', {
      provider: 'apple', productId: 'wallet_topup_100', receipt: 'bad:no-good',
    }, tok);
  } catch (e) { bad = e; }
  if (bad && /400/.test(bad.message)) ok('400 as expected');
  else fail(`expected 400, got ${bad?.message ?? 'no error'}`);

  step('10. unauthorized redeem rejected (no token)');
  let noAuth = null;
  try {
    const res = await fetch(`${BASE}/iap/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'apple', productId: 'wallet_topup_100', receipt: 'mock:wallet_topup_100:y' }),
    });
    if (res.status === 401) noAuth = true;
  } catch (e) {}
  if (noAuth) ok('401 as expected');
  else fail('expected 401');

  step('11. transaction history shows our IAP credits with externalOrderId');
  const txns = await http('GET', '/wallet/transactions', null, tok);
  const apple1 = txns.find((t) => t.externalOrderId === `apple:${txn1}`);
  const apple2 = txns.find((t) => t.externalOrderId === `apple:${txn2}`);
  const goog = txns.find((t) => t.externalOrderId === `google:${txn1}`);
  if (!apple1 || apple1.amountCents !== 100) fail('apple txn1 missing');
  else if (!apple2 || apple2.amountCents !== 100) fail('apple txn2 missing');
  else if (!goog || goog.amountCents !== 500) fail('google txn missing');
  else ok('all 3 IAP transactions present with correct provider namespacing');

  step('12. recharge → spend on paid bot still works end-to-end');
  // Create a paid bot from a second account.
  const creator = await http('POST', '/auth/register', {
    email: `iap_creator_${RAND}@t.local`, password: PW, nickname: 'Creator',
  });
  const paidBot = await http('POST', '/bots', {
    name: `IAP助手_${RAND}`,
    systemPrompt: '一个用 IAP 余额订阅的测试 Bot，作用是验证支付闭环。',
    welcomeMsg: '欢迎',
    isPublic: true,
    priceType: 'monthly',
    priceCents: 300,
  }, creator.tokens.accessToken);

  const sub = await http('POST', `/bots/${paidBot.id}/subscribe`, null, tok);
  if (sub.status !== 'active') fail(`sub status ${sub.status}`);
  else if (sub.paid !== 300) fail(`paid ${sub.paid}`);
  else ok(`subscribed using IAP credits; charge ¢${sub.paid}, creator earned ¢${sub.creatorEarned}`);

  const balAfter = await http('GET', '/wallet', null, tok);
  if (balAfter.balanceCents !== 200 + 500 - 300) fail(`bal ${balAfter.balanceCents}`);
  else ok(`buyer wallet ${balAfter.balanceCents}¢ (after $3.00 spend)`);

  console.log(failed === 0 ? '\nALL IAP CHECKS PASSED' : `\n${failed} failures`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
