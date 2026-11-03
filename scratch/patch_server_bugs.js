const fs = require('fs');

let s = fs.readFileSync('server.js', 'utf8');
const isCRLF = s.includes('\r\n');
s = s.replace(/\r\n/g, '\n');

// 1. Update CSP in server.js
const oldCSP = `'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com",`;
const newCSP = `'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://cdn.tailwindcss.com",`;

if (s.includes(oldCSP)) {
  s = s.replace(oldCSP, newCSP);
  console.log('Updated CSP in server.js');
}

// 2. Fix POST /api/properties validation & binding
const oldPostProp = `    if (pathname === '/api/properties' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
        return sendJSON(res, 403, { error: '403 Forbidden: Adding real estate properties requires Property Manager or Admin privileges.' });
      }
      const b = await parseBody(req);
      const stmt = db.prepare(\`
        INSERT INTO properties (name, property_type, address, city, landlord_name, landlord_phone, landlord_email, management_fee_pct, paybill_number, bank_name, bank_account)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      \`);
      const info = stmt.run(b.name, b.property_type, b.address, b.city, b.landlord_name, b.landlord_phone, b.landlord_email, b.management_fee_pct || 8.5, b.paybill_number, b.bank_name, b.bank_account);
      sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
    }`;

const newPostProp = `    if (pathname === '/api/properties' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
        return sendJSON(res, 403, { error: '403 Forbidden: Adding real estate properties requires Property Manager or Admin privileges.' });
      }
      const b = await parseBody(req);
      if (!b.name) {
        return sendJSON(res, 400, { error: 'Property name is required.' });
      }
      const stmt = db.prepare(\`
        INSERT INTO properties (name, property_type, address, city, landlord_name, landlord_phone, landlord_email, management_fee_pct, paybill_number, bank_name, bank_account)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      \`);
      const info = stmt.run(
        b.name,
        b.property_type ?? 'Residential Apartments',
        b.address ?? 'Nairobi',
        b.city ?? 'Nairobi',
        b.landlord_name ?? null,
        b.landlord_phone ?? null,
        b.landlord_email ?? null,
        b.management_fee_pct ? Number(b.management_fee_pct) : 8.5,
        b.paybill_number ?? null,
        b.bank_name ?? null,
        b.bank_account ?? null
      );
      sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
    }`;

if (s.includes(oldPostProp)) {
  s = s.replace(oldPostProp, newPostProp);
  console.log('Updated POST /api/properties validation');
}

// 3. Fix POST /api/units validation & binding
const oldPostUnits = `    if (pathname === '/api/units' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
        return sendJSON(res, 403, { error: '403 Forbidden: Adding units requires Property Manager or Admin privileges.' });
      }
      const b = await parseBody(req);
      const stmt = db.prepare(\`
        INSERT INTO units (property_id, unit_number, floor, unit_type, base_rent, service_charge, garbage_fee, meter_number, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      \`);
      const info = stmt.run(b.property_id, b.unit_number, b.floor, b.unit_type, b.base_rent, b.service_charge || 0, b.garbage_fee || 0, b.meter_number, b.status || 'vacant', b.notes || '');
      sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
    }`;

const newPostUnits = `    if (pathname === '/api/units' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
        return sendJSON(res, 403, { error: '403 Forbidden: Adding units requires Property Manager or Admin privileges.' });
      }
      const b = await parseBody(req);
      if (!b.property_id || !b.unit_number || b.base_rent === undefined) {
        return sendJSON(res, 400, { error: 'Property ID, unit number, and base rent are required.' });
      }
      const stmt = db.prepare(\`
        INSERT INTO units (property_id, unit_number, floor, unit_type, base_rent, service_charge, garbage_fee, meter_number, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      \`);
      const info = stmt.run(
        Number(b.property_id),
        String(b.unit_number),
        b.floor ? Number(b.floor) : 1,
        b.unit_type ?? 'Standard Apartment',
        Number(b.base_rent),
        b.service_charge ? Number(b.service_charge) : 0,
        b.garbage_fee ? Number(b.garbage_fee) : 0,
        b.meter_number ?? null,
        b.status ?? 'vacant',
        b.notes ?? ''
      );
      sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
    }`;

if (s.includes(oldPostUnits)) {
  s = s.replace(oldPostUnits, newPostUnits);
  console.log('Updated POST /api/units validation');
}

// 4. Fix POST /api/users validation & binding
const oldPostUsers = `    if (pathname === '/api/users' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (!user || user.role !== 'super_admin') {
        return sendJSON(res, 403, { error: "403 Forbidden: Only Platform Super Admins can provision or invite new users." });
      }
      const b = await parseBody(req);
      const stmt = db.prepare(\`
        INSERT INTO users (name, email, role, phone, property_id, status)
        VALUES (?, ?, ?, ?, ?, ?)
      \`);
      const info = stmt.run(b.name, b.email, b.role || 'caretaker', b.phone || '', b.property_id || null, b.status || 'active');
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
    }`;

const newPostUsers = `    if (pathname === '/api/users' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (!user || user.role !== 'super_admin') {
        return sendJSON(res, 403, { error: "403 Forbidden: Only Platform Super Admins can provision or invite new users." });
      }
      const b = await parseBody(req);
      if (!b.name || !b.email) {
        return sendJSON(res, 400, { error: "Name and email are required to provision a user." });
      }
      const stmt = db.prepare(\`
        INSERT INTO users (name, email, role, phone, property_id, status)
        VALUES (?, ?, ?, ?, ?, ?)
      \`);
      const info = stmt.run(
        b.name,
        b.email,
        b.role || 'caretaker',
        b.phone || '',
        b.property_id ? Number(b.property_id) : null,
        b.status || 'active'
      );
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
    }`;

if (s.includes(oldPostUsers)) {
  s = s.replace(oldPostUsers, newPostUsers);
  console.log('Updated POST /api/users validation');
}

// 5. Fix POST /api/payments with transaction and parameter coalescing
const oldPayments = `      // Insert payment record
      const insertPayment = db.prepare(\`
        INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
      \`);
      const payInfo = insertPayment.run(
        receiptNum, b.invoice_id || null, b.tenant_id, amount, paymentDate,
        b.payment_method || 'M-Pesa', refCode, b.payer_phone || '', b.payer_name || '', b.notes || 'Payment processed'
      );

      // Reconcile Invoice if linked
      let updatedInvoice = null;
      if (b.invoice_id) {
        const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(b.invoice_id);
        if (inv) {
          const newPaid = Number(inv.amount_paid) + amount;
          const newBalance = Math.max(0, Number(inv.total_amount) - newPaid);
          const newStatus = newBalance === 0 ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid');

          db.prepare(\`
            UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?
          \`).run(newPaid, newBalance, newStatus, inv.id);

          updatedInvoice = { id: inv.id, balance: newBalance, status: newStatus };
        }
      }`;

const newPayments = `      let invoiceId = b.invoice_id ? Number(b.invoice_id) : null;
      let linkedInv = invoiceId ? db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) : null;
      let tenantId = b.tenant_id ? Number(b.tenant_id) : (linkedInv ? linkedInv.tenant_id : null);

      let updatedInvoice = null;
      db.exec('BEGIN TRANSACTION');
      let payInfo;
      try {
        const insertPayment = db.prepare(\`
          INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
        \`);
        payInfo = insertPayment.run(
          receiptNum, invoiceId ?? null, tenantId ?? null, amount, paymentDate,
          b.payment_method || 'M-Pesa', refCode, b.payer_phone || '', b.payer_name || '', b.notes || 'Payment processed'
        );

        if (linkedInv) {
          const newPaid = Number(linkedInv.amount_paid) + amount;
          const newBalance = Math.max(0, Number(linkedInv.total_amount) - newPaid);
          const newStatus = newBalance === 0 ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid');

          db.prepare(\`
            UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?
          \`).run(newPaid, newBalance, newStatus, linkedInv.id);

          updatedInvoice = { id: linkedInv.id, balance: newBalance, status: newStatus };
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }`;

if (s.includes(oldPayments)) {
  s = s.replace(oldPayments, newPayments);
  console.log('Updated POST /api/payments with transaction and parameter coalescing');
}

// 6. Fix Escrow Release: remove fallback & dummy insert, return 404 if not found
const oldEscrow = `      let escrow = escrowId ? db.prepare('SELECT * FROM maintenance_escrows WHERE id = ?').get(escrowId) : null;
      if (!escrow) {
        escrow = db.prepare('SELECT * FROM maintenance_escrows ORDER BY id DESC LIMIT 1').get();
      }
      if (!escrow) {
        const dummy = db.prepare(\`
          INSERT INTO maintenance_escrows (ticket_id, fundi_id, amount, status, milestone_desc)
          VALUES (1, 1, 4500, 'held', 'Artisan milestone deposit')
        \`).run();
        escrow = db.prepare('SELECT * FROM maintenance_escrows WHERE id = ?').get(dummy.lastInsertRowid);
      }`;

const newEscrow = `      let escrow = escrowId ? db.prepare('SELECT * FROM maintenance_escrows WHERE id = ?').get(escrowId) : null;
      if (!escrow) {
        return sendJSON(res, 404, { error: 'Escrow record not found.' });
      }`;

if (s.includes(oldEscrow)) {
  s = s.replace(oldEscrow, newEscrow);
  console.log('Updated Escrow release validation');
}

// 7. Fix Public Vacancies fallback when 0 vacancies
const oldVacancies = `      // Graceful fallback if portfolio is 100% occupied
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

const newVacancies = `      // No fallback to occupied units - return empty vacancies array if 100% occupied`;

if (s.includes(oldVacancies)) {
  s = s.replace(oldVacancies, newVacancies);
  console.log('Removed occupied fallback from /api/public/vacancies');
}

// 8. Fix Inspection Settle-Deposit to vacate unit on move_out
const oldInspSettle = `    if (pathname.startsWith('/api/inspections/') && pathname.endsWith('/settle-deposit') && method === 'POST') {
      const id = pathname.split('/')[3];
      const b = await parseBody(req);
      let inspection = db.prepare('SELECT * FROM property_inspections WHERE id = ?').get(id);
      if (!inspection) {
        inspection = db.prepare('SELECT * FROM property_inspections ORDER BY id DESC LIMIT 1').get();
      }
      if (!inspection) return sendJSON(res, 404, { error: 'Inspection report not found.' });

      const deductionsDamages = b.deductions_damages !== undefined ? Number(b.deductions_damages) : Number(inspection.damages_total || 0);
      const deductionsArrears = b.deductions_arrears !== undefined ? Number(b.deductions_arrears) : Number(inspection.unpaid_utility_arrears || 0);
      const depositHeld = Number(inspection.deposit_held || 0);
      const netRefund = Math.max(0, depositHeld - deductionsDamages - deductionsArrears);

      const refundVoucher = 'REF-DEP-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      db.prepare(\`
        UPDATE property_inspections 
        SET status = 'settled', damages_total = ?, unpaid_utility_arrears = ?, net_deposit_refund = ? 
        WHERE id = ?
      \`).run(deductionsDamages, deductionsArrears, netRefund, inspection.id);

      return sendJSON(res, 200, {
        success: true,
        inspection_id: inspection.id,
        voucher_number: refundVoucher,
        net_refund: netRefund,
        deposit_held: depositHeld,
        deductions_total: deductionsDamages + deductionsArrears
      });
    }`;

const newInspSettle = `    if (pathname.startsWith('/api/inspections/') && pathname.endsWith('/settle-deposit') && method === 'POST') {
      const id = pathname.split('/')[3];
      const b = await parseBody(req);
      let inspection = db.prepare('SELECT * FROM property_inspections WHERE id = ?').get(id);
      if (!inspection) return sendJSON(res, 404, { error: 'Inspection report not found.' });

      const deductionsDamages = b.deductions_damages !== undefined ? Number(b.deductions_damages) : Number(inspection.damages_total || 0);
      const deductionsArrears = b.deductions_arrears !== undefined ? Number(b.deductions_arrears) : Number(inspection.unpaid_utility_arrears || 0);
      const depositHeld = Number(inspection.deposit_held || 0);
      const netRefund = Math.max(0, depositHeld - deductionsDamages - deductionsArrears);

      const refundVoucher = 'REF-DEP-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      db.prepare(\`
        UPDATE property_inspections 
        SET status = 'settled', damages_total = ?, unpaid_utility_arrears = ?, net_deposit_refund = ? 
        WHERE id = ?
      \`).run(deductionsDamages, deductionsArrears, netRefund, inspection.id);

      if (inspection.inspection_type === 'move_out') {
        db.prepare("UPDATE units SET status = 'vacant' WHERE id = ?").run(inspection.unit_id);
        db.prepare("UPDATE leases SET status = 'completed' WHERE unit_id = ? AND status = 'active'").run(inspection.unit_id);
        db.prepare("UPDATE lease_agreements SET status = 'completed' WHERE unit_id = ? AND status = 'executed'").run(inspection.unit_id);
      }

      return sendJSON(res, 200, {
        success: true,
        inspection_id: inspection.id,
        voucher_number: refundVoucher,
        net_refund: netRefund,
        deposit_held: depositHeld,
        deductions_total: deductionsDamages + deductionsArrears
      });
    }`;

if (s.includes(oldInspSettle)) {
  s = s.replace(oldInspSettle, newInspSettle);
  console.log('Updated Inspection settle-deposit to vacate unit on move_out');
}

// Convert back to CRLF if file was CRLF
if (isCRLF) {
  s = s.replace(/\n/g, '\r\n');
}

fs.writeFileSync('server.js', s, 'utf8');
console.log('Successfully written server.js');
