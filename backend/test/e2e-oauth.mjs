// End-to-end for OAuth sign-in via Apple/Google. Server must be running with
// OAUTH_MODE=mock so the test crafts unsigned mock tokens — the real
// verifiers (jose + JWKS) are wired identically and exercised in production.

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

function mockToken(claims) {
  return 'mock.' + Buffer.from(JSON.stringify(claims), 'utf8').toString('base64');
}

(async () => {
  step('1. Apple Sign-In creates a new user');
  const appleSub = `apple-${RAND}-001`;
  const appleEmail = `oauth_apple_${RAND}@privaterelay.appleid.com`;
  const r1 = await http('POST', '/auth/oauth', {
    provider: 'apple',
    idToken: mockToken({ sub: appleSub, email: appleEmail, email_verified: true }),
    nickname: 'AppleUser',
  });
  if (!r1.tokens?.accessToken) fail('no access token');
  else if (!r1.created) fail('expected created=true');
  else ok(`created user ${r1.user.id} nickname=${r1.user.nickname} email=${r1.user.email}`);

  step('2. /users/me works with the returned token');
  const me = await http('GET', '/users/me', null, r1.tokens.accessToken);
  if (me.id !== r1.user.id) fail('me id mismatch'); else ok(`me.id == user.id`);

  step('3. Second sign-in returns same user (matched by appleUserId)');
  const r2 = await http('POST', '/auth/oauth', {
    provider: 'apple',
    idToken: mockToken({ sub: appleSub, email: appleEmail }),
  });
  if (r2.created) fail('expected created=false on repeat');
  else if (r2.user.id !== r1.user.id) fail(`id mismatch ${r2.user.id} vs ${r1.user.id}`);
  else ok('same user returned, no duplicate created');

  step('4. Google Sign-In creates a separate user');
  const gSub = `google-${RAND}-x`;
  const gEmail = `oauth_g_${RAND}@gmail.com`;
  const r3 = await http('POST', '/auth/oauth', {
    provider: 'google',
    idToken: mockToken({
      sub: gSub, email: gEmail, name: 'Google McUser', picture: 'https://x.test/a.png',
    }),
  });
  if (!r3.created) fail('expected created=true');
  else if (r3.user.id === r1.user.id) fail('shared id with apple user');
  else ok(`google user ${r3.user.id} nickname=${r3.user.nickname}`);

  step('5. Existing email-password account linked when OAuth email matches');
  const sharedEmail = `oauth_link_${RAND}@test.local`;
  const reg = await http('POST', '/auth/register', {
    email: sharedEmail, password: PW, nickname: 'Linked',
  });
  const linked = await http('POST', '/auth/oauth', {
    provider: 'google',
    idToken: mockToken({ sub: `google-link-${RAND}`, email: sharedEmail }),
  });
  if (linked.created) fail('should have linked, not created');
  else if (linked.user.id !== reg.user.id) fail('linked to wrong user');
  else ok(`linked existing user ${linked.user.id}`);

  step('6. Password login still works on the linked account');
  const pwLogin = await http('POST', '/auth/login', { email: sharedEmail, password: PW });
  if (pwLogin.user.id !== reg.user.id) fail('password login broken'); else ok('password still works');

  step('7. Invalid token shape rejected');
  let badErr = null;
  try { await http('POST', '/auth/oauth', { provider: 'apple', idToken: 'not-a-real-token' }); }
  catch (e) { badErr = e; }
  if (badErr && /401/.test(badErr.message)) ok('401 as expected');
  else fail(`expected 401, got ${badErr?.message ?? 'no error'}`);

  step('8. Unsupported provider rejected');
  let provErr = null;
  try { await http('POST', '/auth/oauth', { provider: 'wechat', idToken: mockToken({ sub: 'x' }) }); }
  catch (e) { provErr = e; }
  if (provErr && /400/.test(provErr.message)) ok('400 as expected');
  else fail(`expected 400, got ${provErr?.message ?? 'no error'}`);

  step('9. Token without sub claim rejected');
  let subErr = null;
  try { await http('POST', '/auth/oauth', { provider: 'apple', idToken: mockToken({ email: 'x@y.test' }) }); }
  catch (e) { subErr = e; }
  if (subErr && /401/.test(subErr.message)) ok('401 as expected');
  else fail(`expected 401, got ${subErr?.message ?? 'no error'}`);

  step('10. Apple-only user (no email returned, common w/ "Hide my email") still works');
  const noEmail = await http('POST', '/auth/oauth', {
    provider: 'apple',
    idToken: mockToken({ sub: `apple-noemail-${RAND}` }),
    nickname: 'Anonymous',
  });
  if (!noEmail.created) fail('expected create');
  else if (noEmail.user.email !== null) fail(`unexpected email ${noEmail.user.email}`);
  else if (noEmail.user.nickname !== 'Anonymous') fail(`nickname ${noEmail.user.nickname}`);
  else ok('email-less Apple user created with provided nickname');

  console.log(failed === 0 ? '\nALL OAUTH CHECKS PASSED' : `\n${failed} failures`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
