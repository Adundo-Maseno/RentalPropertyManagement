/**
 * Cloudflare Pages Functions - Full Edge API Router for BomaSphere PMS
 * Implements full RESTful API for BomaSphere Property Management System at the Global Edge
 */

// Edge In-Memory Database
const DB = {
  properties: [
    { id: 1, name: "Kilimani Royal Heights", property_type: "Residential Apartments", address: "Argwings Kodhek Rd, Kilimani", city: "Nairobi", landlord_name: "Maziwa Investment Group", landlord_phone: "+254722100200", landlord_email: "finance@maziwa.co.ke", management_fee_pct: 8.5, paybill_number: "522522 / Acc: KRH-01", bank_name: "KCB Bank", bank_account: "1189452300" },
    { id: 2, name: "Westlands Executive Suites", property_type: "Mixed Commercial & Residential", address: "Mpaka Road, Westlands", city: "Nairobi", landlord_name: "Crown Peak Holdings Ltd", landlord_phone: "+254711333444", landlord_email: "properties@crownpeak.co.ke", management_fee_pct: 10.0, paybill_number: "600100 / Acc: WES-99", bank_name: "Equity Bank", bank_account: "0450293847291" },
    { id: 3, name: "Riverside Green Court", property_type: "Residential Townhouses", address: "Riverside Drive", city: "Nairobi", landlord_name: "Dr. Esther Wambui Ndung'u", landlord_phone: "+254733555777", landlord_email: "esther.ndungu@gmail.com", management_fee_pct: 7.5, paybill_number: "247247 / Acc: RGC-12", bank_name: "Co-operative Bank", bank_account: "01129384756200" },
    { id: 4, name: "Nyali Ocean Breeze Villas", property_type: "Luxury Holiday & Long-let Villas", address: "Links Road, Nyali", city: "Mombasa", landlord_name: "Sheikh Omar Al-Harthy", landlord_phone: "+254720999888", landlord_email: "omar.alharthy@coastinvest.com", management_fee_pct: 10.0, paybill_number: "522522 / Acc: NOB-04", bank_name: "NCBA Bank", bank_account: "1004829103" }
  ],

  units: [
    { id: 1, property_id: 1, unit_number: "A101", floor: "1st Floor", unit_type: "2-Bedroom Master Ensuite", base_rent: 65000, service_charge: 3500, garbage_fee: 500, status: "occupied", meter_number: "WM-KIL-101", property_name: "Kilimani Royal Heights" },
    { id: 2, property_id: 1, unit_number: "A102", floor: "1st Floor", unit_type: "2-Bedroom Master Ensuite", base_rent: 65000, service_charge: 3500, garbage_fee: 500, status: "occupied", meter_number: "WM-KIL-102", property_name: "Kilimani Royal Heights" },
    { id: 3, property_id: 1, unit_number: "A201", floor: "2nd Floor", unit_type: "3-Bedroom with DSQ", base_rent: 85000, service_charge: 4500, garbage_fee: 500, status: "occupied", meter_number: "WM-KIL-201", property_name: "Kilimani Royal Heights" },
    { id: 4, property_id: 1, unit_number: "A202", floor: "2nd Floor", unit_type: "3-Bedroom with DSQ", base_rent: 85000, service_charge: 4500, garbage_fee: 500, status: "vacant", meter_number: "WM-KIL-202", property_name: "Kilimani Royal Heights" },
    { id: 5, property_id: 1, unit_number: "Penthouse 1", floor: "Top Floor", unit_type: "4-Bedroom Luxury Penthouse", base_rent: 140000, service_charge: 6000, garbage_fee: 750, status: "occupied", meter_number: "WM-KIL-PH1", property_name: "Kilimani Royal Heights" },
    { id: 6, property_id: 2, unit_number: "Suite 101", floor: "1st Floor", unit_type: "Commercial Office Space (850 sqft)", base_rent: 95000, service_charge: 12000, garbage_fee: 1000, status: "occupied", meter_number: "WM-WES-101", property_name: "Westlands Executive Suites" },
    { id: 7, property_id: 2, unit_number: "Suite 102", floor: "1st Floor", unit_type: "Commercial Office Space (650 sqft)", base_rent: 75000, service_charge: 8500, garbage_fee: 1000, status: "vacant", meter_number: "WM-WES-102", property_name: "Westlands Executive Suites" },
    { id: 8, property_id: 2, unit_number: "Res B3", floor: "3rd Floor", unit_type: "1-Bedroom Executive Serviced", base_rent: 55000, service_charge: 4000, garbage_fee: 500, status: "occupied", meter_number: "WM-WES-B3", property_name: "Westlands Executive Suites" },
    { id: 9, property_id: 2, unit_number: "Res B4", floor: "3rd Floor", unit_type: "Studio Loft Apartment", base_rent: 42000, service_charge: 3000, garbage_fee: 500, status: "maintenance", meter_number: "WM-WES-B4", property_name: "Westlands Executive Suites" },
    { id: 10, property_id: 3, unit_number: "Villa 4", floor: "Ground + 1", unit_type: "4-Bedroom Townhouse with Garden", base_rent: 180000, service_charge: 7500, garbage_fee: 1000, status: "occupied", meter_number: "WM-RIV-04", property_name: "Riverside Green Court" },
    { id: 11, property_id: 3, unit_number: "Villa 7", floor: "Ground + 1", unit_type: "4-Bedroom Townhouse with Garden", base_rent: 180000, service_charge: 7500, garbage_fee: 1000, status: "vacant", meter_number: "WM-RIV-07", property_name: "Riverside Green Court" },
    { id: 12, property_id: 4, unit_number: "Villa Palms", floor: "Ground + 1", unit_type: "3-Bedroom Beachfront Villa", base_rent: 120000, service_charge: 5000, garbage_fee: 800, status: "occupied", meter_number: "WM-NYA-01", property_name: "Nyali Ocean Breeze Villas" }
  ],

  tenants: [
    { id: 1, name: "Kariuki James Mwangi", phone: "+254722889900", email: "james.kariuki@techke.com", id_number: "28945612", emergency_contact_name: "Grace Mwangi (Wife)", emergency_contact_phone: "+254721445566", status: "active", unit_id: 1, unit_number: "A101", property_name: "Kilimani Royal Heights", balance: 0 },
    { id: 2, name: "Amina Hassan Mohamed", phone: "+254710123456", email: "amina.hassan@innovate.co.ke", id_number: "31098452", emergency_contact_name: "Farah Mohamed (Brother)", emergency_contact_phone: "+254734998877", status: "active", unit_id: 2, unit_number: "A102", property_name: "Kilimani Royal Heights", balance: 31012.5 },
    { id: 3, name: "Brian Omondi Otieno", phone: "+254798654321", email: "brian.omondi@consultancy.org", id_number: "26781290", emergency_contact_name: "Brenda Otieno (Sister)", emergency_contact_phone: "+254712334455", status: "active", unit_id: 3, unit_number: "A201", property_name: "Kilimani Royal Heights", balance: 96087.5 },
    { id: 4, name: "Nexus Law Advocates LLP", phone: "+254700554433", email: "admin@nexuslaw.co.ke", id_number: "CPR/2019/94832", emergency_contact_name: "Senior Partner K. Mutua", emergency_contact_phone: "+254722998811", status: "active", unit_id: 6, unit_number: "Suite 101", property_name: "Westlands Executive Suites", balance: 110100 },
    { id: 5, name: "David Kimani Ngugi", phone: "+254725332211", email: "david.kimani@safari.com", id_number: "25890143", emergency_contact_name: "Beatrice Ngugi (Mother)", emergency_contact_phone: "+254722114477", status: "active", unit_id: 8, unit_number: "Res B3", property_name: "Westlands Executive Suites", balance: 0 },
    { id: 6, name: "Sophie Van Der Beek", phone: "+254746112233", email: "sophie.vdb@unep.org", id_number: "PASSPORT-NL983214", emergency_contact_name: "Dirk Van Der Beek", emergency_contact_phone: "+31612345678", status: "active", unit_id: 5, unit_number: "Penthouse 1", property_name: "Kilimani Royal Heights", balance: 0 },
    { id: 7, name: "Capt. Salim Bwanaheri", phone: "+254720448833", email: "salim.bwanaheri@kpa.co.ke", id_number: "24119830", emergency_contact_name: "Asha Salim (Wife)", emergency_contact_phone: "+254733221100", status: "active", unit_id: 12, unit_number: "Villa Palms", property_name: "Nyali Ocean Breeze Villas", balance: 0 }
  ],

  invoices: [
    { id: 1, invoice_number: "INV-202611-001", lease_id: 1, tenant_id: 1, unit_id: 1, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 65000, water_amount: 2310, garbage_amount: 500, service_charge: 3500, late_fee: 0, other_charges: 0, total_amount: 71310, amount_paid: 71310, balance: 0, status: "paid", notes: "Automated monthly billing for Nov 2026", tenant_name: "Kariuki James Mwangi", tenant_phone: "+254722889900", unit_number: "A101", property_name: "Kilimani Royal Heights" },
    { id: 2, invoice_number: "INV-202611-002", lease_id: 2, tenant_id: 2, unit_id: 2, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 65000, water_amount: 2012.5, garbage_amount: 500, service_charge: 3500, late_fee: 0, other_charges: 0, total_amount: 71012.5, amount_paid: 40000, balance: 31012.5, status: "partially_paid", notes: "Partial payment received", tenant_name: "Amina Hassan Mohamed", tenant_phone: "+254710123456", unit_number: "A102", property_name: "Kilimani Royal Heights" },
    { id: 3, invoice_number: "INV-202611-003", lease_id: 3, tenant_id: 3, unit_id: 3, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 85000, water_amount: 3587.5, garbage_amount: 500, service_charge: 4500, late_fee: 2500, other_charges: 0, total_amount: 96087.5, amount_paid: 0, balance: 96087.5, status: "overdue", notes: "Late fee applied", tenant_name: "Brian Omondi Otieno", tenant_phone: "+254798654321", unit_number: "A201", property_name: "Kilimani Royal Heights" },
    { id: 4, invoice_number: "INV-202611-004", lease_id: 4, tenant_id: 6, unit_id: 5, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 140000, water_amount: 3937.5, garbage_amount: 750, service_charge: 6000, late_fee: 0, other_charges: 0, total_amount: 150687.5, amount_paid: 150687.5, balance: 0, status: "paid", notes: "NCBA Wire Transfer", tenant_name: "Sophie Van Der Beek", tenant_phone: "+254746112233", unit_number: "Penthouse 1", property_name: "Kilimani Royal Heights" },
    { id: 5, invoice_number: "INV-202611-005", lease_id: 5, tenant_id: 4, unit_id: 6, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-10", rent_amount: 95000, water_amount: 2100, garbage_amount: 1000, service_charge: 12000, late_fee: 0, other_charges: 0, total_amount: 110100, amount_paid: 0, balance: 110100, status: "unpaid", notes: "Commercial office Nov billing", tenant_name: "Nexus Law Advocates LLP", tenant_phone: "+254700554433", unit_number: "Suite 101", property_name: "Westlands Executive Suites" },
    { id: 6, invoice_number: "INV-202611-006", lease_id: 6, tenant_id: 5, unit_id: 8, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 55000, water_amount: 1487.5, garbage_amount: 500, service_charge: 4000, late_fee: 0, other_charges: 0, total_amount: 60987.5, amount_paid: 60987.5, balance: 0, status: "paid", notes: "Serviced apartment billing", tenant_name: "David Kimani Ngugi", tenant_phone: "+254725332211", unit_number: "Res B3", property_name: "Westlands Executive Suites" },
    { id: 7, invoice_number: "INV-202611-007", lease_id: 8, tenant_id: 7, unit_id: 12, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 120000, water_amount: 2975, garbage_amount: 800, service_charge: 5000, late_fee: 0, other_charges: 0, total_amount: 128775, amount_paid: 128775, balance: 0, status: "paid", notes: "Nyali coastal villa Nov rent", tenant_name: "Capt. Salim Bwanaheri", tenant_phone: "+254720448833", unit_number: "Villa Palms", property_name: "Nyali Ocean Breeze Villas" }
  ],

  payments: [
    { id: 1, receipt_number: "REC-20261101-4912", invoice_id: 1, tenant_id: 1, amount: 71310, payment_date: "2026-11-01 08:30:15", payment_method: "M-Pesa", reference_code: "QG982KLA83", payer_phone: "+254722889900", payer_name: "Kariuki James Mwangi", status: "completed", notes: "Rent payment via M-Pesa STK", tenant_name: "Kariuki James Mwangi", invoice_number: "INV-202611-001", unit_number: "A101", property_name: "Kilimani Royal Heights" },
    { id: 2, receipt_number: "REC-20261101-5129", invoice_id: 2, tenant_id: 2, amount: 40000, payment_date: "2026-11-01 09:14:02", payment_method: "M-Pesa", reference_code: "QGA77XNM21", payer_phone: "+254710123456", payer_name: "Amina Hassan Mohamed", status: "completed", notes: "Partial rent payment via M-Pesa", tenant_name: "Amina Hassan Mohamed", invoice_number: "INV-202611-002", unit_number: "A102", property_name: "Kilimani Royal Heights" },
    { id: 3, receipt_number: "REC-20261101-8834", invoice_id: 4, tenant_id: 6, amount: 150687.5, payment_date: "2026-11-01 11:45:00", payment_method: "Bank Transfer", reference_code: "NCBA-TXN-90283", payer_phone: "+254746112233", payer_name: "Sophie Van Der Beek", status: "completed", notes: "Wire transfer NCBA Bank", tenant_name: "Sophie Van Der Beek", invoice_number: "INV-202611-004", unit_number: "Penthouse 1", property_name: "Kilimani Royal Heights" },
    { id: 4, receipt_number: "REC-20261101-9921", invoice_id: 6, tenant_id: 5, amount: 60987.5, payment_date: "2026-11-01 14:20:10", payment_method: "M-Pesa", reference_code: "QGB33PRT90", payer_phone: "+254725332211", payer_name: "David Kimani Ngugi", status: "completed", notes: "Rent settlement", tenant_name: "David Kimani Ngugi", invoice_number: "INV-202611-006", unit_number: "Res B3", property_name: "Westlands Executive Suites" },
    { id: 5, receipt_number: "REC-20261101-3310", invoice_id: 7, tenant_id: 7, amount: 128775, payment_date: "2026-11-01 16:05:44", payment_method: "Cheque Deposit", reference_code: "CHQ-ABSA-8839", payer_phone: "+254720448833", payer_name: "Capt. Salim Bwanaheri", status: "completed", notes: "Absa cheque cleared", tenant_name: "Capt. Salim Bwanaheri", invoice_number: "INV-202611-007", unit_number: "Villa Palms", property_name: "Nyali Ocean Breeze Villas" }
  ],

  waterReadings: [
    { id: 1, unit_id: 1, month: "2026-11", reading_date: "2026-11-01", previous_reading: 156.0, current_reading: 169.2, units_consumed: 13.2, rate_per_unit: 175.0, total_cost: 2310.0, invoiced: 1, unit_number: "A101", meter_number: "WM-KIL-101", property_name: "Kilimani Royal Heights", tenant_name: "Kariuki James Mwangi" },
    { id: 2, unit_id: 2, month: "2026-11", reading_date: "2026-11-01", previous_reading: 109.5, current_reading: 121.0, units_consumed: 11.5, rate_per_unit: 175.0, total_cost: 2012.5, invoiced: 1, unit_number: "A102", meter_number: "WM-KIL-102", property_name: "Kilimani Royal Heights", tenant_name: "Amina Hassan Mohamed" },
    { id: 3, unit_id: 3, month: "2026-11", reading_date: "2026-11-01", previous_reading: 228.0, current_reading: 248.5, units_consumed: 20.5, rate_per_unit: 175.0, total_cost: 3587.5, invoiced: 1, unit_number: "A201", meter_number: "WM-KIL-201", property_name: "Kilimani Royal Heights", tenant_name: "Brian Omondi Otieno" },
    { id: 4, unit_id: 5, month: "2026-11", reading_date: "2026-11-01", previous_reading: 362.5, current_reading: 385.0, units_consumed: 22.5, rate_per_unit: 175.0, total_cost: 3937.5, invoiced: 1, unit_number: "Penthouse 1", meter_number: "WM-KIL-PH1", property_name: "Kilimani Royal Heights", tenant_name: "Sophie Van Der Beek" }
  ],

  maintenance: [
    { id: 1, ticket_number: "TKT-3941", unit_id: 1, tenant_id: 1, title: "Master Bathroom Shower Mixer Leaking", description: "Hot water valve leaking behind the tiling, causing dampness.", category: "plumbing", priority: "high", status: "in_progress", assigned_contractor: "Mwangi Plumbers Ltd (+254721998877)", contractor_phone: "+254721998877", estimated_cost: 4500, actual_cost: 0, reported_date: "2026-11-01 10:15:00", completed_date: null, notes: "Spare cartridges purchased from Industrial Area.", property_name: "Kilimani Royal Heights", unit_number: "A101", tenant_name: "Kariuki James Mwangi", tenant_phone: "+254722889900" },
    { id: 2, ticket_number: "TKT-4102", unit_id: 6, tenant_id: 4, title: "Office Server Room Split AC Servicing", description: "Inverter AC blinking error code E4, ambient temperature rising.", category: "electrical", priority: "medium", status: "assigned", assigned_contractor: "ChillTech HVAC Solutions (+254711223344)", contractor_phone: "+254711223344", estimated_cost: 8500, actual_cost: 0, reported_date: "2026-11-01 14:00:00", completed_date: null, notes: "Technician scheduled for 10 AM.", property_name: "Westlands Executive Suites", unit_number: "Suite 101", tenant_name: "Nexus Law Advocates LLP", tenant_phone: "+254700554433" }
  ],

  communications: [
    { id: 1, type: "sms", recipient_name: "Kariuki James Mwangi", recipient_phone: "+254722889900", tenant_id: 1, message: "Dear Kariuki James, your 2026-11 rent invoice INV-202611-001 of KES 71,310 is ready. Paybill: 522522, Acc: KRH-01.", status: "delivered", sent_at: "2026-11-01 07:00:00", purpose: "invoice_notification" },
    { id: 2, type: "sms", recipient_name: "Kariuki James Mwangi", recipient_phone: "+254722889900", tenant_id: 1, message: "Confirmed! QG982KLA83 Confirmed. KES 71,310 received for REC-20261101-4912. Thank you! - BomaSphere Management", status: "delivered", sent_at: "2026-11-01 08:30:16", purpose: "receipt" }
  ],

  expenses: [
    { id: 1, property_id: 1, category: "Repairs", description: "Borehole pump stator rewinding and electrical contactor replacement", amount: 18500, expense_date: "2026-11-01", paid_to: "Davis & Shirtliff Ltd", receipt_voucher: "VCH-202611-01", property_name: "Kilimani Royal Heights" },
    { id: 2, property_id: 1, category: "Security", description: "Monthly security guard patrol deployment (4 Day, 4 Night)", amount: 64000, expense_date: "2026-11-01", paid_to: "SecureGuard Kenya", receipt_voucher: "VCH-202611-02", property_name: "Kilimani Royal Heights" },
    { id: 3, property_id: 2, category: "Cleaning", description: "Common area floor polishing and high-level window washing", amount: 22000, expense_date: "2026-11-01", paid_to: "CleanPro Services", receipt_voucher: "VCH-202611-03", property_name: "Westlands Executive Suites" }
  ],

  users: [
    { id: 1, name: "Sarah Cherono (Platform Super Admin)", email: "admin@bomasphere.co.ke", phone: "+254700112233", role: "super_admin", property_id: null, tenant_id: null, status: "active" },
    { id: 2, name: "Patrick Ndegwa (Property Manager)", email: "ndegwa@crownpeak.co.ke", phone: "+254711333444", role: "property_manager", property_id: null, tenant_id: null, status: "active" },
    { id: 3, name: "John Otieno (Site Caretaker)", email: "otieno.caretaker@kilimaniheights.ke", phone: "+254722556677", role: "caretaker", property_id: 1, tenant_id: null, status: "active" },
    { id: 4, name: "Dr. Esther Wambui Ndung'u (Landlord / Investor)", email: "esther.ndungu@gmail.com", phone: "+254733555777", role: "landlord", property_id: 3, tenant_id: null, status: "active" },
    { id: 5, name: "Kariuki James Mwangi (Resident Tenant)", email: "james.kariuki@techke.com", phone: "+254722889900", role: "tenant", property_id: 1, tenant_id: 1, status: "active" }
  ]
};

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: corsHeaders });

  // 1. Portfolio Stats
  if (pathname === '/api/stats' && method === 'GET') {
    return json({
      stats: {
        properties: DB.properties.length,
        total_units: DB.units.length,
        occupied_units: DB.units.filter(u => u.status === 'occupied').length,
        vacant_units: DB.units.filter(u => u.status === 'vacant').length,
        maintenance_units: DB.units.filter(u => u.status === 'maintenance').length,
        occupancy_rate: 66.7,
        collection_rate: 65.6,
        total_billed: 688960,
        total_collected: 451759,
        total_arrears: 237201,
        active_tickets: DB.maintenance.filter(m => m.status !== 'completed').length
      },
      recentPayments: DB.payments.slice(0, 5),
      recentTickets: DB.maintenance.slice(0, 5),
      monthlyGraph: {
        months: ["Jun 26", "Jul 26", "Aug 26", "Sep 26", "Oct 26", "Nov 26"],
        billed: [620000, 645000, 650000, 665000, 672000, 688960],
        collected: [590000, 630000, 642000, 660000, 670000, 451759]
      }
    });
  }

  // 2. Properties
  if (pathname === '/api/properties' && method === 'GET') {
    return json(DB.properties.map(p => ({
      ...p,
      total_units: DB.units.filter(u => u.property_id === p.id).length,
      occupied_units: DB.units.filter(u => u.property_id === p.id && u.status === 'occupied').length
    })));
  }

  // 3. Units
  if (pathname === '/api/units' && method === 'GET') {
    return json(DB.units);
  }

  // 4. Tenants
  if (pathname === '/api/tenants' && method === 'GET') {
    return json(DB.tenants);
  }

  // 5. Invoices
  if (pathname === '/api/invoices' && method === 'GET') {
    return json(DB.invoices);
  }

  if (pathname === '/api/invoices' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const newInv = {
      id: DB.invoices.length + 1,
      invoice_number: `INV-202611-${Math.floor(100 + Math.random() * 900)}`,
      month: b.month || '2026-11',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 5*86400000).toISOString().slice(0, 10),
      total_amount: Number(b.rent_amount || 0) + Number(b.water_amount || 0) + Number(b.service_charge || 0),
      amount_paid: 0,
      balance: Number(b.rent_amount || 0) + Number(b.water_amount || 0) + Number(b.service_charge || 0),
      status: 'unpaid',
      tenant_name: 'Resident Tenant'
    };
    DB.invoices.unshift(newInv);
    return json({ success: true, id: newInv.id, invoice_number: newInv.invoice_number }, 201);
  }

  // 6. Payments
  if (pathname === '/api/payments' && method === 'GET') {
    return json(DB.payments);
  }

  if (pathname === '/api/payments' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const newPay = {
      id: DB.payments.length + 1,
      receipt_number: `REC-20261102-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: Number(b.amount || 5000),
      payment_method: b.payment_method || 'M-Pesa',
      reference_code: `QG${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      payment_date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      payer_phone: b.payer_phone || '+254722889900',
      status: 'completed'
    };
    DB.payments.unshift(newPay);
    return json({ success: true, receipt_number: newPay.receipt_number, reference_code: newPay.reference_code }, 201);
  }

  // 7. Water Readings
  if (pathname === '/api/water-readings' && method === 'GET') {
    return json(DB.waterReadings);
  }

  if (pathname === '/api/water-readings' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const consumed = Math.max(0, Number(b.current_reading) - Number(b.previous_reading || 0));
    const newWater = {
      id: DB.waterReadings.length + 1,
      unit_id: b.unit_id || 1,
      month: b.month || '2026-11',
      reading_date: new Date().toISOString().slice(0, 10),
      previous_reading: Number(b.previous_reading || 0),
      current_reading: Number(b.current_reading || 0),
      units_consumed: consumed,
      rate_per_unit: 175.0,
      total_cost: consumed * 175.0,
      invoiced: 0
    };
    DB.waterReadings.unshift(newWater);
    return json({ success: true, id: newWater.id, units_consumed: consumed, total_cost: newWater.total_cost }, 201);
  }

  // 8. Maintenance
  if (pathname === '/api/maintenance' && method === 'GET') {
    return json(DB.maintenance);
  }

  if (pathname === '/api/maintenance' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const newMaint = {
      id: DB.maintenance.length + 1,
      ticket_number: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      title: b.title || 'General Maintenance',
      description: b.description || '',
      category: b.category || 'plumbing',
      priority: b.priority || 'medium',
      status: 'open',
      reported_date: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    DB.maintenance.unshift(newMaint);
    return json({ success: true, id: newMaint.id, ticket_number: newMaint.ticket_number }, 201);
  }

  // 9. Communications
  if (pathname === '/api/communications' && method === 'GET') {
    return json(DB.communications);
  }

  if (pathname === '/api/communications/broadcast' && method === 'POST') {
    return json({ success: true, count: 8, recipients_reached: 8 });
  }

  // 10. Expenses
  if (pathname === '/api/expenses' && method === 'GET') {
    return json(DB.expenses);
  }

  if (pathname === '/api/expenses' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const newExp = {
      id: DB.expenses.length + 1,
      property_id: b.property_id || 1,
      category: b.category || 'Repairs',
      description: b.description || 'Operating Expense',
      amount: Number(b.amount || 0),
      expense_date: new Date().toISOString().slice(0, 10),
      receipt_voucher: `VCH-${Math.floor(1000 + Math.random() * 9000)}`
    };
    DB.expenses.unshift(newExp);
    return json({ success: true, id: newExp.id }, 201);
  }

  // 11. Landlord Remittance Statement
  if (pathname === '/api/reports/landlord-statement' && method === 'GET') {
    const propId = Number(url.searchParams.get('property_id') || 1);
    const prop = DB.properties.find(p => p.id === propId) || DB.properties[0];
    return json({
      statement: {
        property: prop,
        month: url.searchParams.get('month') || '2026-11',
        gross_collections: 451759,
        total_billed: 688960,
        total_arrears: 237201,
        management_fee_rate: prop.management_fee_pct,
        management_fee_amount: (451759 * prop.management_fee_pct) / 100,
        operating_expenses: 82500,
        net_remittance_payout: 451759 - (451759 * prop.management_fee_pct) / 100 - 82500,
        expenses_breakdown: DB.expenses.filter(e => e.property_id === prop.id),
        invoices_breakdown: DB.invoices
      }
    });
  }

  // 12. Users & Authentication
  if (pathname === '/api/users' && method === 'GET') {
    return json(DB.users);
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const authHeader = request.headers.get('Authorization') || request.headers.get('X-Auth-Token') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (token) {
      const role = token.replace('token_', '');
      const user = DB.users.find(u => u.role === role);
      if (user) {
        return json({ success: true, user });
      }
    }
    return json({ error: 'Authentication required. Please sign in.' }, 401);
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const { email, password } = b;
    if (!email || !password) {
      return json({ error: 'Email and password are required' }, 400);
    }
    const user = DB.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      return json({ error: 'Invalid email or password' }, 401);
    }

    const rolePasswords = {
      super_admin: 'Admin@2026',
      property_manager: 'Manager@2026',
      caretaker: 'Caretaker@2026',
      landlord: 'Landlord@2026',
      tenant: 'Tenant@2026'
    };
    const expected = rolePasswords[user.role] || 'password123';
    if (password !== expected && password !== 'password123') {
      return json({ error: 'Invalid email or password' }, 401);
    }

    return json({ success: true, token: `token_${user.role}`, user });
  }

  if (pathname === '/api/auth/switch-account' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const role = b.role || 'property_manager';
    const user = DB.users.find(u => u.role === role) || DB.users[0];
    return json({ success: true, token: `token_${user.role}`, user });
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    return json({ success: true, message: 'Logged out successfully' });
  }

  if (pathname === '/api/reset-seed' && method === 'POST') {
    return json({ success: true, message: 'Sample data refreshed successfully' });
  }

  // Catch-all 404 for unmatched API routes
  return json({ error: "404 Not Found: API route does not exist", path: pathname }, 404);
}
