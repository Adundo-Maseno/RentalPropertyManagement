const { handleRequest } = require('../server.js');
const { EventEmitter } = require('node:events');

function invoke(url, method = 'GET', body = null, token = 'token_property_manager') {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.url = url;
    req.method = method;
    req.headers = {
      host: 'localhost:3000',
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json'
    };

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
          if (responseData) json = JSON.parse(responseData);
        } catch (e) {}

        resolve({ statusCode, ok: statusCode >= 200 && statusCode < 300, headers, body: responseData, json });
      }
    };

    handleRequest(req, res).catch(reject);

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', Buffer.from(payload));
    }
    req.emit('end');
  });
}

async function runAudit() {
  console.log('=====================================================');
  console.log('   FULL END-TO-END PROCESS AUDIT ACROSS 12 STAGES');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, ok, details = '') {
    if (ok) {
      console.log(`[PASS] ${name} ${details ? '-> ' + details : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} -> ${details}`);
      failed++;
    }
  }

  // Stage 1: Public Vacancies & Viewing Booking
  try {
    const r1 = await invoke('/api/public/vacancies');
    test('Stage 1: Public Vacancy Showcase Feed', r1.ok && r1.json?.vacancies?.length > 0, `Active listings: ${r1.json?.vacancies?.length}`);
    const vUnit = r1.json?.vacancies[0];

    const r2 = await invoke('/api/public/book-viewing', 'POST', {
      unit_id: vUnit?.id || 4,
      prospect_name: 'Grace Wanjiru Kamau',
      phone: '+254722556677',
      email: 'grace.kamau@innovate.co.ke',
      preferred_date: '2026-11-10',
      time_slot: '10:00 AM',
      notes: 'Interested in executive 2BR unit'
    });
    test('Stage 1: Prospect Viewing Appointment Booking', r2.ok && (r2.json?.booking_reference || r2.json?.reference), `Ref: ${r2.json?.booking_reference || r2.json?.reference}`);

    const rLeads = await invoke('/api/viewing-leads');
    test('Stage 1: Inbound Viewing Leads Dashboard Feed', rLeads.ok && rLeads.json?.leads?.length > 0, `Total Leads: ${rLeads.json?.leads?.length}`);
  } catch (e) {
    test('Stage 1: Public Vacancies & Viewing', false, e.message);
  }

  // Stage 2: AI Tenant Vetting & CRB Risk Tiering
  try {
    const r3 = await invoke('/api/tenant-vetting/analyze', 'POST', {
      applicant_name: 'Grace Wanjiru Kamau',
      phone: '+254722556677',
      id_number: '29871122',
      monthly_income: 240000,
      requested_unit_id: 2
    });
    test('Stage 2: AI Tenant Vetting & CRB Credit Score', r3.ok && r3.json?.analysis?.crb_score, `Score: ${r3.json?.analysis?.crb_score}, Risk: ${r3.json?.analysis?.risk_category}`);
  } catch (e) {
    test('Stage 2: AI Tenant Vetting', false, e.message);
  }

  // Stage 3: Tenant Registration
  let newTenantId = null;
  try {
    const r4 = await invoke('/api/tenants', 'POST', {
      name: 'Grace Wanjiru Kamau',
      phone: '+254722556677',
      id_number: '29871122',
      email: 'grace.kamau@innovate.co.ke',
      emergency_contact_name: 'Daniel Kamau',
      emergency_contact_phone: '+254711223344',
      status: 'active'
    });
    newTenantId = r4.json?.id;
    test('Stage 3: Tenant Onboarding in PMS', r4.ok && newTenantId, `Tenant ID: ${newTenantId}`);
  } catch (e) {
    test('Stage 3: Tenant Onboarding', false, e.message);
  }

  // Stage 4: Digital Tenancy Lease Execution & Occupied Collision Prevention
  let newLeaseId = null;
  try {
    // 1. Fetch available units
    const unitsRes = await invoke('/api/units');
    let vacantUnit = unitsRes.json?.find(u => u.status === 'vacant');
    if (!vacantUnit) {
      // Free up unit 7 for deterministic repeat testing
      const leases = (await invoke('/api/leases')).json || [];
      for (const l of leases) {
        if (l.unit_id === 7 && l.status === 'active') {
          await invoke(`/api/leases/${l.id}/terminate`, 'PUT');
        }
      }
      vacantUnit = { id: 7, base_rent: 75000 };
    }

    // 2. Test occupied assignment rejection!
    const occupiedUnit = unitsRes.json?.find(u => u.status === 'occupied') || { id: 1 };
    const rOccupied = await invoke('/api/leases', 'POST', {
      unit_id: occupiedUnit.id,
      tenant_id: newTenantId || 1,
      start_date: '2026-11-01',
      end_date: '2027-10-31',
      monthly_rent: 65000
    });
    test('Stage 4: Collision Prevention: Occupied Unit Re-assignment Blocked (400)', rOccupied.statusCode === 400, `Status: ${rOccupied.statusCode}`);

    // 3. Create lease on vacant unit
    const r5 = await invoke('/api/leases', 'POST', {
      unit_id: vacantUnit.id,
      tenant_id: newTenantId || 1,
      start_date: '2026-11-01',
      end_date: '2027-10-31',
      monthly_rent: vacantUnit.base_rent || 75000,
      deposit_paid: (vacantUnit.base_rent || 75000) * 2,
      water_deposit: 5000,
      terms: 'Standard commercial tenancy agreement'
    });
    newLeaseId = r5.json?.id;
    test('Stage 4: Create Tenancy Lease Agreement', r5.ok && newLeaseId, `Lease ID: ${newLeaseId}`);

    // 4. Verify lease agreement automatically appeared in Digital Leases & E-sign!
    const rAgreements = await invoke('/api/leases/agreements');
    const autoAgreement = rAgreements.json?.agreements?.find(a => a.lease_id === newLeaseId || a.unit_id === vacantUnit.id);
    test('Stage 4: Auto-sync to Digital Leases & E-sign', !!autoAgreement && autoAgreement.status === 'pending_tenant', `Code: ${autoAgreement?.agreement_code}, Hash: ${autoAgreement?.contract_hash}`);
  } catch (e) {
    test('Stage 4: Create Tenancy Lease', false, e.message);
  }

  // Stage 5: Biometric E-Signature Sealing
  try {
    const r6 = await invoke(`/api/leases/agreements/2/sign`, 'POST', {
      signature: 'data:image/svg+xml;utf8,<svg>test-signature</svg>',
      signature_svg: 'data:image/svg+xml;utf8,<svg>test-signature</svg>',
      signer_role: 'manager',
      signer_name: 'Patrick Ndegwa (Property Manager)'
    });
    test('Stage 5: Biometric E-Signature & SHA-256 Seal', r6.ok && r6.json?.agreement?.contract_hash, `Hash: ${r6.json?.agreement?.contract_hash}`);
  } catch (e) {
    test('Stage 5: Biometric E-Signature', false, e.message);
  }

  // Stage 6: Move-In Condition Audit
  try {
    const r7 = await invoke('/api/inspections', 'POST', {
      unit_id: 1,
      tenant_id: 1,
      inspection_type: 'move_in',
      inspector_name: 'John Otieno (Site Caretaker)',
      deposit_held: 130000,
      checklist: [
        { item: 'Living Room Walls & Paint', status: 'Pristine', notes: 'Fresh paint' },
        { item: 'Kitchen Sink Mixer', status: 'Pristine', notes: 'Checked pressure' }
      ]
    });
    test('Stage 6: Move-In Condition Inspection Audit', r7.ok, `Audit ID: ${r7.json?.id}`);
  } catch (e) {
    test('Stage 6: Move-In Condition Audit', false, e.message);
  }

  // Stage 7: Ultrasonic Water Sub-Meter Logging
  try {
    const r8 = await invoke('/api/water-readings', 'POST', {
      unit_id: 1,
      month: '2026-11',
      previous_reading: 162.5,
      current_reading: 178.0
    });
    test('Stage 7: Ultrasonic Water Sub-Meter Logging', r8.ok && r8.json?.units_consumed === 15.5, `Consumed: ${r8.json?.units_consumed} m3, Tariff: KES ${r8.json?.total_cost}`);
  } catch (e) {
    test('Stage 7: Water Meter Logging', false, e.message);
  }

  // Stage 8: Custom Invoicing & Bulk 5th Due SMS Notices
  let invId = null;
  try {
    const r9 = await invoke('/api/invoices', 'POST', {
      lease_id: 1,
      tenant_id: 1,
      unit_id: 1,
      month: '2026-11',
      rent_amount: 65000,
      water_amount: 2712.5,
      garbage_amount: 500,
      service_charge: 3500,
      late_fee: 0,
      other_charges: 0,
      due_date: '2026-11-05',
      notes: 'Audit monthly invoice'
    });
    invId = r9.json?.id;
    test('Stage 8: Custom Itemized Rent Invoice', r9.ok && invId, `Invoice ID: ${invId}`);

    const r10 = await invoke('/api/communications/broadcast', 'POST', {
      property_id: 1,
      message: 'Dear Resident, your BomaSphere rent invoice is due on the 5th.',
      type: 'sms'
    });
    test('Stage 8: Bulk 5th Due SMS Dispatch', r10.ok, `Dispatched to ${r10.json?.recipient_count} tenants`);
  } catch (e) {
    test('Stage 8: Invoicing & SMS Dispatch', false, e.message);
  }

  // Stage 9: Automated Lipa Na M-Pesa STK Instant Reconciliation
  try {
    const r11 = await invoke('/api/payments', 'POST', {
      invoice_id: invId || 1,
      tenant_id: 1,
      unit_id: 1,
      amount: 71712.5,
      payment_method: 'M-Pesa STK Push',
      payer_phone: '+254722889900',
      notes: 'Cleared invoice via STK'
    });
    test('Stage 9: Lipa Na M-Pesa STK Reconciliation', r11.ok && r11.json?.receipt_number, `Receipt: ${r11.json?.receipt_number}, M-Pesa Ref: ${r11.json?.reference_code}`);
  } catch (e) {
    test('Stage 9: M-Pesa STK Reconciliation', false, e.message);
  }

  // Stage 10: Resident Portal Visitor QR Passes & Amenity Booking
  try {
    const r12 = await invoke('/api/visitor-passes', 'POST', {
      unit_id: 1,
      tenant_id: 1,
      visitor_name: 'Dr. Kiprop Chemweno',
      visitor_phone: '+254711334455',
      vehicle_plate: 'KDC 718T',
      valid_date: '2026-11-04',
      time_slot: '02:00 PM - 06:00 PM'
    });
    test('Stage 10: Resident Visitor Gate Pass (Encrypted QR)', r12.ok && r12.json?.pass_code, `Pass Code: ${r12.json?.pass_code}`);

    const r13 = await invoke('/api/amenity-bookings', 'POST', {
      amenity_id: 1,
      tenant_id: 1,
      unit_id: 1,
      booking_date: '2026-11-07',
      start_time: '04:00 PM',
      duration_hours: 3
    });
    test('Stage 10: Estate Shared Amenity Reservation', r13.ok && (r13.json?.booking_reference || r13.json?.booking_ref), `Ref: ${r13.json?.booking_reference || r13.json?.booking_ref}`);
  } catch (e) {
    test('Stage 10: Visitor Passes & Amenities', false, e.message);
  }

  // Stage 11: Maintenance Ticket & Fundi Escrow Disbursement
  try {
    const r14 = await invoke('/api/maintenance', 'POST', {
      unit_id: 1,
      category: 'Plumbing',
      title: 'Water filter cartridge replacement',
      description: 'Cartridge pressure dropping below 2.0 bar',
      priority: 'medium'
    });
    test('Stage 11: Maintenance Incident Ticket', r14.ok && r14.json?.ticket_number, `Ticket: ${r14.json?.ticket_number}`);

    const r15 = await invoke('/api/artisan-marketplace/fundi-escrow/1/release', 'POST', {});
    test('Stage 11: Fundi Escrow B2C M-Pesa Release', r15.ok, `Disbursement: ${r15.json?.b2c_reference}`);
  } catch (e) {
    test('Stage 11: Maintenance & Fundi Escrow', false, e.message);
  }

  // Stage 12: Move-Out Exit Deposit Settlement & Landlord Statement
  try {
    const r16 = await invoke('/api/inspections/2/settle-deposit', 'POST', {
      deductions_damages: 5000,
      deductions_arrears: 1500
    });
    test('Stage 12: Move-Out Exit Deposit Settlement', r16.ok && r16.json?.net_refund !== undefined, `Net Refund: KES ${r16.json?.net_refund}`);

    const r17 = await invoke('/api/reports/landlord-statement?property_id=1', 'GET');
    test('Stage 12: Landlord Remittance Statement & eTIMS Tax', r17.ok && r17.json?.statement?.net_remittance_payout, `Gross: KES ${r17.json?.statement?.gross_rent_collected}, Net Payout: KES ${r17.json?.statement?.net_remittance_payout}`);
  } catch (e) {
    test('Stage 12: Move-Out & Owner Statement', false, e.message);
  }

  // Stage 13: RBAC Security Boundaries
  try {
    const r18 = await invoke('/api/invoices', 'GET', null, 'token_caretaker');
    test('RBAC Security: Caretaker blocked from invoices (403)', r18.statusCode === 403, `Status: ${r18.statusCode}`);

    const r19 = await invoke('/api/users', 'GET', null, 'token_tenant');
    test('RBAC Security: Tenant blocked from user administration (403)', r19.statusCode === 403, `Status: ${r19.statusCode}`);

    const r20 = await invoke('/api/users', 'GET', null, '');
    test('RBAC Security: Unauthenticated request blocked from users (401)', r20.statusCode === 401, `Status: ${r20.statusCode}`);
  } catch (e) {
    test('RBAC Security Boundaries', false, e.message);
  }

  console.log('\n=====================================================');
  console.log(` AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED `);
  console.log('=====================================================');
  if (failed > 0) process.exit(1);
}

runAudit();

