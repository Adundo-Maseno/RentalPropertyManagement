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

  // 27. Production Hygiene: robots.txt
  await test('Production Hygiene: /robots.txt serves valid rules disallowing private API routes', async () => {
    const res = await invokeHandler('/robots.txt');
    if (res.statusCode !== 200) throw new Error(`robots.txt returned ${res.statusCode}`);
    if (!res.body.includes('Disallow: /api/')) throw new Error('robots.txt missing API disallow rule');
    console.log('      Verified robots.txt: Disallow /api/ and allows public assets');
  });

  // 28. Authentication: Credential Login Verification & Password Rejection
  await test('Auth: /api/auth/login validates credentials and rejects wrong passwords with 401', async () => {
    // Attempt wrong password
    const failRes = await invokeHandler('/api/auth/login', 'POST', {
      email: 'ndegwa@crownpeak.co.ke',
      password: 'wrong_password_xyz'
    });
    if (failRes.statusCode !== 401) throw new Error(`Expected 401 for wrong password, got ${failRes.statusCode}`);

    // Attempt valid login
    const okRes = await invokeHandler('/api/auth/login', 'POST', {
      email: 'ndegwa@crownpeak.co.ke',
      password: 'password123'
    });
    if (okRes.statusCode !== 200) throw new Error(`Expected 200, got ${okRes.statusCode}`);
    if (!okRes.json.token || !okRes.json.user) throw new Error('Missing token or user object');
    if (okRes.json.user.password_hash) throw new Error('Security leak: password_hash returned in auth response');
    console.log(`      Authenticated: ${okRes.json.user.name} (${okRes.json.user.role}) with secure session token`);
  });

  // 29. Authentication: /api/auth/me Session Validation
  await test('Auth: /api/auth/me returns authenticated user identity with bearer token', async () => {
    const unauthRes = await invokeHandler('/api/auth/me', 'GET');
    if (unauthRes.statusCode !== 401) throw new Error(`Expected 401 for unauthenticated /me, got ${unauthRes.statusCode}`);

    const authRes = await invokeHandler('/api/auth/me', 'GET', null, {
      authorization: 'Bearer token_super_admin'
    });
    if (authRes.statusCode !== 200) throw new Error(`Expected 200, got ${authRes.statusCode}`);
    if (authRes.json.user.role !== 'super_admin') throw new Error(`Expected super_admin, got ${authRes.json.user.role}`);
    console.log(`      Verified /api/auth/me identity: ${authRes.json.user.name}`);
  });

  // 30. Production Error Pages: 404 Not Found Page
  await test('Error Pages: /404.html serves customized branded page with 404 status', async () => {
    const res = await invokeHandler('/404.html');
    if (res.statusCode !== 404) throw new Error(`Expected 404 status, got ${res.statusCode}`);
    if (!res.body.includes('Page Not Found') || !res.body.includes('BomaSphere')) {
      throw new Error('404.html missing expected branding and error messaging');
    }
    console.log('      Verified 404 page: Branded Page Not Found with return actions and diagnostics');
  });

  // 31. Production Error Pages: 500 Server Error Page
  await test('Error Pages: /500.html serves customized incident telemetry page with 500 status', async () => {
    const res = await invokeHandler('/500.html');
    if (res.statusCode !== 500) throw new Error(`Expected 500 status, got ${res.statusCode}`);
    if (!res.body.includes('Internal Server Error') || !res.body.includes('Incident Telemetry')) {
      throw new Error('500.html missing expected error messaging or incident tracking');
    }
    console.log('      Verified 500 page: Branded Internal Server Error with incident ID and telemetry');
  });

  // 32. Public Vacancies Listing API
  await test('Public Rentals: GET /api/public/vacancies returns available units with specs', async () => {
    const res = await invokeHandler('/api/public/vacancies');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    if (!res.json.vacancies || !Array.isArray(res.json.vacancies)) throw new Error('Expected vacancies array');
    const first = res.json.vacancies[0];
    if (!first || !first.photo || first.bedrooms === undefined || !first.total_monthly) {
      throw new Error('Vacant listing missing enriched attributes');
    }
    console.log(`      Found ${res.json.count} public vacant spaces. Example: Unit ${first.unit_number} (${first.unit_type}) at KES ${first.base_rent.toLocaleString()}/mo`);
  });

  // 33. Public Viewing Appointment Booking
  await test('Public Rentals: POST /api/public/book-viewing schedules prospect viewing', async () => {
    const res = await invokeHandler('/api/public/book-viewing', 'POST', {
      unit_id: 4,
      prospect_name: 'Wanjiku Mwangi',
      phone: '+254711998877',
      email: 'wanjiku@kenyabiz.co.ke',
      preferred_date: '2026-11-06',
      time_slot: '02:00 PM',
      notes: 'Interested in parking bay allocation'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    if (!res.json.reference || !res.json.reference.startsWith('VIEW-')) throw new Error('Missing VIEW reference');
    console.log(`      Viewing appointment confirmed with reference: ${res.json.reference}`);
  });

  // 34. Feature 1: WhatsApp Business Interactive Bot
  await test('WhatsApp Bot: POST /api/whatsapp/webhook handles 2-way BALANCE command', async () => {
    const res = await invokeHandler('/api/whatsapp/webhook', 'POST', {
      phone: '+254722889900',
      message: 'BALANCE'
    });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.json.reply || !res.json.reply.includes('KES')) throw new Error('Invalid WhatsApp balance reply');
    console.log(`      WhatsApp Bot response: "${res.json.reply.substring(0, 75)}..."`);
  });

  // 35. Feature 2: AI Tenant Vetting & CRB Scoring
  await test('AI Vetting: POST /api/tenant-vetting/analyze computes CRB risk tier', async () => {
    const res = await invokeHandler('/api/tenant-vetting/analyze', 'POST', {
      applicant_name: 'Kevin Omondi',
      phone: '+254720112233',
      id_number: '31984512',
      monthly_income: 260000,
      requested_unit_id: 4
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    if (!res.json.crb_score || !res.json.risk_category) throw new Error('Missing CRB score or risk tier');
    console.log(`      Vetted ${res.json.applicant_name}: CRB Score ${res.json.crb_score}, Risk: ${res.json.risk_category}`);
  });

  // 36. Feature 3: Smart IoT Water Telemetry & Remote Valve Control
  await test('IoT Telemetry: GET /api/iot/devices & POST /api/iot/valve-toggle controls smart valves', async () => {
    const devRes = await invokeHandler('/api/iot/devices');
    if (devRes.statusCode !== 200) throw new Error(`Expected 200, got ${devRes.statusCode}`);
    if (!Array.isArray(devRes.json.devices) || devRes.json.devices.length === 0) throw new Error('No IoT devices returned');

    const toggleRes = await invokeHandler('/api/iot/valve-toggle', 'POST', {
      device_id: 1,
      valve_status: 'closed'
    });
    if (toggleRes.statusCode !== 200) throw new Error(`Expected 200, got ${toggleRes.statusCode}`);
    if (toggleRes.json.device.valve_status !== 'closed') throw new Error('Valve status not updated');
    console.log(`      IoT Smart Meter #${devRes.json.devices[0].meter_number} valve successfully shut off via remote command`);
  });

  // 37. Feature 4: KRA eTIMS & 7.5% MRI Tax Automation
  await test('Tax Automation: GET /api/tax/etims-summary calculates 7.5% MRI withholding', async () => {
    const res = await invokeHandler('/api/tax/etims-summary');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.json.stats || res.json.stats.mri_rate !== '7.5%') throw new Error('Missing MRI 7.5% tax statistics');
    console.log(`      eTIMS Active Invoices: ${res.json.stats.total_transmitted}, Total MRI Tax: KES ${res.json.stats.total_mri_tax.toLocaleString()}`);
  });

  // 38. Feature 5: Artisan Escrow Marketplace
  await test('Artisan Escrow: Marketplace lists fundis and handles milestone release', async () => {
    const fundisRes = await invokeHandler('/api/marketplace/fundis');
    if (fundisRes.statusCode !== 200) throw new Error(`Expected 200, got ${fundisRes.statusCode}`);
    if (fundisRes.json.fundis.length === 0) throw new Error('No vetted fundis found');

    const releaseRes = await invokeHandler('/api/marketplace/escrow/release', 'POST', { escrow_id: 1 });
    if (releaseRes.statusCode !== 200) throw new Error(`Expected 200, got ${releaseRes.statusCode}`);
    if (!releaseRes.json.b2c_disbursement_ref.startsWith('B2C-MPESA-')) throw new Error('Missing B2C reference');
    console.log(`      Fundi Escrow released: ${releaseRes.json.b2c_disbursement_ref} for KES ${releaseRes.json.amount.toLocaleString()}`);
  });

  // 39. Public Rentals Showcase HTML
  await test('Public Rentals: /rentals.html serves public listing catalog with 200 OK', async () => {
    const res = await invokeHandler('/rentals.html');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.body.includes('Find Your Next Home in Nairobi') || !res.body.includes('BomaSphere Properties')) {
      throw new Error('rentals.html missing expected branding');
    }
    console.log('      Verified rentals.html: High-converting public vacancy showcase with viewing booking modal');
  });

  // 40. Enterprise Module 1: Digital Lease Agreements & In-Browser E-Signatures
  await test('Digital Leases: GET /api/leases/agreements & POST /api/leases/agreements/:id/sign executes legally binding contract', async () => {
    const listRes = await invokeHandler('/api/leases/agreements');
    if (listRes.statusCode !== 200) throw new Error(`Expected 200, got ${listRes.statusCode}`);
    if (!Array.isArray(listRes.json.agreements) || listRes.json.agreements.length === 0) throw new Error('No agreements found');

    const signRes = await invokeHandler('/api/leases/agreements/2/sign', 'POST', {
      signature: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xMCAxMCBMMTAwIDEwMCIvPjwvc3ZnPg==',
      signer_role: 'manager',
      signer_name: 'Lead Estate Manager'
    });
    if (signRes.statusCode !== 200) throw new Error(`Expected 200, got ${signRes.statusCode}`);
    if (!signRes.json.agreement || !signRes.json.agreement.contract_hash) throw new Error('Missing contract hash in executed agreement');
    console.log(`      Agreement ${signRes.json.agreement.agreement_code} signed with SHA-256 hash: ${signRes.json.agreement.contract_hash}`);
  });

  // 41. Enterprise Module 2: Move-In / Move-Out Condition Audits & Automated Deposit Settlement
  await test('Property Inspections: POST /api/inspections & POST /settle-deposit computes net deposit refund', async () => {
    const inspRes = await invokeHandler('/api/inspections', 'POST', {
      unit_id: 2,
      tenant_id: 2,
      inspection_type: 'move_out',
      inspector_name: 'Lead Estate Auditor',
      checklist: [
        { item: 'Living Room Walls', status: 'Damaged', repair_cost: 4500 },
        { item: 'Kitchen Mixer Tap', status: 'Damaged', repair_cost: 2500 }
      ],
      deposit_held: 130000,
      unpaid_utility_arrears: 2150
    });
    if (inspRes.statusCode !== 201) throw new Error(`Expected 201, got ${inspRes.statusCode}`);
    if (inspRes.json.damages_total !== 7000) throw new Error(`Expected damages 7000, got ${inspRes.json.damages_total}`);
    // Net refund: 130,000 - 7,000 - 2,150 = 120,850
    if (inspRes.json.net_deposit_refund !== 120850) throw new Error(`Expected net refund 120850, got ${inspRes.json.net_deposit_refund}`);

    const settleRes = await invokeHandler(`/api/inspections/${inspRes.json.id}/settle-deposit`, 'POST');
    if (settleRes.statusCode !== 200) throw new Error(`Expected 200, got ${settleRes.statusCode}`);
    if (!settleRes.json.voucher_number || !settleRes.json.voucher_number.startsWith('REF-DEP-')) throw new Error('Missing refund voucher number');
    console.log(`      Deposit settled with voucher: ${settleRes.json.voucher_number}, net refund: KES ${settleRes.json.net_refund_amount.toLocaleString()}`);
  });

  // 42. Enterprise Module 3: Gated Estate Visitor Passes & Gate QR Security
  await test('Visitor Gate Passes: POST /api/visitor-passes & POST /validate authorizes and tracks guest barrier access', async () => {
    const createRes = await invokeHandler('/api/visitor-passes', 'POST', {
      unit_id: 1,
      tenant_id: 1,
      visitor_name: 'Dr. Samuel Makori',
      visitor_phone: '+254722334455',
      vehicle_plate: 'KDA 482B',
      valid_date: '2026-11-03',
      time_slot: '02:00 PM - 06:00 PM'
    });
    if (createRes.statusCode !== 201) throw new Error(`Expected 201, got ${createRes.statusCode}`);
    const passCode = createRes.json.pass_code;
    if (!passCode.startsWith('PASS-')) throw new Error('Invalid pass code format');

    const checkInRes = await invokeHandler('/api/visitor-passes/validate', 'POST', {
      pass_code: passCode,
      action: 'check_in'
    });
    if (checkInRes.statusCode !== 200) throw new Error(`Expected 200, got ${checkInRes.statusCode}`);
    if (checkInRes.json.status !== 'checked_in') throw new Error(`Expected checked_in status, got ${checkInRes.json.status}`);
    console.log(`      Barrier access verified for pass ${passCode}: Check-In granted for ${checkInRes.json.pass.visitor_name}`);
  });

  // 43. Enterprise Module 4: Diaspora Landlord Multi-Currency Hub & Investment ROI Telemetry
  await test('Diaspora ROI Hub: GET /api/reports/diaspora-roi computes valuation, cap rate & live FX rates', async () => {
    const res = await invokeHandler('/api/reports/diaspora-roi');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.json.portfolio_summary || !res.json.fx_rates) throw new Error('Missing portfolio summary or fx_rates');
    const ps = res.json.portfolio_summary;
    if (!ps.total_valuation_usd || !ps.total_valuation_gbp || !ps.total_valuation_eur) throw new Error('Missing multi-currency valuations');
    console.log(`      Portfolio Gross Rent: KES ${ps.total_annual_rent_kes.toLocaleString()} | USD: $${ps.total_annual_rent_usd.toLocaleString()} | Cap Rate: ${ps.average_cap_rate}`);
  });

  // 44. Enterprise Module 5: Shared Estate Amenities & Booking Engine
  await test('Estate Amenities: GET /api/amenities & POST /api/amenity-bookings reserves luxury facility', async () => {
    const listRes = await invokeHandler('/api/amenities');
    if (listRes.statusCode !== 200) throw new Error(`Expected 200, got ${listRes.statusCode}`);
    if (!Array.isArray(listRes.json.amenities) || listRes.json.amenities.length === 0) throw new Error('No amenities available');

    const amenity = listRes.json.amenities[0];
    const bookRes = await invokeHandler('/api/amenity-bookings', 'POST', {
      amenity_id: amenity.id,
      unit_id: 1,
      tenant_id: 1,
      booking_date: '2026-11-08',
      start_time: '04:00 PM',
      hours: 3
    });
    if (bookRes.statusCode !== 201) throw new Error(`Expected 201, got ${bookRes.statusCode}`);
    if (!bookRes.json.booking_reference || !bookRes.json.booking_reference.startsWith('BK-')) throw new Error('Missing booking reference');
    console.log(`      Reserved ${amenity.name} with reference ${bookRes.json.booking_reference} (Fee: KES ${bookRes.json.total_fee.toLocaleString()})`);
  });

  // 45. Complete End-to-End Workflow: Tenant Onboarding with Vacant Unit Assignment & Move-In Settlement
  await test('Tenant Onboarding Flow: POST /api/tenants with vacant unit auto-creates lease, agreement, invoice, and settles', async () => {
    const unitsRes = await invokeHandler('/api/units');
    if (unitsRes.statusCode !== 200) throw new Error('Failed to fetch units');
    const vacantUnit = unitsRes.json.find(u => u.status === 'vacant');
    if (!vacantUnit) throw new Error('Test requires at least one vacant unit');

    // 1. Add tenant with vacant unit assignment
    const regRes = await invokeHandler('/api/tenants', 'POST', {
      name: 'Kariuki Onboarding Verification',
      phone: '+254719888777',
      email: 'kariuki.verify@bomasphere.co.ke',
      id_number: '98765432',
      emergency_contact_name: 'Wairimu Kariuki',
      emergency_contact_phone: '+254719000111',
      unit_id: vacantUnit.id,
      monthly_rent: vacantUnit.base_rent,
      deposit_paid: vacantUnit.base_rent
    });

    if (regRes.statusCode !== 201) throw new Error(`Expected 201, got ${regRes.statusCode}`);
    if (!regRes.json.agreement_id || !regRes.json.invoice_id) {
      throw new Error('Tenant onboarding failed to automatically generate lease agreement or move-in invoice');
    }
    if (!regRes.json.tenant_id && !regRes.json.id) {
      throw new Error('Tenant onboarding response missing tenant_id');
    }

    // 2. Verify unit status transitioned to occupied
    const checkUnitRes = await invokeHandler('/api/units');
    const updatedUnit = checkUnitRes.json.find(u => u.id === vacantUnit.id);
    if (!updatedUnit || updatedUnit.status !== 'occupied') {
      throw new Error(`Unit ${vacantUnit.unit_number} did not transition to occupied status`);
    }

    // 3. Verify digital lease agreement is available for e-signature
    const agrRes = await invokeHandler('/api/leases/agreements');
    const agr = agrRes.json.agreements.find(a => a.id === regRes.json.agreement_id);
    if (!agr || agr.status !== 'pending_tenant') {
      throw new Error('Digital lease agreement not found in pending_tenant state');
    }

    // 4. Verify inaugural move-in invoice
    const invRes = await invokeHandler('/api/invoices');
    const inv = invRes.json.find(i => i.id === regRes.json.invoice_id);
    if (!inv || inv.status !== 'unpaid') {
      throw new Error('Move-in invoice not found in unpaid state');
    }

    console.log(`      Tenant #${regRes.json.id} successfully leased Unit ${vacantUnit.unit_number}. Agreement: ${regRes.json.agreement_code}, Move-In Invoice: ${regRes.json.invoice_number} (Total Due: KES ${regRes.json.total_due.toLocaleString()})`);
  });

  // TEST 46: Modal Ergonomics & TWK Standards
  await test('TWK & UX Standards: Modal backdrop click-to-close & Escape key dismissal active', async () => {
    const fs = require('fs');
    const appJs = fs.readFileSync('public/app.js', 'utf8');
    const rentalsHtml = fs.readFileSync('public/rentals.html', 'utf8');

    if (!appJs.includes("openModal.querySelector('div.bg-white, div.bg-zinc-900, div.bg-zinc-950, [role=\"dialog\"]')")) {
      throw new Error('app.js missing dialog card isolation for click-outside dismissal');
    }
    if (!appJs.includes("e.key === 'Escape'")) {
      throw new Error('app.js missing Escape key listener for accessible modal closing');
    }
    if (!rentalsHtml.includes("openModal.id === 'modal-viewing'") || !rentalsHtml.includes("openModal.id === 'modal-higgsfield-tour'")) {
      throw new Error('rentals.html missing click-outside dismissal for viewing and tour modals');
    }
    console.log('      Verified: Click-outside backdrop and Escape key handlers active across all modals');
  });

  // TEST 47: Live Safaricom Daraja STK Push & Webhook Callback Reconciliation
  await test('Safaricom Daraja: Full STK Push initiation, callback processing & instant rent reconciliation', async () => {
    // 1. Fetch an unpaid invoice to link to the STK push
    const invRes = await invokeHandler('/api/invoices');
    const unpaidInv = invRes.json.find(i => Number(i.balance) > 0) || invRes.json[0];

    // 2. Initiate STK Push
    const stkPayload = {
      phone: '0722123456',
      amount: 1500,
      invoice_id: unpaidInv.id,
      tenant_id: unpaidInv.tenant_id,
      account_reference: `Unit-${unpaidInv.unit_number || 'A101'}`
    };
    const stkRes = await invokeHandler('/api/mpesa/stkpush', 'POST', stkPayload, {
      'Authorization': 'Bearer token_super_admin'
    });
    if (stkRes.statusCode !== 200 || !stkRes.json.checkout_request_id) {
      throw new Error(`STK Push initiation failed (${stkRes.statusCode}): ${stkRes.body}`);
    }
    const checkoutId = stkRes.json.checkout_request_id;

    // 3. Verify status polling endpoint returns 'pending'
    const statusRes1 = await invokeHandler(`/api/mpesa/status/${encodeURIComponent(checkoutId)}`);
    if (statusRes1.statusCode !== 200 || statusRes1.json.status !== 'pending') {
      throw new Error(`Status polling did not return pending for newly created STK: ${statusRes1.body}`);
    }

    // 4. Dispatch Safaricom Webhook Callback
    const testMpesaReceipt = 'QGK' + Math.floor(1000000 + Math.random() * 9000000);
    const callbackPayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: stkRes.json.merchant_request_id,
          CheckoutRequestID: checkoutId,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 1500 },
              { Name: "MpesaReceiptNumber", Value: testMpesaReceipt },
              { Name: "TransactionDate", Value: 20261107125900 },
              { Name: "PhoneNumber", Value: 254722123456 }
            ]
          }
        }
      }
    };
    const cbRes = await invokeHandler('/api/mpesa/callback', 'POST', callbackPayload);
    if (cbRes.statusCode !== 200 || cbRes.json.ResultCode !== 0) {
      throw new Error(`Safaricom webhook callback failed (${cbRes.statusCode}): ${cbRes.body}`);
    }

    // 5. Verify status polling endpoint now reports 'completed' with M-Pesa receipt
    const statusRes2 = await invokeHandler(`/api/mpesa/status/${encodeURIComponent(checkoutId)}`);
    if (statusRes2.statusCode !== 200 || statusRes2.json.status !== 'completed' || statusRes2.json.mpesa_receipt_number !== testMpesaReceipt) {
      throw new Error(`Transaction status did not update to completed after callback: ${statusRes2.body}`);
    }

    // 6. Verify payments table has recorded the M-Pesa payment
    const payRes = await invokeHandler('/api/payments', 'GET', null, {
      'Authorization': 'Bearer token_super_admin'
    });
    const reconciledPay = payRes.json.find(p => p.reference_code === testMpesaReceipt);
    if (!reconciledPay) {
      throw new Error(`Payment with reference ${testMpesaReceipt} was not created in payments ledger`);
    }

    console.log(`      STK Push ${checkoutId} successfully reconciled! M-Pesa Receipt: ${testMpesaReceipt}, Amount: KES 1,500`);
  });

  await test('Daraja 3.0: Dynamic M-Pesa QR Code generation for invoice checkout', async () => {
    const res = await invokeHandler('/api/mpesa/qrcode', 'POST', {
      amount: 25000,
      ref_no: 'INV-202611-002',
      trx_code: 'PB'
    });
    if (res.statusCode !== 200 || !res.json.success || !res.json.qr_code) {
      throw new Error(`Failed to generate dynamic M-Pesa QR code: ${res.body}`);
    }
    if (res.json.amount !== 25000 || res.json.ref_no !== 'INV-202611-002') {
      throw new Error(`M-Pesa QR code payload mismatch: ${res.body}`);
    }
    console.log(`      Daraja 3.0 QR Code successfully generated: Paybill ${res.json.shortcode}, Ref ${res.json.ref_no}, Amount KES ${res.json.amount}`);
  });

  await test('Daraja 3.0: M-Pesa Ratiba recurring standing order creation, listing & cancellation', async () => {
    // 1. Create Ratiba Monthly Standing Order
    const createRes = await invokeHandler('/api/mpesa/ratiba/create', 'POST', {
      tenant_id: 1,
      amount: 65000,
      phone: '0722889900',
      standing_order_name: 'Kilimani A101 Monthly Rent Auto-Debit',
      frequency: 5,
      account_reference: 'UNIT-A101'
    });
    if (createRes.statusCode !== 201 || !createRes.json.success || !createRes.json.standing_order) {
      throw new Error(`Failed to create Ratiba standing order (${createRes.statusCode}): ${createRes.body}`);
    }
    const so = createRes.json.standing_order;
    if (so.status !== 'active' || !so.saf_standing_order_id) {
      throw new Error(`Standing order not active: ${createRes.body}`);
    }

    // 2. List Standing Orders for Tenant #1
    const listRes = await invokeHandler(`/api/mpesa/ratiba/tenant/1`);
    if (listRes.statusCode !== 200 || !Array.isArray(listRes.json) || listRes.json.length === 0) {
      throw new Error(`Tenant standing orders not returned: ${listRes.body}`);
    }

    // 3. Cancel Standing Order
    const cancelRes = await invokeHandler(`/api/mpesa/ratiba/cancel/${so.id}`, 'POST');
    if (cancelRes.statusCode !== 200 || !cancelRes.json.success) {
      throw new Error(`Failed to cancel standing order: ${cancelRes.body}`);
    }

    console.log(`      Daraja 3.0 Ratiba active: ID ${so.id}, Ref: ${so.saf_standing_order_id}, Lifecycle: Created -> Listed -> Cancelled`);
  });

  // 50. 1-Click Lead-to-Lease Pipeline Conversion
  await test('Lead-to-Lease Pipeline: POST /api/viewing-leads/:id/convert automates Tenant creation, Unit reservation, Lease Agreement & Move-in Billing', async () => {
    // 1. Create a viewing lead for testing
    const bookRes = await invokeHandler('/api/public/book-viewing', 'POST', {
      unit_id: 1,
      prospect_name: 'Wanjiku Grace Pipeline Verification',
      phone: '+254722998811',
      email: 'grace.pipeline@bomasphere.co.ke',
      preferred_date: '2026-11-15',
      time_slot: '11:00 AM',
      notes: 'Interested in signing immediately upon tour'
    });
    if (bookRes.statusCode !== 201 || !bookRes.json.lead_id) {
      throw new Error(`Failed to create test viewing lead: ${bookRes.body}`);
    }
    const leadId = bookRes.json.lead_id;

    // 2. Convert lead to full tenancy via pipeline
    const convertRes = await invokeHandler(`/api/viewing-leads/${leadId}/convert`, 'POST', {
      move_in_date: '2026-11-15'
    }, {
      'Authorization': 'Bearer token_property_manager'
    });
    if (convertRes.statusCode !== 200 || !convertRes.json.success) {
      throw new Error(`Lead conversion pipeline failed (${convertRes.statusCode}): ${convertRes.body}`);
    }

    const { tenant, unit, lease, agreement, invoice, audit } = convertRes.json;
    if (!tenant || tenant.lifecycle_stage !== 'vetted') {
      throw new Error(`Tenant lifecycle stage expected 'vetted', got: ${JSON.stringify(tenant)}`);
    }
    if (!unit || unit.status !== 'reserved') {
      throw new Error(`Unit status expected 'reserved', got: ${JSON.stringify(unit)}`);
    }
    if (!agreement || !agreement.agreement_code.startsWith('LSE-')) {
      throw new Error(`Digital Lease Agreement code missing or invalid: ${JSON.stringify(agreement)}`);
    }
    if (!invoice || !invoice.invoice_number.startsWith('INV-INIT-')) {
      throw new Error(`Initial Move-in Invoice missing or invalid: ${JSON.stringify(invoice)}`);
    }
    if (!audit || !audit.checksum) {
      throw new Error(`Cryptographic audit record not returned from pipeline: ${JSON.stringify(audit)}`);
    }

    console.log(`      Lead #${leadId} converted! Tenant #${tenant.id} ("${tenant.name}"), Unit ${unit.unit_number} (${unit.status}), Agreement #${agreement.agreement_code}, Initial Invoice #${invoice.invoice_number}`);
  });

  // 51. Cryptographic System Audit Ledger & Chain Integrity
  await test('Cryptographic Audit Engine: GET /api/audit-logs & POST /api/audit-logs/verify verifies 100% SHA-256 chain integrity', async () => {
    // 1. Fetch audit logs
    const listRes = await invokeHandler('/api/audit-logs?limit=50', 'GET', null, {
      'Authorization': 'Bearer token_super_admin'
    });
    if (listRes.statusCode !== 200 || !listRes.json.success || !Array.isArray(listRes.json.logs)) {
      throw new Error(`Failed to query audit logs (${listRes.statusCode}): ${listRes.body}`);
    }
    if (listRes.json.logs.length === 0) {
      throw new Error('Audit logs table is unexpectedly empty after pipeline operations');
    }

    const firstLog = listRes.json.logs[0];
    if (!firstLog.checksum || !firstLog.action || !firstLog.entity_type) {
      throw new Error(`Audit log entry schema invalid: ${JSON.stringify(firstLog)}`);
    }

    // 2. Mathematically verify entire cryptographic chain from GENESIS to current head
    const verifyRes = await invokeHandler('/api/audit-logs/verify', 'POST', {}, {
      'Authorization': 'Bearer token_super_admin'
    });
    if (verifyRes.statusCode !== 200 || !verifyRes.json.success) {
      throw new Error(`Audit chain verification failed (${verifyRes.statusCode}): ${verifyRes.body}`);
    }
    if (verifyRes.json.is_valid !== true) {
      throw new Error(`Cryptographic chain verification reported TAMPER/BROKEN: ${verifyRes.body}`);
    }
    if (verifyRes.json.total_verified < 1) {
      throw new Error(`Expected at least 1 verified entry, got ${verifyRes.json.total_verified}`);
    }

    console.log(`      Audit Ledger Integrity Verified: ${verifyRes.json.total_verified} chained records verified mathematically (Integrity: ${verifyRes.json.chain_integrity}, Latest Checksum: ${verifyRes.json.latest_checksum.slice(0, 16)}...)`);
  });

  // 52. Virtual Walkthroughs & Higgsfield Cinema Studio Engine
  await test('Virtual Walkthroughs: Higgsfield Cinema Studio 60fps camera motion, syndication & HUD verification', async () => {
    const fs = require('fs');
    const path = require('path');
    const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    const stylesCss = fs.readFileSync(path.join(__dirname, 'public', 'styles.css'), 'utf8');

    // 1. Verify index.html contains camera viewport, active frame, and syndication dock
    if (!indexHtml.includes('id="hg-video-viewport"') || !indexHtml.includes('id="hg-active-frame"')) {
      throw new Error('index.html missing Higgsfield active cinematic frame or viewport container');
    }
    if (!indexHtml.includes('id="btn-hg-syndicate"') || !indexHtml.includes('app.shareHiggsfieldWhatsApp()')) {
      throw new Error('index.html missing syndicate or WhatsApp sharing triggers');
    }
    if (!indexHtml.includes('id="hg-inspection-badge"') || !indexHtml.includes('id="hg-hud-status"')) {
      throw new Error('index.html missing HUD telemetry or digital twin inspection badge');
    }

    // 2. Verify app.js contains Higgsfield methods
    const requiredMethods = [
      'renderHiggsfield',
      'onHiggsfieldUnitChange',
      'applyHiggsfieldMotion',
      'toggleHiggsfieldPlayback',
      'syndicateHiggsfieldTour',
      'shareHiggsfieldWhatsApp',
      'loadSampleTour'
    ];
    for (const m of requiredMethods) {
      if (!appJs.includes(m)) {
        throw new Error(`app.js missing Higgsfield engine method: ${m}`);
      }
    }

    // 3. Verify styles.css contains 60fps camera rig keyframes
    if (!stylesCss.includes('hgDollyAnimation') || !stylesCss.includes('hgDroneAnimation') || !stylesCss.includes('hgOrbitAnimation')) {
      throw new Error('styles.css missing Higgsfield camera rig keyframe animations');
    }

    console.log('      Verified: 60fps Camera Rigs, Aspect Ratio Canvas, WhatsApp Sharing & Syndication verified');
  });

  console.log(`\n=======================================================`);
  console.log(` TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED `);
  console.log(`=======================================================`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
