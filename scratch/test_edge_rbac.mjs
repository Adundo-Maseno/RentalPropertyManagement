import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const catchallCode = fs.readFileSync(path.resolve('functions/api/[[catchall]].js'), 'utf8');
const dataUri = `data:text/javascript;base64,${Buffer.from(catchallCode).toString('base64')}`;
const { onRequest } = await import(dataUri);

async function testEdgeRBAC() {
  console.log('--- Testing Cloudflare Edge Catchall RBAC Guards ---');

  // Helper to simulate request to onRequest
  async function edgeReq(pathname, method = 'GET', headers = {}, body = null) {
    const req = new Request(`https://rentalpropertymanagement.pages.dev${pathname}`, {
      method,
      headers: new Headers(headers),
      body: body ? JSON.stringify(body) : null
    });
    const res = await onRequest({ request: req });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  // 1. Caretaker blocked from /api/invoices
  const r1 = await edgeReq('/api/invoices', 'GET', { 'Authorization': 'Bearer token_caretaker' });
  assert.strictEqual(r1.status, 403, 'Caretaker should be blocked from /api/invoices with 403');
  console.log('✔ Caretaker blocked from /api/invoices (403)');

  // 2. Caretaker blocked from /api/expenses
  const r2 = await edgeReq('/api/expenses', 'GET', { 'Authorization': 'Bearer token_caretaker' });
  assert.strictEqual(r2.status, 403, 'Caretaker should be blocked from /api/expenses with 403');
  console.log('✔ Caretaker blocked from /api/expenses (403)');

  // 3. Caretaker blocked from /api/reports/landlord-statement
  const r3 = await edgeReq('/api/reports/landlord-statement', 'GET', { 'Authorization': 'Bearer token_caretaker' });
  assert.strictEqual(r3.status, 403, 'Caretaker should be blocked from landlord-statement with 403');
  console.log('✔ Caretaker blocked from /api/reports/landlord-statement (403)');

  // 4. Tenant blocked from /api/users
  const r4 = await edgeReq('/api/users', 'GET', { 'Authorization': 'Bearer token_tenant' });
  assert.strictEqual(r4.status, 403, 'Tenant should be blocked from /api/users with 403');
  console.log('✔ Tenant blocked from /api/users (403)');

  // 5. Anonymous blocked from /api/users (401)
  const r5 = await edgeReq('/api/users', 'GET', {});
  assert.strictEqual(r5.status, 401, 'Anonymous should be rejected with 401');
  console.log('✔ Anonymous blocked from /api/users (401)');

  // 6. Anonymous blocked from /api/reset-seed (403)
  const r6 = await edgeReq('/api/reset-seed', 'POST', {});
  assert.strictEqual(r6.status, 403, 'Anonymous reset-seed should be blocked with 403');
  console.log('✔ Anonymous blocked from /api/reset-seed (403)');

  // 7. Property Manager allowed on /api/invoices
  const r7 = await edgeReq('/api/invoices', 'GET', { 'Authorization': 'Bearer token_property_manager' });
  assert.strictEqual(r7.status, 200, 'Property manager should access /api/invoices');
  assert(Array.isArray(r7.data), 'Invoices should be an array');
  console.log('✔ Property Manager allowed on /api/invoices (200, ' + r7.data.length + ' invoices)');

  // 8. Tenant scoped invoices
  const r8 = await edgeReq('/api/invoices', 'GET', { 'Authorization': 'Bearer token_tenant' });
  assert.strictEqual(r8.status, 200, 'Tenant should get scoped invoices');
  assert(r8.data.every(i => i.tenant_id === 1), 'All invoices should belong to tenant_id=1');
  console.log('✔ Tenant scoped to own invoices (200, ' + r8.data.length + ' invoices)');

  console.log('\nALL 8 EDGE RBAC TESTS PASSED SUCCESSFULLY! 🎯');
}

testEdgeRBAC().catch(err => {
  console.error('Edge RBAC Test Failed:', err);
  process.exit(1);
});
