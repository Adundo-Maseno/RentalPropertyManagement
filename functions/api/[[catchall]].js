/**
 * Cloudflare Pages Functions - Edge API Router for BomaSphere PMS
 * Handles /api/* requests natively at Cloudflare's Global Edge
 */

// Edge-ready seeded data store
const SEEDED_PROPERTIES = [
  { id: 1, name: "Kilimani Royal Heights", property_type: "residential", address: "Kindaruma Road", city: "Nairobi", landlord_name: "Dr. Esther Wambui Ndung'u", landlord_phone: "+254733555777", landlord_email: "esther.ndungu@gmail.com", management_fee_pct: 8.5, paybill_number: "882201", bank_name: "NCBA Bank", bank_account: "1002938472" },
  { id: 2, name: "Westlands Executive Suites", property_type: "commercial", address: "Muthithi Road", city: "Nairobi", landlord_name: "Mohamed Noor Aden", landlord_phone: "+254722113344", landlord_email: "noor.investments@gmail.com", management_fee_pct: 10.0, paybill_number: "882202", bank_name: "Standard Chartered", bank_account: "0102938475" },
  { id: 3, name: "Riverside Green Court", property_type: "mixed", address: "Riverside Drive", city: "Nairobi", landlord_name: "Dr. Esther Wambui Ndung'u", landlord_phone: "+254733555777", landlord_email: "esther.ndungu@gmail.com", management_fee_pct: 8.5, paybill_number: "882203", bank_name: "Equity Bank", bank_account: "0810293847" },
  { id: 4, name: "Nyali Ocean Breeze Villas", property_type: "residential", address: "Links Road", city: "Mombasa", landlord_name: "Capt. Salim Bwanaheri", landlord_phone: "+254720448833", landlord_email: "salim.bwanaheri@kpa.co.ke", management_fee_pct: 10.0, paybill_number: "882204", bank_name: "Absa Bank Kenya", bank_account: "0302938471" }
];

const SEEDED_UNITS = [
  { id: 1, property_id: 1, unit_number: "A101", floor: "1st", unit_type: "2 Bedroom Master Ensuite", base_rent: 65000, service_charge: 5000, garbage_fee: 500, status: "occupied", meter_number: "WTR-KIL-101", property_name: "Kilimani Royal Heights" },
  { id: 2, property_id: 1, unit_number: "A102", floor: "1st", unit_type: "2 Bedroom Master Ensuite", base_rent: 65000, service_charge: 5000, garbage_fee: 500, status: "occupied", meter_number: "WTR-KIL-102", property_name: "Kilimani Royal Heights" },
  { id: 3, property_id: 1, unit_number: "B201", floor: "2nd", unit_type: "3 Bedroom with DSQ", base_rent: 85000, service_charge: 7000, garbage_fee: 500, status: "occupied", meter_number: "WTR-KIL-201", property_name: "Kilimani Royal Heights" },
  { id: 4, property_id: 1, unit_number: "B202", floor: "2nd", unit_type: "3 Bedroom with DSQ", base_rent: 85000, service_charge: 7000, garbage_fee: 500, status: "vacant", meter_number: "WTR-KIL-202", property_name: "Kilimani Royal Heights" },
  { id: 5, property_id: 1, unit_number: "PH501", floor: "5th", unit_type: "4 Bedroom Penthouse", base_rent: 140000, service_charge: 10000, garbage_fee: 1000, status: "occupied", meter_number: "WTR-KIL-501", property_name: "Kilimani Royal Heights" },
  { id: 6, property_id: 2, unit_number: "W-301", floor: "3rd", unit_type: "Commercial Office (1,200 sqft)", base_rent: 95000, service_charge: 15000, garbage_fee: 1000, status: "occupied", meter_number: "WTR-WST-301", property_name: "Westlands Executive Suites" },
  { id: 7, property_id: 2, unit_number: "W-302", floor: "3rd", unit_type: "Commercial Office (800 sqft)", base_rent: 70000, service_charge: 12000, garbage_fee: 1000, status: "vacant", meter_number: "WTR-WST-302", property_name: "Westlands Executive Suites" },
  { id: 8, property_id: 3, unit_number: "R-12", floor: "1st", unit_type: "1 Bedroom Executive Apartment", base_rent: 55000, service_charge: 5000, garbage_fee: 500, status: "occupied", meter_number: "WTR-RIV-012", property_name: "Riverside Green Court" },
  { id: 9, property_id: 3, unit_number: "R-14", floor: "1st", unit_type: "1 Bedroom Executive Apartment", base_rent: 55000, service_charge: 5000, garbage_fee: 500, status: "vacant", meter_number: "WTR-RIV-014", property_name: "Riverside Green Court" },
  { id: 10, property_id: 3, unit_number: "R-33", floor: "3rd", unit_type: "3 Bedroom Garden Duplex", base_rent: 180000, service_charge: 15000, garbage_fee: 1000, status: "occupied", meter_number: "WTR-RIV-033", property_name: "Riverside Green Court" },
  { id: 11, property_id: 4, unit_number: "VILLA-01", floor: "Ground", unit_type: "4 Bedroom Beach Villa with Pool", base_rent: 220000, service_charge: 20000, garbage_fee: 2000, status: "vacant", meter_number: "WTR-NYA-001", property_name: "Nyali Ocean Breeze Villas" },
  { id: 12, property_id: 4, unit_number: "VILLA-02", floor: "Ground", unit_type: "3 Bedroom Garden Villa", base_rent: 120000, service_charge: 10000, garbage_fee: 1000, status: "occupied", meter_number: "WTR-NYA-002", property_name: "Nyali Ocean Breeze Villas" }
];

const SEEDED_USERS = [
  { id: 1, name: "Sarah Cherono (Platform Super Admin)", email: "admin@bomasphere.co.ke", phone: "+254700112233", role: "super_admin", property_id: null, tenant_id: null, status: "active" },
  { id: 2, name: "Patrick Ndegwa (Property Manager)", email: "ndegwa@crownpeak.co.ke", phone: "+254711333444", role: "property_manager", property_id: null, tenant_id: null, status: "active" },
  { id: 3, name: "John Otieno (Site Caretaker)", email: "otieno.caretaker@kilimaniheights.ke", phone: "+254722556677", role: "caretaker", property_id: 1, tenant_id: null, status: "active" },
  { id: 4, name: "Dr. Esther Wambui Ndung'u (Landlord / Investor)", email: "esther.ndungu@gmail.com", phone: "+254733555777", role: "landlord", property_id: 3, tenant_id: null, status: "active" },
  { id: 5, name: "Kariuki James Mwangi (Resident Tenant)", email: "james.kariuki@techke.com", phone: "+254722889900", role: "tenant", property_id: 1, tenant_id: 1, status: "active" }
];

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

  // Helper response
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: corsHeaders });

  // 1. Stats
  if (pathname === '/api/stats' && method === 'GET') {
    return json({
      stats: {
        properties: 4,
        total_units: 12,
        occupied_units: 8,
        vacant_units: 4,
        maintenance_units: 0,
        occupancy_rate: 66.7,
        total_billed: 688960,
        total_collected: 638960,
        total_arrears: 50000,
        active_tenants: 8
      },
      recentPayments: [
        { id: 1, receipt_number: "REC-20261101-4912", amount: 70000, payment_method: "M-Pesa", reference_code: "QG982KLA83", payment_date: "2026-11-01 08:30:15", tenant_name: "Kariuki James Mwangi", unit_number: "A101" },
        { id: 2, receipt_number: "REC-20261101-5129", amount: 70000, payment_method: "M-Pesa", reference_code: "QGA77XNM21", payment_date: "2026-11-01 09:14:02", tenant_name: "Amina Hassan Mohamed", unit_number: "A102" }
      ],
      recentTickets: [
        { id: 1, ticket_number: "TKT-3941", title: "Master Bathroom Shower Mixer Leaking", category: "plumbing", priority: "high", status: "assigned", property_name: "Kilimani Royal Heights", unit_number: "A101" }
      ],
      monthlyGraph: {
        months: ["Jun 26", "Jul 26", "Aug 26", "Sep 26", "Oct 26", "Nov 26"],
        billed: [620000, 645000, 650000, 665000, 672000, 688960],
        collected: [590000, 630000, 642000, 660000, 670000, 638960]
      }
    });
  }

  // 2. Properties
  if (pathname === '/api/properties' && method === 'GET') {
    return json(SEEDED_PROPERTIES.map(p => ({
      ...p,
      total_units: SEEDED_UNITS.filter(u => u.property_id === p.id).length,
      occupied_units: SEEDED_UNITS.filter(u => u.property_id === p.id && u.status === 'occupied').length
    })));
  }

  // 3. Units
  if (pathname === '/api/units' && method === 'GET') {
    return json(SEEDED_UNITS);
  }

  // 4. Users & Auth
  if (pathname === '/api/users' && method === 'GET') {
    return json(SEEDED_USERS);
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    return json({ success: true, user: SEEDED_USERS[1] }); // Default Property Manager
  }

  if (pathname === '/api/auth/switch-account' && method === 'POST') {
    let body = {};
    try { body = await request.json(); } catch(e) {}
    const role = body.role || 'property_manager';
    const user = SEEDED_USERS.find(u => u.role === role) || SEEDED_USERS[1];
    return json({ success: true, token: `token_${user.role}`, user });
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    let body = {};
    try { body = await request.json(); } catch(e) {}
    const user = SEEDED_USERS.find(u => u.email === body.email) || SEEDED_USERS[1];
    return json({ success: true, token: `token_${user.role}`, user });
  }

  // Default catchall for other endpoints
  return json({ success: true, message: "Cloudflare Edge Handler active" });
}

