const fs = require('fs');

let s = fs.readFileSync('server.js', 'utf8');
const isCRLF = s.includes('\r\n');
s = s.replace(/\r\n/g, '\n');

// 1. Properties validation
const propTarget = `if (pathname === '/api/properties' && method === 'POST') {
      const b = await parseBody(req);`;
const propReplacement = `if (pathname === '/api/properties' && method === 'POST') {
      const b = await parseBody(req);
      if (!b.name) {
        return sendJSON(res, 400, { error: 'Property name is required.' });
      }`;

if (s.includes(propTarget)) {
  s = s.replace(propTarget, propReplacement);
  console.log('Patched POST /api/properties validation');
}

// 2. Units validation
const unitTarget = `if (pathname === '/api/units' && method === 'POST') {
      const b = await parseBody(req);`;
const unitReplacement = `if (pathname === '/api/units' && method === 'POST') {
      const b = await parseBody(req);
      if (!b.property_id || !b.unit_number || b.base_rent === undefined) {
        return sendJSON(res, 400, { error: 'Property ID, unit number, and base rent are required.' });
      }`;

if (s.includes(unitTarget)) {
  s = s.replace(unitTarget, unitReplacement);
  console.log('Patched POST /api/units validation');
}

// 3. Users validation
const userTarget = `const b = await parseBody(req);
      const passwordHash = hashPassword(b.password || 'password123');`;
const userReplacement = `const b = await parseBody(req);
      if (!b.name || !b.email) {
        return sendJSON(res, 400, { error: 'Name and email are required to provision a user.' });
      }
      const passwordHash = hashPassword(b.password || 'password123');`;

if (s.includes(userTarget)) {
  s = s.replace(userTarget, userReplacement);
  console.log('Patched POST /api/users validation');
}

// 4. Remove occupied fallback in /api/public/vacancies
const vacFallbackTarget = `      // Graceful fallback if portfolio is 100% occupied
      if (vacancies.length === 0) {
        vacancies = db.prepare(\`
          SELECT 
            u.id, u.unit_number, u.floor, u.unit_type, u.base_rent, u.service_charge, u.garbage_fee,
            u.status, u.notes,
            p.id as property_id, p.name as property_name, p.property_type, p.address, p.city
          FROM units u
          JOIN properties p ON u.property_id = p.id
          ORDER BY u.id DESC
          LIMIT 2
        \`).all();
      }`;

const vacFallbackReplacement = `      // Portfolio vacancies: return truly vacant units only`;

if (s.includes(vacFallbackTarget)) {
  s = s.replace(vacFallbackTarget, vacFallbackReplacement);
  console.log('Removed occupied fallback from /api/public/vacancies');
}

// 5. Vacate unit on move_out settle-deposit
const settleTarget = `      const refundVoucher = 'REF-DEP-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      db.prepare(\`
        UPDATE property_inspections 
        SET status = 'settled', damages_total = ?, unpaid_utility_arrears = ?, net_deposit_refund = ? 
        WHERE id = ?
      \`).run(deductionsDamages, deductionsArrears, netRefund, inspection.id);`;

const settleReplacement = `      const refundVoucher = 'REF-DEP-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      db.prepare(\`
        UPDATE property_inspections 
        SET status = 'settled', damages_total = ?, unpaid_utility_arrears = ?, net_deposit_refund = ? 
        WHERE id = ?
      \`).run(deductionsDamages, deductionsArrears, netRefund, inspection.id);

      if (inspection.inspection_type === 'move_out' && inspection.unit_id) {
        db.prepare("UPDATE units SET status = 'vacant' WHERE id = ?").run(inspection.unit_id);
        db.prepare("UPDATE leases SET status = 'completed' WHERE unit_id = ? AND status = 'active'").run(inspection.unit_id);
        db.prepare("UPDATE lease_agreements SET status = 'completed' WHERE unit_id = ? AND status = 'executed'").run(inspection.unit_id);
      }`;

if (s.includes(settleTarget)) {
  s = s.replace(settleTarget, settleReplacement);
  console.log('Patched settle-deposit to vacate unit on move_out');
}

// 6. Invoicing validation for tenantId and unitId
const invTarget = `      // Safe relational fallbacks to prevent SQLite bind errors
      if (!leaseId) {
        const firstLease = db.prepare('SELECT id, tenant_id, unit_id, monthly_rent FROM leases ORDER BY id ASC LIMIT 1').get();
        if (firstLease) {
          leaseId = firstLease.id;
          if (!tenantId) tenantId = firstLease.tenant_id;
          if (!unitId) unitId = firstLease.unit_id;
          if (!rent) rent = Number(firstLease.monthly_rent || 0);
        }
      }
      if (!tenantId) tenantId = 1;
      if (!unitId) unitId = 1;`;

const invReplacement = `      if (!tenantId || !unitId) {
        return sendJSON(res, 400, { error: 'Valid tenant_id and unit_id are required to generate an invoice.' });
      }`;

if (s.includes(invTarget)) {
  s = s.replace(invTarget, invReplacement);
  console.log('Patched POST /api/invoices validation');
}

if (isCRLF) {
  s = s.replace(/\n/g, '\r\n');
}

fs.writeFileSync('server.js', s, 'utf8');
console.log('Successfully written server.js');
