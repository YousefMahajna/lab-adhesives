const { test } = require('node:test');
const assert = require('node:assert/strict');
const Hub = require('../hub-entry.js');
const Policy = require('./fixtures/access-policy.js');
const base = 'https://yousefmahajna.github.io/lab-adhesives/';
const url = email => base + '#ipl-entry=1&email=' + encodeURIComponent(email);
const data = () => ({ platforms: [{ id: 'adhesives' }], access: [Policy.ownerRow(), { name: 'New Editor', email: 'neweditor@nvidia.com', platform: 'adhesives', level: 'editor' }] });
test('the unmarked regular link never reads the hub email or permissions', async () => {
  let calls = 0;
  assert.equal(Hub.parse(base), null);
  assert.deepEqual(await Hub.load(base, () => { calls++; }, () => { calls++; }), { mode: 'legacy' });
  assert.equal(calls, 0);
});
test('hub editors, managers and administrators map to Adhesive Editor', () => {
  for (const level of ['editor', 'manager']) {
    const d = data(); d.access[1].level = level;
    assert.equal(Hub.fromData('neweditor@nvidia.com', d, Policy).role, 'editor');
  }
  assert.equal(Hub.fromData(Policy.OWNER, data(), Policy).role, 'editor');
});
test('unlisted NVIDIA addresses receive Viewer via the central default', () => {
  const result = Hub.fromData('unknown@nvidia.com', data(), Policy);
  assert.equal(result.role, 'viewer'); assert.equal(result.name, 'unknown@nvidia.com');
});
test('a forged role or name in the URL is ignored', async () => {
  const d = data();
  const result = await Hub.load(url('unknown@nvidia.com') + '&role=admin&name=Yousef', async () => ({ ok: true, json: async () => ({ encoding: 'base64', content: Buffer.from(JSON.stringify(d)).toString('base64') }) }), async () => Policy);
  assert.equal(result.role, 'viewer'); assert.equal(result.name, 'unknown@nvidia.com');
});
test('invalid, missing and ambiguous email handoffs are rejected', () => {
  for (const email of ['bad@gmail.com', '*@nvidia.com', 'user@nvidia.com.attacker.com']) assert.throws(() => Hub.fromData(email, data(), Policy), /valid NVIDIA/);
  assert.throws(() => Hub.parse(base + '#ipl-entry=1'), /select your NVIDIA email/);
  assert.throws(() => Hub.parse(url('test@nvidia.com') + '&email=other@nvidia.com'), /select your NVIDIA email/);
});
test('denied users and general No access rules do not fall back to legacy selection', () => {
  const d = data(); d.access.push({ name: 'Blocked', email: 'blocked@nvidia.com', platform: 'adhesives', level: 'none' });
  assert.throws(() => Hub.fromData('blocked@nvidia.com', d, Policy), e => e.code === 'NO_ACCESS');
  d.access.push({ name: 'All NVIDIA users', email: '*@nvidia.com', platform: 'adhesives', level: 'none' });
  assert.throws(() => Hub.fromData('unknown@nvidia.com', d, Policy), e => e.code === 'NO_ACCESS');
  assert.equal(Hub.fromData('neweditor@nvidia.com', d, Policy).role, 'editor');
});
test('fresh configuration is requested without accepting cached roles', async () => {
  let seen;
  const result = await Hub.load(url('neweditor@nvidia.com'), async (href, options) => {
    seen = { href, options }; return { ok: true, json: async () => ({ encoding: 'base64', content: Buffer.from(JSON.stringify(data())).toString('base64') }) };
  }, async () => Policy);
  assert.equal(result.name, 'New Editor'); assert.equal(result.role, 'editor');
  assert.equal(seen.options.cache, 'no-store'); assert.ok(seen.href.endsWith('platforms.json?ref=main'));
  assert.equal(seen.options.headers.Authorization, undefined);
});
test('unavailable or malformed shared permissions block hub entry', async () => {
  await assert.rejects(Hub.load(url('neweditor@nvidia.com'), async () => ({ ok: false }), async () => Policy), /current Process Lab permissions/);
  await assert.rejects(Hub.load(url('neweditor@nvidia.com'), async () => ({ ok: true, json: async () => ({}) }), async () => Policy), /could not be read/);
  assert.throws(() => Hub.fromData('neweditor@nvidia.com', { access: [] }, Policy), /permissions list/);
});
