const fs = require('fs');

let c = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');
// Normalize CRLF to LF for matching
const isCRLF = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');

// 1. Add security headers to corsHeaders
const oldCors = `  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token, X-Role'
  };`;

const newCors = `  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token, X-Role',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://cdn.tailwindcss.com;"
  };`;

if (!c.includes(oldCors)) {
  console.error('oldCors not found');
  process.exit(1);
}
c = c.replace(oldCors, newCors);

// 2. Remove dead duplicate routes at the bottom
const dupStart = `  // 24. Public Vacancies & Viewing Bookings\n  if (pathname === '/api/public/vacancies' && method === 'GET') {`;
const dupEnd = `    return json({\n      success: true,\n      booking_reference: ref,\n      reference: ref,\n      message: \`Physical viewing appointment confirmed under reference \${ref}. An estate agent will meet you at the property on \${b.preferred_date || 'the requested date'}.\`\n    }, 201);\n  }`;

if (c.includes(dupStart) && c.includes(dupEnd)) {
  const dupIdx1 = c.indexOf(dupStart);
  const dupIdx2 = c.indexOf(dupEnd) + dupEnd.length;
  c = c.substring(0, dupIdx1) + c.substring(dupIdx2);
  console.log('Removed dead duplicate routes');
} else {
  console.log('Duplicate routes already removed or not found');
}

// 3. Add POST /api/leases/agreements in Section 18
const oldSignBlock = `  if (pathname.startsWith('/api/leases/agreements/') && pathname.endsWith('/sign') && method === 'POST') {
    const id = Number(pathname.split('/')[4]);
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const agr = DB.leaseAgreements.find(a => a.id === id) || DB.leaseAgreements[0];
    agr.status = 'executed';
    agr.tenant_signature = b.signature || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50"><path d="M10 35 Q50 10 90 35 T170 30" stroke="%23059669" stroke-width="2" fill="none"/></svg>';
    agr.tenant_signed_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return json({ success: true, agreement: agr, is_executed: true, message: \`Lease \${agr.agreement_code} signed and legally executed!\` });
  }`;

const newSignAndPostBlock = `  if (pathname.startsWith('/api/leases/agreements/') && pathname.endsWith('/sign') && method === 'POST') {
    const id = Number(pathname.split('/')[4]);
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const agr = DB.leaseAgreements.find(a => a.id === id);
    if (!agr) {
      return json({ error: 'Lease agreement record not found.' }, 404);
    }
    agr.status = 'executed';
    agr.tenant_signature = b.signature || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50"><path d="M10 35 Q50 10 90 35 T170 30" stroke="%23059669" stroke-width="2" fill="none"/></svg>';
    agr.tenant_signed_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return json({ success: true, agreement: agr, is_executed: true, message: \`Lease \${agr.agreement_code} signed and legally executed!\` });
  }

  if (pathname === '/api/leases/agreements' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const { lease_id, unit_id, tenant_id, rent_amount, deposit_amount, start_date, end_date, terms_clauses } = b;
    if (!unit_id || !tenant_id || !rent_amount) {
      return json({ error: 'Unit ID, Tenant ID, and Rent Amount are required.' }, 400);
    }

    const unit = DB.units.find(u => u.id === Number(unit_id));
    const tenant = DB.tenants.find(t => t.id === Number(tenant_id));
    const prop = unit ? DB.properties.find(p => p.id === unit.property_id) : null;
    const code = \`BS-LEASE-2026-\${(unit?.unit_number || Math.floor(100+Math.random()*900)).toString().replace(/[^a-zA-Z0-9]/g, '')}-\${Math.random().toString(36).substring(2, 6).toUpperCase()}\`;
    const hash = 'SHA256-' + Math.random().toString(36).substring(2, 14).toUpperCase();

    const newAgr = {
      id: DB.leaseAgreements.length ? Math.max(...DB.leaseAgreements.map(a => a.id)) + 1 : 1,
      lease_id: lease_id || 1,
      unit_id: Number(unit_id),
      tenant_id: Number(tenant_id),
      agreement_code: code,
      unit_number: unit?.unit_number || 'A101',
      property_name: prop?.name || 'BomaSphere Property',
      tenant_name: tenant?.name || 'Resident',
      tenant_phone: tenant?.phone || '',
      rent_amount: Number(rent_amount),
      deposit_amount: deposit_amount ? Number(deposit_amount) : Number(rent_amount),
      start_date: start_date || '2026-11-01',
      end_date: end_date || '2027-10-31',
      terms_clauses: terms_clauses || 'Standard 1-year tenancy agreement',
      status: 'pending_tenant',
      contract_hash: hash,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    DB.leaseAgreements.unshift(newAgr);
    return json({ success: true, id: newAgr.id, agreement_code: code }, 201);
  }`;

if (c.includes(oldSignBlock)) {
  c = c.replace(oldSignBlock, newSignAndPostBlock);
  console.log('Updated lease sign and added POST /api/leases/agreements');
}

// 4. Align Lease termination endpoint in catchall.js
const oldLeasePut = `  if (pathname.startsWith('/api/leases/') && method === 'PUT') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Modifying lease agreements requires Property Manager or Admin privileges.' }, 403);
    }
    const id = Number(pathname.split('/')[3]);
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const lease = DB.leaseAgreements.find(l => l.id === id);
    if (!lease) return json({ error: 'Lease agreement not found' }, 404);

    if (b.status) lease.status = b.status;
    return json({ success: true, lease });
  }`;

const newLeasePut = `  if (pathname.startsWith('/api/leases/') && method === 'PUT') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Modifying lease agreements requires Property Manager or Admin privileges.' }, 403);
    }
    const id = Number(pathname.split('/')[3]);
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const lease = DB.leaseAgreements.find(l => l.id === id || l.lease_id === id);
    if (!lease) return json({ error: 'Lease agreement not found' }, 404);

    const isTerminate = pathname.endsWith('/terminate') || b.status === 'terminated';
    if (isTerminate) {
      lease.status = 'terminated';
      const unit = DB.units.find(u => u.id === lease.unit_id);
      if (unit) unit.status = 'vacant';
    } else if (b.status) {
      lease.status = b.status;
    }
    return json({ success: true, lease });
  }`;

if (c.includes(oldLeasePut)) {
  c = c.replace(oldLeasePut, newLeasePut);
  console.log('Updated lease termination handler');
}

// 5. Update broadcast communications with RBAC and body parsing
const oldBroadcast = `  if (pathname === '/api/communications/broadcast' && method === 'POST') {
    return json({ success: true, count: 8, recipients_reached: 8, recipient_count: 8 });
  }`;

const newBroadcast = `  if (pathname === '/api/communications/broadcast' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (!user) {
      return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
    }
    if (user.role === 'caretaker' || user.role === 'tenant' || user.role === 'landlord') {
      return json({ error: '403 Forbidden: Mass communications can only be broadcast by Property Managers and Super Admins.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const { channel, message, property_id, purpose } = b;
    if (!message) {
      return json({ error: 'Broadcast message content cannot be empty.' }, 400);
    }
    const recipients = property_id 
      ? DB.tenants.filter(t => t.property_id === Number(property_id))
      : DB.tenants;
    
    recipients.forEach(t => {
      DB.communications.unshift({
        id: DB.communications.length + 1,
        tenant_id: t.id,
        recipient_name: t.name,
        recipient_phone: t.phone,
        type: channel || 'sms',
        message: message,
        purpose: purpose || 'announcement',
        status: 'delivered',
        sent_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
      });
    });

    return json({
      success: true,
      channel: channel || 'sms',
      recipient_count: recipients.length,
      recipients_reached: recipients.length,
      message: \`Broadcast successfully dispatched to \${recipients.length} tenants.\`
    });
  }`;

if (c.includes(oldBroadcast)) {
  c = c.replace(oldBroadcast, newBroadcast);
  console.log('Updated communications broadcast');
}

// 6. Clean up visitorPasses || DB.visitorPasses[0] anti-pattern
c = c.replace(
  'const pass = DB.visitorPasses.find(p => p.pass_code === b.pass_code) || DB.visitorPasses[0];',
  `const pass = DB.visitorPasses.find(p => p.pass_code === b.pass_code);
    if (!pass) return json({ error: 'Visitor pass not found or invalid' }, 404);`
);

// 7. Clean up iotDevices || DB.iotDevices[0] anti-pattern
c = c.replace(
  'const dev = DB.iotDevices.find(d => d.id === Number(b.device_id)) || DB.iotDevices[0];',
  `const dev = DB.iotDevices.find(d => d.id === Number(b.device_id));
    if (!dev) return json({ error: 'IoT device not found' }, 404);`
);

// 8. Clean up landlord-statement prop fallback
c = c.replace(
  'const prop = DB.properties.find(p => p.id === propId) || DB.properties[0];',
  `const prop = DB.properties.find(p => p.id === propId);
    if (!prop) return json({ error: 'Property not found' }, 404);`
);

// 9. Fix settle-deposit inspection in catchall.js to mark unit vacant on move_out
const oldInspSettle = `  if (pathname.startsWith('/api/inspections/') && pathname.endsWith('/settle-deposit') && method === 'POST') {
    const id = Number(pathname.split('/')[3]);
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const insp = DB.inspections.find(i => i.id === id) || DB.inspections[0];
    insp.status = 'settled';
    return json({
      success: true,
      voucher_number: 'REF-DEP-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      net_refund: b.net_refund || 120850
    });
  }`;

const newInspSettle = `  if (pathname.startsWith('/api/inspections/') && pathname.endsWith('/settle-deposit') && method === 'POST') {
    const id = Number(pathname.split('/')[3]);
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const insp = DB.inspections.find(i => i.id === id);
    if (!insp) return json({ error: 'Inspection report not found.' }, 404);
    insp.status = 'settled';
    if (insp.inspection_type === 'move_out') {
      const unit = DB.units.find(u => u.id === insp.unit_id);
      if (unit) unit.status = 'vacant';
      const lease = DB.leaseAgreements.find(l => l.unit_id === insp.unit_id && l.status !== 'terminated');
      if (lease) lease.status = 'completed';
    }
    return json({
      success: true,
      voucher_number: 'REF-DEP-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      net_refund: b.net_refund || 120850
    });
  }`;

if (c.includes(oldInspSettle)) {
  c = c.replace(oldInspSettle, newInspSettle);
  console.log('Updated inspection settle-deposit');
}

// Convert back to CRLF if file was CRLF
if (isCRLF) {
  c = c.replace(/\n/g, '\r\n');
}

fs.writeFileSync('functions/api/[[catchall]].js', c, 'utf8');
console.log('Successfully written functions/api/[[catchall]].js');
