const { handleRequest } = require('./server.js');
const { EventEmitter } = require('node:events');

// Virtual Request & Response mock
function invokeHandler(url, method = 'GET', body = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.url = url;
    req.method = method;
    req.headers = { host: 'localhost:3000', ...customHeaders };

    let statusCode = 200;
    let headers = {};
    let responseData = '';

    const res = {
      writeHead(code, hdrs) {
        statusCode = code;
        headers = { ...headers, ...hdrs };
      },
      setHeader(name, val) {
        headers[name] = val;
      },
      end(chunk) {
        if (chunk) responseData += chunk.toString();
        let json = null;
        try {
          if (responseData && (headers['Content-Type']?.includes('application/json') || responseData.startsWith('{') || responseData.startsWith('['))) {
            json = JSON.parse(responseData);
          }
        } catch (e) {}

        resolve({
          statusCode,
          headers,
          body: responseData,
          json
        });
      }
    };

    // Run handler
    handleRequest(req, res).catch(reject);

    // Feed request body if any
    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', Buffer.from(payload));
    }
    req.emit('end');
  });
}

async function runTests() {
  console.log('=======================================================');
  console.log('   STARTING BOMASPHERE PMS DIRECT TEST SUITE');
  console.log('=======================================================');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Static HTML serving
  await test('Serve index.html with 200 OK', async () => {
    const res = await invokeHandler('/');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!res.body.includes('BomaSphere PMS')) throw new Error('HTML does not contain BomaSphere PMS');
  });

  // 2. Static CSS serving
  await test('Serve styles.css with 200 OK', async () => {
    const res = await invokeHandler('/styles.css');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!res.body.includes('Plus Jakarta Sans')) throw new Error('CSS missing expected font');
  });

  // 3. Static JS serving
  await test('Serve app.js with 200 OK', async () => {
    const res = await invokeHandler('/app.js');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!res.body.includes('BomaSphereApp')) throw new Error('app.js missing BomaSphereApp');
  });

  // 4. API Stats
  await test('GET /api/stats returns portfolio metrics', async () => {
    const res = await invokeHandler('/api/stats');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!res.json.stats || res.json.stats.properties < 1) throw new Error('Invalid stats returned');
    console.log(`      Properties: ${res.json.stats.properties}, Total Units: ${res.json.stats.total_units}, Occupancy: ${res.json.stats.occupancy_rate}%, Billed: KES ${res.json.stats.total_billed.toLocaleString()}, Collected: KES ${res.json.stats.total_collected.toLocaleString()}`);
  });

  // 5. API Properties
  await test('GET /api/properties lists real estate portfolios', async () => {
    const res = await invokeHandler('/api/properties');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!Array.isArray(res.json) || res.json.length < 4) throw new Error('Properties array incomplete');
    console.log(`      Properties Found: ${res.json.map(p => p.name).join(', ')}`);
  });

  // 6. API Units
  await test('GET /api/units lists all units with occupancy status', async () => {
    const res = await invokeHandler('/api/units');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!Array.isArray(res.json) || res.json.length < 10) throw new Error('Units list incomplete');
    console.log(`      Units Count: ${res.json.length}`);
  });

  // 7. API Tenants
  await test('GET /api/tenants lists active tenants with balances', async () => {
    const res = await invokeHandler('/api/tenants');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!Array.isArray(res.json) || res.json.length < 5) throw new Error('Tenants list incomplete');
    console.log(`      Tenants: ${res.json.map(t => t.name).join(', ')}`);
  });

  // 8. API Invoices
  await test('GET /api/invoices lists itemized rent invoices', async () => {
    const res = await invokeHandler('/api/invoices');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!Array.isArray(res.json) || res.json.length < 5) throw new Error('Invoices incomplete');
    console.log(`      Total Invoices: ${res.json.length}`);
  });

  // 9. API Payments & M-Pesa STK push simulation
  await test('POST /api/payments simulates instant M-Pesa STK receipting & reconciliation', async () => {
    const res = await invokeHandler('/api/payments', 'POST', {
      tenant_id: 3,
      invoice_id: 3,
      amount: 45000,
      payment_method: 'M-Pesa',
      payer_phone: '+254798654321',
      notes: 'Automated test STK payment'
    });
    if (res.statusCode !== 201) throw new Error(`Status ${res.statusCode}`);
    if (!res.json.receipt_number || !res.json.reference_code) throw new Error('Missing receipt or ref code');
    console.log(`      Generated Receipt: ${res.json.receipt_number}, M-Pesa Code: ${res.json.reference_code}, Reconciled Invoice Balance: KES ${res.json.reconciled_invoice?.balance}`);
  });

  // 10. Water meter reading recording
  await test('POST /api/water-readings calculates consumption and logs tariff cost', async () => {
    const res = await invokeHandler('/api/water-readings', 'POST', {
      unit_id: 1,
      month: '2026-11',
      reading_date: '2026-11-02',
      previous_reading: 169.2,
      current_reading: 182.7,
      rate_per_unit: 175.0
    });
    if (res.statusCode !== 201) throw new Error(`Status ${res.statusCode}`);
    if (res.json.units_consumed !== 13.5) throw new Error(`Expected 13.5 units, got ${res.json.units_consumed}`);
    console.log(`      Consumed: ${res.json.units_consumed} m3, Total Water Charge: KES ${res.json.total_cost}`);
  });

  // 11. Maintenance tickets (AppFolio style)
  await test('POST /api/maintenance logs and assigns work order', async () => {
    const res = await invokeHandler('/api/maintenance', 'POST', {
      property_id: 1,
      unit_id: 2,
      title: 'Borehole Water Booster Pump Pressure Check',
      category: 'Plumbing',
      priority: 'high',
      estimated_cost: 3500,
      assigned_contractor: 'Davis & Shirtliff Technical',
      description: 'Quarterly pressure vessel verification'
    });
    if (res.statusCode !== 201) throw new Error(`Status ${res.statusCode}`);
    if (!res.json.ticket_number) throw new Error('Missing ticket number');
    console.log(`      Created Work Order: ${res.json.ticket_number}`);
  });

  // 12. Landlord Remittance Statement (Buildium style)
  await test('GET /api/reports/landlord-statement computes owner payout', async () => {
    const res = await invokeHandler('/api/reports/landlord-statement?property_id=1&month=2026-11');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    const st = res.json.statement;
    if (!st || st.net_remittance_payout === undefined) throw new Error('Invalid statement structure');
    console.log(`      Property: ${st.property.name}, Gross Collections: KES ${st.gross_collections}, Net Payout: KES ${st.net_remittance_payout}`);
  });

  // 13. SMS / WhatsApp Broadcast
  await test('POST /api/communications/broadcast dispatches bulk notifications', async () => {
    const res = await invokeHandler('/api/communications/broadcast', 'POST', {
      type: 'sms',
      message: 'Automated test broadcast: Maintenance completed successfully.'
    }, {
      authorization: 'Bearer token_property_manager'
    });
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    console.log(`      Broadcast successfully delivered to ${res.json.recipients_reached} tenants`);
  });

  // 14. RBAC SaaS Users Directory
  await test('GET /api/users lists seeded users across all 5 RBAC roles (authenticated)', async () => {
    const res = await invokeHandler('/api/users', 'GET', null, {
      authorization: 'Bearer token_property_manager'
    });
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!Array.isArray(res.json) || res.json.length < 5) throw new Error('Expected at least 5 seeded users');
    const roles = res.json.map(u => u.role);
    const requiredRoles = ['super_admin', 'property_manager', 'caretaker', 'landlord', 'tenant'];
    for (const r of requiredRoles) {
      if (!roles.includes(r)) throw new Error(`Missing required RBAC role: ${r}`);
    }
    console.log(`      Found ${res.json.length} Users with Roles: ${[...new Set(roles)].join(', ')}`);
  });

  // 15. User Provisioning & Deletion
  await test('POST & DELETE /api/users handles SaaS user lifecycle', async () => {
    const testEmail = `grace.${Date.now()}@bomasphere.co.ke`;
    const postRes = await invokeHandler('/api/users', 'POST', {
      name: 'Grace Wambui (Test Agent)',
      email: testEmail,
      phone: '+254711998877',
      role: 'caretaker',
      property_id: 1
    }, {
      authorization: 'Bearer token_property_manager'
    });
    if (postRes.statusCode !== 201) throw new Error(`Status ${postRes.statusCode}`);
    const newId = postRes.json.user.id;
    if (!newId) throw new Error('Missing new user ID');
    console.log(`      Provisioned User ID: ${newId} with role ${postRes.json.user.role}`);

    const delRes = await invokeHandler(`/api/users/${newId}`, 'DELETE', null, {
      authorization: 'Bearer token_property_manager'
    });
    if (delRes.statusCode !== 200) throw new Error(`Delete failed with status ${delRes.statusCode}`);
    console.log(`      Successfully cleaned up test user ID: ${newId}`);
  });

  // 16. Real RBAC: Caretaker blocked from Invoicing (403 Forbidden)
  await test('RBAC Security: Caretaker token strictly blocked from /api/invoices with 403', async () => {
    const res = await invokeHandler('/api/invoices', 'GET', null, {
      authorization: 'Bearer token_caretaker'
    });
    if (res.statusCode !== 403) throw new Error(`Expected 403 Forbidden, got ${res.statusCode}`);
    if (!res.json.error || !res.json.error.includes('403 Forbidden')) throw new Error('Expected 403 error message');
    console.log(`      Server strictly enforced RBAC: ${res.json.error}`);
  });

  // 17. Real RBAC: Caretaker blocked from Landlord Remittance (403 Forbidden)
  await test('RBAC Security: Caretaker token strictly blocked from /api/reports/landlord-statement with 403', async () => {
    const res = await invokeHandler('/api/reports/landlord-statement?property_id=1', 'GET', null, {
      authorization: 'Bearer token_caretaker'
    });
    if (res.statusCode !== 403) throw new Error(`Expected 403 Forbidden, got ${res.statusCode}`);
    console.log(`      Server strictly enforced RBAC: ${res.json.error}`);
  });

  // 18. Real RBAC: Tenant blocked from User Management (403 Forbidden)
  await test('RBAC Security: Tenant token strictly blocked from /api/users with 403', async () => {
    const res = await invokeHandler('/api/users', 'GET', null, {
      authorization: 'Bearer token_tenant'
    });
    if (res.statusCode !== 403) throw new Error(`Expected 403 Forbidden, got ${res.statusCode}`);
    console.log(`      Server strictly enforced RBAC: ${res.json.error}`);
  });

  // 19. Real RBAC: Tenant data isolation (Can only query their own invoices)
  await test('RBAC Security: Tenant token strictly scopes invoices to tenant_id=1', async () => {
    const res = await invokeHandler('/api/invoices', 'GET', null, {
      authorization: 'Bearer token_tenant'
    });
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!Array.isArray(res.json)) throw new Error('Expected array');
    const allForTenant1 = res.json.every(i => i.tenant_id === 1);
    if (!allForTenant1) throw new Error('Leak detected! Invoices for other tenants returned to tenant!');
    console.log(`      Tenant isolation verified: ${res.json.length} invoice(s) returned, all scoped to Tenant #1`);
  });

  // 20. Defense-in-Depth: Anonymous blocked from /api/users (401 Unauthorized)
  await test('Defense-in-Depth: Anonymous request to /api/users returns 401 Unauthorized', async () => {
    const res = await invokeHandler('/api/users', 'GET');
    if (res.statusCode !== 401) throw new Error(`Expected 401, got ${res.statusCode}`);
    console.log(`      Server strictly rejected unauthenticated access: ${res.json.error}`);
  });

  // 21. Defense-in-Depth: Security Headers Enforced
  await test('Defense-in-Depth: HTTP Security Headers present on API responses', async () => {
    const res = await invokeHandler('/api/stats');
    if (res.headers['X-Content-Type-Options'] !== 'nosniff') throw new Error('Missing nosniff header');
    if (res.headers['X-Frame-Options'] !== 'SAMEORIGIN') throw new Error('Missing X-Frame-Options header');
    if (!res.headers['Content-Security-Policy']) throw new Error('Missing Content-Security-Policy header');
    console.log('      Verified headers: nosniff, SAMEORIGIN, CSP present');
  });

  // 22. Defense-in-Depth: Directory Traversal Rejected (403 Access Denied)
  await test('Defense-in-Depth: Directory Traversal attempts strictly rejected with 403', async () => {
    const res = await invokeHandler('/..%2f..%2fdb.js');
    if (res.statusCode !== 403) throw new Error(`Expected 403, got ${res.statusCode}`);
    console.log('      Verified directory traversal attempt blocked with 403 Access Denied');
  });

  // 23. Defense-in-Depth: Unauthenticated /api/reset-seed Rejected (403 Forbidden)
  await test('Defense-in-Depth: Anonymous /api/reset-seed rejected with 403', async () => {
    const res = await invokeHandler('/api/reset-seed', 'POST');
    if (res.statusCode !== 403) throw new Error(`Expected 403, got ${res.statusCode}`);
    console.log('      System wipe protected against anonymous callers');
  });

  // 24. PWA: Web App Manifest
  await test('PWA: Web App Manifest /manifest.json serves valid JSON with standalone display', async () => {
    const res = await invokeHandler('/manifest.json');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!res.json || res.json.display !== 'standalone') throw new Error('Manifest missing display: standalone');
    if (!Array.isArray(res.json.icons) || res.json.icons.length < 3) throw new Error('Manifest missing PWA icons array');
    console.log(`      Manifest verified: name="${res.json.name}", icons=${res.json.icons.length}, display=${res.json.display}`);
  });

  // 25. PWA: Service Worker
  await test('PWA: Service Worker /sw.js serves valid JS with no-cache headers', async () => {
    const res = await invokeHandler('/sw.js');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!res.body.includes('bomasphere-cache')) throw new Error('sw.js missing cache initialization');
    if (!res.headers['Cache-Control'] || !res.headers['Cache-Control'].includes('no-cache')) {
      throw new Error('sw.js missing Cache-Control: no-cache header');
    }
    console.log('      Service Worker verified with Cache-Control: no-cache and service worker lifecycle');
  });

  // 26. PWA: App Icons & Favicon
  await test('PWA: Favicon and Multi-Resolution PNG Icons serve 200 OK', async () => {
    const favSvg = await invokeHandler('/favicon.svg');
    if (favSvg.statusCode !== 200) throw new Error(`favicon.svg returned ${favSvg.statusCode}`);

    const favIco = await invokeHandler('/favicon.ico');
    if (favIco.statusCode !== 200) throw new Error(`favicon.ico returned ${favIco.statusCode}`);

    const icon192 = await invokeHandler('/icons/icon-192.png');
    if (icon192.statusCode !== 200) throw new Error(`icon-192.png returned ${icon192.statusCode}`);

    const icon512 = await invokeHandler('/icons/icon-512.png');
    if (icon512.statusCode !== 200) throw new Error(`icon-512.png returned ${icon512.statusCode}`);

    console.log('      PWA Assets verified: favicon.svg, favicon.ico, icon-192.png, icon-512.png all 200 OK');
  });

  console.log(`\n=======================================================`);
  console.log(` TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED `);
  console.log(`=======================================================`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
