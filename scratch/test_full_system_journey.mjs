import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';
let managerToken = 'token_property_manager';

async function req(path, method = 'GET', body = null, headers = {}) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${managerToken}`,
      ...headers
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runFullJourneyAudit() {
  console.log('=====================================================');
  console.log('   STARTING FULL BOMASPHERE PMS PROCESS AUDIT');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function record(testName, ok, details = '') {
    if (ok) {
      console.log(`[PASS] ${testName} ${details ? '-> ' + details : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} -> ${details}`);
      failed++;
    }
  }

  // 1. Public Vacancies & Viewing Scheduling
  try {
    const v = await req('/api/public/vacancies', 'GET');
    record('Stage 1: Public Vacancies API', v.ok && v.data?.vacancies?.length > 0, `Found ${v.data?.vacancies?.length} vacancies`);
    
    const targetUnit = v.data?.vacancies[0];
    const viewing = await req('/api/public/book-viewing', 'POST', {
      unit_id: targetUnit.id,
      prospect_name: 'Audit Prospect Kenya',
      phone: '+254711998877',
      email: 'prospect.audit@gmail.com',
      preferred_date: '2026-11-10',
      time_slot: '10:00 AM',
      notes: 'Interested in executive 2BR unit'
    });
    record('Stage 1: Viewing Appointment Booking', viewing.ok && viewing.data?.booking_reference, `Ref: ${viewing.data?.booking_reference}`);
  } catch (e) {
    record('Stage 1: Public Vacancies & Viewing', false, e.message);
  }

  // 2. AI Tenant Vetting
  try {
    const vet = await req('/api/tenant-vetting/analyze', 'POST', {
      applicant_name: 'Grace Wanjiru Kamau',
      phone: '+254722556677',
      id_number: '29871122',
      monthly_income: 240000,
      requested_unit_id: 2
    });
    record('Stage 2: AI Underwriting & CRB Scoring', vet.ok && vet.data?.analysis?.crb_score, `Score: ${vet.data?.analysis?.crb_score}, Risk: ${vet.data?.analysis?.risk_category}`);
  } catch (e) {
    record('Stage 2: AI Tenant Vetting', false, e.message);
  }

  // 3. Registering a New Tenant
  let newTenantId = null;
  try {
    const t = await req('/api/tenants', 'POST', {
      name: 'Grace Wanjiru Kamau',
      phone: '+254722556677',
      id_number: '29871122',
      email: 'grace.kamau@innovate.co.ke',
      emergency_contact_name: 'Daniel Kamau (Brother)',
      emergency_contact_phone: '+254711223344',
      status: 'active'
    });
    newTenantId = t.data?.id;
    record('Stage 3: Register Tenant Profile', t.ok && newTenantId, `Tenant ID: ${newTenantId}`);
  } catch (e) {
    record('Stage 3: Register Tenant Profile', false, e.message);
  }

  // 4. Executing Digital Tenancy Lease
  let newLeaseId = null;
  try {
    const l = await req('/api/leases', 'POST', {
      unit_id: 7, // Suite 102 (vacant)
      tenant_id: newTenantId,
      start_date: '2026-11-01',
      end_date: '2027-10-31',
      monthly_rent: 75000,
      deposit_paid: 150000,
      water_deposit: 5000,
      terms: 'Standard commercial tenancy agreement governed by Kenya Law.'
    });
    newLeaseId = l.data?.id;
    record('Stage 4: Create Tenancy Lease', l.ok && newLeaseId, `Lease ID: ${newLeaseId}`);
  } catch (e) {
    record('Stage 4: Create Tenancy Lease', false, e.message);
  }

  // 5. Digital Lease E-Signature & Contract Hash
  try {
    const sign = await req(`/api/leases/agreements/2/sign`, 'POST', {
      signature: 'data:image/svg+xml;utf8,<svg>test-signature</svg>',
      signature_svg: 'data:image/svg+xml;utf8,<svg>test-signature</svg>',
      signer_role: 'manager',
      signer_name: 'Patrick Ndegwa (Property Manager)'
    });
    record('Stage 5: Biometric E-Signature Execution', sign.ok && sign.data?.agreement?.contract_hash, `Hash: ${sign.data?.agreement?.contract_hash}`);
  } catch (e) {
    record('Stage 5: Biometric E-Signature Execution', false, e.message);
  }

  // 6. Move-In Condition Audit
  let inspectionId = null;
  try {
    const insp = await req('/api/inspections', 'POST', {
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
    inspectionId = insp.data?.inspection?.id || insp.data?.id;
    record('Stage 6: Move-In Condition Audit', insp.ok, `Inspection ID: ${inspectionId}`);
  } catch (e) {
    record('Stage 6: Move-In Condition Audit', false, e.message);
  }

  // 7. Ultrasonic Water Meter Reading & Consumption Billing
  try {
    const water = await req('/api/water-readings', 'POST', {
      unit_id: 1,
      month: '2026-11',
      previous_reading: 162.5,
      current_reading: 178.0
    });
    record('Stage 7: Water Sub-Meter Logging', water.ok && water.data?.units_consumed === 15.5, `Consumed: ${water.data?.units_consumed} m3, Cost: KES ${water.data?.total_cost}`);
  } catch (e) {
    record('Stage 7: Water Sub-Meter Logging', false, e.message);
  }

  // 8. Custom Invoicing & 5th Due Bulk SMS Dispatch
  let invoiceId = null;
  try {
    const inv = await req('/api/invoices', 'POST', {
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
      notes: 'Monthly billing cycle'
    });
    invoiceId = inv.data?.id;
    record('Stage 8: Custom Invoice Generation', inv.ok && invoiceId, `Invoice ID: ${invoiceId}`);

    const sms = await req('/api/communications/broadcast', 'POST', {
      property_id: 1,
      message: 'Dear Resident, your BomaSphere rent invoice is due on the 5th. Pay via Paybill 522522.',
      type: 'sms'
    });
    record('Stage 8: Bulk 5th Due SMS Dispatch', sms.ok, `Delivered: ${sms.data?.recipient_count} recipients`);
  } catch (e) {
    record('Stage 8: Invoicing & SMS Broadcast', false, e.message);
  }

  // 9. Automated Lipa Na M-Pesa STK Instant Reconciliation
  try {
    const pay = await req('/api/payments', 'POST', {
      invoice_id: invoiceId || 1,
      tenant_id: 1,
      unit_id: 1,
      amount: 71712.5,
      payment_method: 'M-Pesa STK Push',
      payer_phone: '+254722889900',
      notes: 'Cleared full invoice balance'
    });
    record('Stage 9: M-Pesa STK Push Reconciliation', pay.ok && pay.data?.receipt_number, `Receipt: ${pay.data?.receipt_number}, M-Pesa Code: ${pay.data?.reference_code}`);
  } catch (e) {
    record('Stage 9: M-Pesa STK Reconciliation', false, e.message);
  }

  // 10. Visitor Gate QR Passes & Estate Amenities
  try {
    const pass = await req('/api/visitor-passes', 'POST', {
      unit_id: 1,
      tenant_id: 1,
      visitor_name: 'Dr. Kiprop Chemweno',
      visitor_phone: '+254711334455',
      vehicle_plate: 'KDC 718T',
      valid_date: '2026-11-04',
      time_slot: '02:00 PM - 06:00 PM'
    });
    record('Stage 10: Visitor Gate Pass with QR', pass.ok && pass.data?.pass_code, `Code: ${pass.data?.pass_code}`);

    const amenity = await req('/api/amenity-bookings', 'POST', {
      amenity_id: 1,
      tenant_id: 1,
      unit_id: 1,
      booking_date: '2026-11-07',
      start_time: '04:00 PM',
      duration_hours: 3
    });
    record('Stage 10: Estate Amenity Reservation', amenity.ok && (amenity.data?.booking_reference || amenity.data?.booking_ref), `Ref: ${amenity.data?.booking_reference || amenity.data?.booking_ref}`);
  } catch (e) {
    record('Stage 10: Visitor Passes & Amenities', false, e.message);
  }

  // 11. Maintenance Work Order & Fundi Milestone Escrow
  try {
    const tkt = await req('/api/maintenance', 'POST', {
      unit_id: 1,
      category: 'Plumbing',
      title: 'Water filter cartridge replacement',
      description: 'Cartridge pressure dropping below 2.0 bar',
      priority: 'medium'
    });
    record('Stage 11: Maintenance Incident Ticket', tkt.ok && tkt.data?.ticket_number, `Ticket: ${tkt.data?.ticket_number}`);

    const escrow = await req('/api/artisan-marketplace/fundi-escrow/1/release', 'POST', {});
    record('Stage 11: Fundi Escrow B2C M-Pesa Release', escrow.ok, `Disbursement: ${escrow.data?.b2c_reference}`);
  } catch (e) {
    record('Stage 11: Maintenance & Escrow', false, e.message);
  }

  // 12. Move-Out Exit Deposit Settlement & Landlord Statement
  try {
    const settle = await req('/api/inspections/2/settle-deposit', 'POST', {
      deductions_damages: 5000,
      deductions_arrears: 1500
    });
    record('Stage 12: Move-Out Deposit Settlement', settle.ok && settle.data?.net_refund !== undefined, `Net Refund: KES ${settle.data?.net_refund}`);

    const stmt = await req('/api/reports/landlord-statement?property_id=1', 'GET');
    record('Stage 12: Landlord Statement & eTIMS Remittance', stmt.ok && stmt.data?.statement?.net_remittance_payout, `Gross: KES ${stmt.data?.statement?.gross_rent_collected}, Net Payout: KES ${stmt.data?.statement?.net_remittance_payout}`);
  } catch (e) {
    record('Stage 12: Move-Out & Owner Statement', false, e.message);
  }

  console.log('\n=====================================================');
  console.log(` AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED `);
  console.log('=====================================================');
  if (failed > 0) process.exit(1);
}

runFullJourneyAudit();

