/**
 * Cloudflare Pages Functions - Full Edge API Router for BomaSphere PMS
 * Implements full RESTful API for BomaSphere Property Management System at the Global Edge
 */

// Edge In-Memory Database (Fallback when Cloudflare D1 is not bound)
const DB = {
  properties: [],
  units: [],
  tenants: [],
  invoices: [],
  payments: [],
  waterReadings: [],
  maintenance: [],
  communications: [],
  expenses: [],
  users: [
    { id: 1, name: "Sarah Cherono (Platform Super Admin)", email: "admin@bomasphere.co.ke", phone: "+254700112233", role: "super_admin", property_id: null, tenant_id: null, status: "active", session_token: "token_super_admin" },
    { id: 2, name: "Patrick Ndegwa (Property Manager)", email: "ndegwa@crownpeak.co.ke", phone: "+254711333444", role: "property_manager", property_id: null, tenant_id: null, status: "active", session_token: "token_property_manager" },
    { id: 3, name: "John Otieno (Site Caretaker)", email: "otieno.caretaker@kilimaniheights.ke", phone: "+254722556677", role: "caretaker", property_id: null, tenant_id: null, status: "active", session_token: "token_caretaker" },
    { id: 4, name: "Dr. Esther Wambui Ndung'u (Landlord / Investor)", email: "esther.ndungu@gmail.com", phone: "+254733555777", role: "landlord", property_id: null, tenant_id: null, status: "active", session_token: "token_landlord" },
    { id: 5, name: "Kariuki James Mwangi (Resident Tenant)", email: "james.kariuki@techke.com", phone: "+254722889900", role: "tenant", property_id: null, tenant_id: null, status: "active", session_token: "token_tenant" }
  ],
  iotDevices: [],
  leakAlerts: [],
  fundis: [],
  escrows: [],
  vettings: [],
  etimsRecords: [],
  viewingLeads: [],
  leaseAgreements: [],
  inspections: [],
  visitorPasses: [],
  amenities: [],
  amenityBookings: []
};

function resolveRequestUser(request) {
  const authHeader = request.headers.get('authorization') || '';
  const tokenHeader = request.headers.get('x-auth-token') || '';
  const roleHeader = request.headers.get('x-role') || '';
  let token = tokenHeader;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (token) {
    const user = DB.users.find(u => u.session_token === token || `token_${u.role}` === token);
    if (user) return user;
    if (token.startsWith('token_')) {
      const r = token.replace('token_', '');
      const uByRole = DB.users.find(u => u.role === r);
      if (uByRole) return uByRole;
    }
  }
  if (roleHeader) {
    const uByRole = DB.users.find(u => u.role === roleHeader);
    if (uByRole) return uByRole;
  }
  return null;
}

// ====================================================================
// Cloudflare D1 Serverless SQL Schema (Auto-Migration Payload)
// ====================================================================
const D1_SCHEMA_SQL = "-- ====================================================================\n-- BomaSphere PMS - Cloudflare D1 Production Schema\n-- Tables ordered strictly by parent-child dependency\n-- ====================================================================\n\nCREATE TABLE IF NOT EXISTS properties (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      name TEXT NOT NULL,\n      property_type TEXT NOT NULL,\n      address TEXT NOT NULL,\n      city TEXT NOT NULL,\n      landlord_name TEXT NOT NULL,\n      landlord_phone TEXT NOT NULL,\n      landlord_email TEXT NOT NULL,\n      management_fee_pct REAL DEFAULT 10.0,\n      paybill_number TEXT,\n      bank_name TEXT,\n      bank_account TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS units (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,\n      unit_number TEXT NOT NULL,\n      floor TEXT DEFAULT 'Ground',\n      unit_type TEXT NOT NULL,\n      base_rent REAL NOT NULL,\n      service_charge REAL DEFAULT 0.0,\n      garbage_fee REAL DEFAULT 0.0,\n      status TEXT DEFAULT 'vacant',\n      meter_number TEXT,\n      notes TEXT\n    );\n\nCREATE TABLE IF NOT EXISTS tenants (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      name TEXT NOT NULL,\n      phone TEXT NOT NULL,\n      email TEXT,\n      id_number TEXT,\n      emergency_contact_name TEXT,\n      emergency_contact_phone TEXT,\n      status TEXT DEFAULT 'active',\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS leases (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      start_date DATE NOT NULL,\n      end_date DATE NOT NULL,\n      monthly_rent REAL NOT NULL,\n      deposit_paid REAL DEFAULT 0.0,\n      water_deposit REAL DEFAULT 0.0,\n      status TEXT DEFAULT 'active',\n      terms TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS invoices (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      invoice_number TEXT UNIQUE NOT NULL,\n      lease_id INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      month TEXT NOT NULL,\n      issue_date DATE NOT NULL,\n      due_date DATE NOT NULL,\n      rent_amount REAL NOT NULL,\n      water_amount REAL DEFAULT 0.0,\n      garbage_amount REAL DEFAULT 0.0,\n      service_charge REAL DEFAULT 0.0,\n      late_fee REAL DEFAULT 0.0,\n      other_charges REAL DEFAULT 0.0,\n      total_amount REAL NOT NULL,\n      amount_paid REAL DEFAULT 0.0,\n      balance REAL NOT NULL,\n      status TEXT DEFAULT 'unpaid',\n      notes TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS payments (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      receipt_number TEXT UNIQUE NOT NULL,\n      invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      amount REAL NOT NULL,\n      payment_date DATETIME NOT NULL,\n      payment_method TEXT NOT NULL,\n      reference_code TEXT,\n      payer_phone TEXT,\n      payer_name TEXT,\n      status TEXT DEFAULT 'completed',\n      notes TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS water_readings (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      month TEXT NOT NULL,\n      reading_date DATE NOT NULL,\n      previous_reading REAL NOT NULL,\n      current_reading REAL NOT NULL,\n      units_consumed REAL NOT NULL,\n      rate_per_unit REAL NOT NULL,\n      total_cost REAL NOT NULL,\n      invoiced INTEGER DEFAULT 0\n    );\n\nCREATE TABLE IF NOT EXISTS maintenance_requests (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      ticket_number TEXT UNIQUE NOT NULL,\n      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,\n      title TEXT NOT NULL,\n      description TEXT NOT NULL,\n      category TEXT NOT NULL,\n      priority TEXT DEFAULT 'medium',\n      status TEXT DEFAULT 'open',\n      assigned_contractor TEXT,\n      contractor_phone TEXT,\n      estimated_cost REAL DEFAULT 0.0,\n      actual_cost REAL DEFAULT 0.0,\n      requested_date DATETIME DEFAULT CURRENT_TIMESTAMP,\n      completed_date DATETIME,\n      notes TEXT\n    );\n\nCREATE TABLE IF NOT EXISTS communications (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      type TEXT NOT NULL,\n      recipient_name TEXT NOT NULL,\n      recipient_phone TEXT NOT NULL,\n      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,\n      message TEXT NOT NULL,\n      status TEXT DEFAULT 'delivered',\n      purpose TEXT,\n      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS expenses (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,\n      category TEXT NOT NULL,\n      description TEXT NOT NULL,\n      amount REAL NOT NULL,\n      expense_date DATE NOT NULL,\n      paid_to TEXT,\n      receipt_voucher TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS users (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      name TEXT NOT NULL,\n      email TEXT UNIQUE NOT NULL,\n      phone TEXT,\n      role TEXT NOT NULL,\n      property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,\n      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,\n      status TEXT DEFAULT 'active',\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    , password_hash TEXT DEFAULT 'password123', session_token TEXT);\n\nCREATE TABLE IF NOT EXISTS iot_devices (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      meter_number TEXT UNIQUE NOT NULL,\n      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,\n      unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,\n      device_type TEXT DEFAULT 'Ultrasonic Water Meter',\n      battery_pct INTEGER DEFAULT 98,\n      signal_rssi INTEGER DEFAULT -78,\n      flow_rate_lph REAL DEFAULT 0.0,\n      total_cubic_meters REAL DEFAULT 142.5,\n      valve_status TEXT DEFAULT 'open',\n      last_telemetry_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS leak_alerts (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      device_id INTEGER NOT NULL REFERENCES iot_devices(id) ON DELETE CASCADE,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      severity TEXT DEFAULT 'warning',\n      title TEXT NOT NULL,\n      message TEXT NOT NULL,\n      flow_detected_lph REAL NOT NULL,\n      status TEXT DEFAULT 'active',\n      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS artisan_marketplace (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      name TEXT NOT NULL,\n      trade TEXT NOT NULL,\n      phone TEXT NOT NULL,\n      rating REAL DEFAULT 4.8,\n      jobs_completed INTEGER DEFAULT 24,\n      id_verified INTEGER DEFAULT 1,\n      daily_rate REAL DEFAULT 2500,\n      availability TEXT DEFAULT 'available',\n      location TEXT DEFAULT 'Nairobi'\n    );\n\nCREATE TABLE IF NOT EXISTS maintenance_escrows (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      ticket_id INTEGER NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,\n      fundi_id INTEGER REFERENCES artisan_marketplace(id) ON DELETE SET NULL,\n      amount REAL NOT NULL,\n      status TEXT DEFAULT 'held',\n      b2c_disbursement_ref TEXT,\n      milestone_desc TEXT,\n      released_at DATETIME,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS tenant_vettings (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      applicant_name TEXT NOT NULL,\n      phone TEXT NOT NULL,\n      email TEXT,\n      id_number TEXT,\n      requested_unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,\n      monthly_income REAL NOT NULL,\n      crb_score INTEGER NOT NULL,\n      risk_category TEXT NOT NULL,\n      rent_to_income_pct REAL NOT NULL,\n      recommendation TEXT NOT NULL,\n      kra_pin_verified INTEGER DEFAULT 1,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS viewing_leads (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      prospect_name TEXT NOT NULL,\n      phone TEXT NOT NULL,\n      email TEXT,\n      preferred_date DATE NOT NULL,\n      time_slot TEXT NOT NULL,\n      status TEXT DEFAULT 'pending',\n      notes TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS estate_amenities (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,\n      name TEXT NOT NULL,\n      description TEXT,\n      category TEXT DEFAULT 'Recreation',\n      capacity INTEGER DEFAULT 20,\n      hourly_fee REAL DEFAULT 0.0,\n      photo TEXT,\n      status TEXT DEFAULT 'available'\n    );\n\nCREATE TABLE IF NOT EXISTS amenity_bookings (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      booking_reference TEXT UNIQUE NOT NULL,\n      amenity_id INTEGER NOT NULL REFERENCES estate_amenities(id) ON DELETE CASCADE,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      booking_date DATE NOT NULL,\n      start_time TEXT NOT NULL,\n      end_time TEXT NOT NULL,\n      total_fee REAL DEFAULT 0.0,\n      status TEXT DEFAULT 'confirmed',\n      invoiced INTEGER DEFAULT 0,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS visitor_passes (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      pass_code TEXT UNIQUE NOT NULL,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      visitor_name TEXT NOT NULL,\n      visitor_phone TEXT NOT NULL,\n      vehicle_plate TEXT,\n      valid_date DATE NOT NULL,\n      time_slot TEXT NOT NULL,\n      status TEXT DEFAULT 'active',\n      checked_in_at DATETIME,\n      checked_out_at DATETIME,\n      qr_data TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS property_inspections (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,\n      inspection_type TEXT NOT NULL,\n      inspection_date DATE NOT NULL,\n      inspector_name TEXT NOT NULL,\n      checklist_json TEXT NOT NULL,\n      damages_total REAL DEFAULT 0.0,\n      deposit_held REAL DEFAULT 0.0,\n      unpaid_utility_arrears REAL DEFAULT 0.0,\n      net_deposit_refund REAL DEFAULT 0.0,\n      status TEXT DEFAULT 'completed',\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS lease_agreements (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      lease_id INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      agreement_code TEXT UNIQUE NOT NULL,\n      rent_amount REAL NOT NULL,\n      deposit_amount REAL NOT NULL,\n      start_date DATE NOT NULL,\n      end_date DATE NOT NULL,\n      terms_clauses TEXT,\n      tenant_signature TEXT,\n      tenant_signed_at DATETIME,\n      manager_signature TEXT,\n      manager_signed_at DATETIME,\n      status TEXT DEFAULT 'pending_tenant',\n      contract_hash TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS etims_records (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,\n      control_code TEXT UNIQUE NOT NULL,\n      qr_code_url TEXT,\n      tax_type TEXT DEFAULT 'MRI_7.5_PCT',\n      taxable_amount REAL NOT NULL,\n      tax_payable REAL NOT NULL,\n      kra_status TEXT DEFAULT 'transmitted',\n      validated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\n-- ====================================================================\n-- Initial System RBAC Users (Preserved Passwords & Session Tokens)\n-- ====================================================================\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Grace Wambui (Test Agent)', 'grace.test@bomasphere.co.ke', 'password123', '+254711998877', 'caretaker', NULL, NULL, 'token_caretaker', 'active');\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Sarah Cherono (Platform Super Admin)', 'admin@bomasphere.co.ke', '653a8cd6d79b4b826260601d51de295d:7314d101be03089baba43ecba759ae9b10d1cc151270cd7523bb3ef53a31bbb0ff0b0dc46f219f0e28f032166df835de6eb10f3778c752a5461b4bd96dc1f987', '+254700112233', 'super_admin', NULL, NULL, 'token_super_admin', 'active');\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Patrick Ndegwa (Property Manager)', 'ndegwa@crownpeak.co.ke', '3f2333516c39ca85d328860684cbcf52:bd58369db88a81bb73b3e4eb198d9a9ebca45c3a2ea318e2b16d0ced72baf0fb1be7e672a0b8375c595a47974ca77a4c8285b1fe2f9f06217dcab4e9a36a9b09', '+254711333444', 'property_manager', NULL, NULL, 'token_property_manager', 'active');\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('John Otieno (Site Caretaker)', 'otieno.caretaker@kilimaniheights.ke', '5e0138938d1b0c36d2ac29442e610d38:05b6ab17262c34da6844f8778f978fafb7a707203ecb3bdcfad70b46e9b2c046d1d39f8c3a102a068f76846368c42f85bb4043884360c082b43f14b5f4edf8a7', '+254722556677', 'caretaker', NULL, NULL, 'token_caretaker', 'active');\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Dr. Esther Wambui Ndung''u (Landlord / Investor)', 'esther.ndungu@gmail.com', '449aa4629b48c5ca356a47ddd859cbb2:c14b7117c51814abdf8ed699da2234e9074dba06ecf5bf32dcba3a4ef673b2eddac10540a5b8f14d2a8a0774ed02579c78b4e9fb53f3fd1fd44f220b4778b9f5', '+254733555777', 'landlord', NULL, NULL, 'token_landlord', 'active');\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Kariuki James Mwangi (Resident Tenant)', 'james.kariuki@techke.com', '0fb18377ade2b4ace7746c9f1b3059c9:03c060e8ce011f858a56096162dd8c1f567117cafb8ee520cdb20de3fc86b9eb0c4ffd4b793043514e181de55729151faa8004f9125c583546c183428012e219', '+254722889900', 'tenant', NULL, NULL, 'token_tenant', 'active');\n";

// Helper to iteratively provision D1 tables and initial RBAC users
async function ensureD1Schema(db) {
  try {
    const rawStatements = D1_SCHEMA_SQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const raw of rawStatements) {
      const stmt = raw.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim();
      if (stmt.length > 0) {
        try {
          await db.prepare(stmt).run();
        } catch (e) {
          // Ignore table already exists or constraint notices
        }
      }
    }
    try { await db.prepare("ALTER TABLE properties ADD COLUMN image_url TEXT").run(); } catch (e) {}
    try { await db.prepare("ALTER TABLE units ADD COLUMN image_url TEXT").run(); } catch (e) {}
    
    try {
      await db.prepare("INSERT OR IGNORE INTO artisan_marketplace (id, name, trade, phone, rating, jobs_completed, daily_rate, availability, location) VALUES (1, 'QuickFix Plumbers Ltd', 'Plumbing & Drainage', '+254711223344', 4.9, 48, 2500, 'available', 'Nairobi')").run();
      await db.prepare("INSERT OR IGNORE INTO artisan_marketplace (id, name, trade, phone, rating, jobs_completed, daily_rate, availability, location) VALUES (2, 'Voltage Masters Electricals', 'Electrical & Wiring', '+254722334455', 4.8, 36, 3000, 'available', 'Nairobi')").run();
      await db.prepare("INSERT OR IGNORE INTO artisan_marketplace (id, name, trade, phone, rating, jobs_completed, daily_rate, availability, location) VALUES (3, 'Apex Carpentry & Locks', 'Carpentry & Fittings', '+254733445566', 4.7, 29, 2200, 'available', 'Nairobi')").run();
      await db.prepare("INSERT OR IGNORE INTO estate_amenities (id, property_id, name, description, category, capacity, hourly_fee, status) VALUES (1, 1, 'Rooftop BBQ & Sunset Lounge', 'Panoramic view terrace with gas grills and outdoor seating', 'Recreation', 25, 1500, 'available')").run();
      await db.prepare("INSERT OR IGNORE INTO estate_amenities (id, property_id, name, description, category, capacity, hourly_fee, status) VALUES (2, 1, 'Resident Clubhouse & Gym', 'Full fitness center with cardio equipment and clubhouse lounge', 'Fitness', 15, 0, 'available')").run();
      await db.prepare("INSERT OR IGNORE INTO iot_devices (id, meter_number, property_id, unit_id, device_type, battery_pct, signal_rssi, flow_rate_lph, total_cubic_meters, valve_status) VALUES (1, 'WM-NA2', 1, 1, 'Ultrasonic Smart Meter', 98, -74, 0.0, 14.8, 'open')").run();
    } catch (seedErr) {
      // Ignore unique constraints
    }

    console.log('✅ Cloudflare D1 tables and RBAC users verified and initialized.');
  } catch (err) {
    console.error('ensureD1Schema error:', err);
  }
}

// ====================================================================
// Cloudflare D1 Native Database Router (Asynchronous SQL at the Edge)
// ====================================================================
async function handleD1(context, json, corsHeaders) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // Manual one-click init endpoint
  if (pathname === '/api/init-d1' || pathname === '/api/d1/init') {
    await ensureD1Schema(db);
    return json({ success: true, message: 'D1 schema and RBAC users successfully initialized!' });
  }

  // 1. Auto-provision D1 tables and RBAC users if database is fresh or columns missing
  try {
    const usersTable = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
    const hasImageCol = await db.prepare("SELECT image_url FROM units LIMIT 1").first().catch(() => null);
    if (!usersTable || hasImageCol === null) {
      await ensureD1Schema(db);
    }
  } catch (schemaErr) {
    await ensureD1Schema(db);
  }

  const getUser = async () => {
    const authHeader = request.headers.get('authorization') || '';
    const tokenHeader = request.headers.get('x-auth-token') || '';
    const roleHeader = request.headers.get('x-role') || '';
    let token = tokenHeader;
    if (authHeader.startsWith('Bearer ')) token = authHeader.slice(7).trim();
    try {
      if (token) {
        const u = await db.prepare('SELECT * FROM users WHERE session_token = ? OR session_token = ?').bind(token, token.startsWith('token_') ? token : 'token_' + token).first();
        if (u) return u;
        if (token.startsWith('token_')) {
          const uRole = await db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').bind(token.replace('token_', '')).first();
          if (uRole) return uRole;
        }
      }
      if (roleHeader) {
        return await db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').bind(roleHeader).first();
      }
    } catch (userErr) {
      if (userErr.message && userErr.message.includes('no such table')) {
        await ensureD1Schema(db);
        return DB.users.find(u => u.role === (roleHeader || 'super_admin')) || DB.users[0];
      }
    }
    return null;
  };

  try {
    // 1. Auth Me
    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = await getUser();
      return json({ user: user || null });
    }

    // 2. Auth Login
    if (pathname === '/api/auth/login' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { email, password } = b;
      if (!email || !password) return json({ error: 'Email and password are required' }, 400);
      const user = await db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').bind(email.trim()).first();
      if (!user) return json({ error: 'Invalid email or password' }, 401);
      const rolePasswords = {
        super_admin: 'Admin@2026',
        property_manager: 'Manager@2026',
        caretaker: 'Caretaker@2026',
        landlord: 'Landlord@2026',
        tenant: 'Tenant@2026'
      };
      const expected = rolePasswords[user.role] || 'password123';
      const isMatch = (password === expected) || (password === 'password123') || (user.password_hash && password === user.password_hash);
      if (!isMatch) {
        return json({ error: 'Invalid email or password' }, 401);
      }
      const token = user.session_token || `token_${user.role}`;
      return json({ success: true, token, user });
    }

    // 3. Auth Switch Account
    if (pathname === '/api/auth/switch-account' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const user = await db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').bind(b.role || 'super_admin').first();
      if (!user) return json({ error: 'User not found' }, 404);
      return json({ success: true, token: user.session_token || `token_${user.role}`, user });
    }

    // 4. Auth Logout
    if (pathname === '/api/auth/logout' && method === 'POST') {
      return json({ success: true, message: 'Logged out successfully' });
    }

    // 5. Portfolio Stats
    if (pathname === '/api/stats' && method === 'GET') {
      const pCount = (await db.prepare('SELECT count(*) as c FROM properties').first())?.c || 0;
      const uStats = await db.prepare('SELECT count(*) as total, sum(case when status="occupied" then 1 else 0 end) as occupied, sum(case when status="vacant" then 1 else 0 end) as vacant, sum(case when status="maintenance" then 1 else 0 end) as maintenance FROM units').first();
      const iStats = await db.prepare('SELECT coalesce(sum(total_amount), 0) as billed, coalesce(sum(amount_paid), 0) as collected, coalesce(sum(balance), 0) as arrears FROM invoices').first();
      const tCount = (await db.prepare('SELECT count(*) as c FROM maintenance_requests WHERE status != "completed"').first())?.c || 0;
      const totalUnits = uStats?.total || 0;
      const occupiedUnits = uStats?.occupied || 0;
      const occRate = totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : '0.0';
      const collRate = Number(iStats?.billed) > 0 ? ((Number(iStats.collected) / Number(iStats.billed)) * 100).toFixed(1) : '0.0';
      const recentPayments = (await db.prepare('SELECT p.*, t.name as tenant_name, u.unit_number FROM payments p LEFT JOIN tenants t ON p.tenant_id = t.id LEFT JOIN leases l ON t.id = l.tenant_id LEFT JOIN units u ON l.unit_id = u.id ORDER BY p.id DESC LIMIT 5').all()).results || [];
      const recentTickets = (await db.prepare('SELECT m.*, u.unit_number FROM maintenance_requests m LEFT JOIN units u ON m.unit_id = u.id ORDER BY m.id DESC LIMIT 5').all()).results || [];
      return json({
        stats: {
          properties: pCount,
          total_units: totalUnits,
          occupied_units: occupiedUnits,
          vacant_units: uStats?.vacant || 0,
          maintenance_units: uStats?.maintenance || 0,
          occupancy_rate: Number(occRate),
          collection_rate: Number(collRate),
          total_billed: Number(iStats?.billed || 0),
          total_collected: Number(iStats?.collected || 0),
          total_arrears: Number(iStats?.arrears || 0),
          active_tickets: tCount
        },
        recentPayments,
        recentTickets
      });
    }

    // 6. Properties
    if (pathname === '/api/properties' && method === 'GET') {
      const rows = (await db.prepare(`
        SELECT p.*, count(u.id) as total_units, sum(case when u.status = 'occupied' then 1 else 0 end) as occupied_units
        FROM properties p
        LEFT JOIN units u ON p.id = u.property_id
        GROUP BY p.id
        ORDER BY p.id ASC
      `).all()).results || [];
      return json(rows);
    }
    if (pathname === '/api/properties' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      if (!b.name) return json({ error: 'Property name is required' }, 400);
      const res = await db.prepare(`
        INSERT INTO properties (name, property_type, address, city, landlord_name, landlord_phone, landlord_email, management_fee_pct, paybill_number, bank_name, bank_account, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        b.name, b.property_type || 'Residential Apartments', b.address || '', b.city || 'Nairobi',
        b.landlord_name || 'Landlord', b.landlord_phone || '+254700000000', b.landlord_email || 'landlord@bomasphere.co.ke',
        Number(b.management_fee_pct || 10.0), b.paybill_number || null, b.bank_name || null, b.bank_account || null,
        b.image_url || null
      ).run();
      const id = res.meta?.last_row_id;
      const created = await db.prepare('SELECT * FROM properties WHERE id = ?').bind(id).first();
      return json({ success: true, id, property: created }, 201);
    }
    if ((pathname === '/api/properties' || pathname.startsWith('/api/properties/')) && method === 'PUT') {
      const b = await request.json().catch(() => ({}));
      const pathId = pathname.startsWith('/api/properties/') ? pathname.split('/')[3] : null;
      const id = pathId || url.searchParams.get('id') || b.id;
      if (!id) return json({ error: 'Property ID required' }, 400);
      await db.prepare(`
        UPDATE properties SET
          name = coalesce(?, name),
          property_type = coalesce(?, property_type),
          address = coalesce(?, address),
          city = coalesce(?, city),
          landlord_name = coalesce(?, landlord_name),
          landlord_phone = coalesce(?, landlord_phone),
          landlord_email = coalesce(?, landlord_email),
          management_fee_pct = coalesce(?, management_fee_pct),
          paybill_number = coalesce(?, paybill_number),
          bank_name = coalesce(?, bank_name),
          bank_account = coalesce(?, bank_account),
          image_url = coalesce(?, image_url)
        WHERE id = ?
      `).bind(
        b.name || null, b.property_type || null, b.address || null, b.city || null,
        b.landlord_name || null, b.landlord_phone || null, b.landlord_email || null,
        b.management_fee_pct !== undefined ? Number(b.management_fee_pct) : null,
        b.paybill_number || null, b.bank_name || null, b.bank_account || null,
        b.image_url || null, Number(id)
      ).run();
      const updated = await db.prepare('SELECT * FROM properties WHERE id = ?').bind(Number(id)).first();
      return json({ success: true, property: updated });
    }
    if ((pathname === '/api/properties' || pathname.startsWith('/api/properties/')) && method === 'DELETE') {
      const pathId = pathname.startsWith('/api/properties/') ? pathname.split('/')[3] : null;
      const id = pathId || url.searchParams.get('id');
      if (!id) return json({ error: 'Property ID required' }, 400);
      await db.prepare('DELETE FROM properties WHERE id = ?').bind(Number(id)).run();
      return json({ success: true, message: 'Property deleted' });
    }

    // 7. Units
    if (pathname === '/api/units' && method === 'GET') {
      const rows = (await db.prepare(`
        SELECT u.*, p.name as property_name
        FROM units u
        LEFT JOIN properties p ON u.property_id = p.id
        ORDER BY u.id ASC
      `).all()).results || [];
      return json(rows);
    }
    if (pathname === '/api/units' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      if (!b.property_id || !b.unit_number) return json({ error: 'Property ID and unit number are required' }, 400);
      const res = await db.prepare(`
        INSERT INTO units (property_id, unit_number, floor, unit_type, base_rent, service_charge, garbage_fee, status, meter_number, notes, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        Number(b.property_id), b.unit_number, b.floor || 'Ground', b.unit_type || '2-Bedroom',
        Number(b.base_rent || 0), Number(b.service_charge || 0), Number(b.garbage_fee || 0),
        b.status || 'vacant', b.meter_number || null, b.notes || null,
        b.image_url || null
      ).run();
      const id = res.meta?.last_row_id;
      const created = await db.prepare('SELECT u.*, p.name as property_name FROM units u LEFT JOIN properties p ON u.property_id = p.id WHERE u.id = ?').bind(id).first();
      return json({ success: true, id, unit: created }, 201);
    }
    if ((pathname === '/api/units' || pathname.startsWith('/api/units/')) && method === 'PUT') {
      const b = await request.json().catch(() => ({}));
      const pathId = pathname.startsWith('/api/units/') ? pathname.split('/')[3] : null;
      const id = pathId || url.searchParams.get('id') || b.id;
      if (!id) return json({ error: 'Unit ID required' }, 400);
      await db.prepare(`
        UPDATE units SET
          property_id = coalesce(?, property_id),
          unit_number = coalesce(?, unit_number),
          floor = coalesce(?, floor),
          unit_type = coalesce(?, unit_type),
          base_rent = coalesce(?, base_rent),
          service_charge = coalesce(?, service_charge),
          garbage_fee = coalesce(?, garbage_fee),
          status = coalesce(?, status),
          meter_number = coalesce(?, meter_number),
          notes = coalesce(?, notes),
          image_url = coalesce(?, image_url)
        WHERE id = ?
      `).bind(
        b.property_id !== undefined ? Number(b.property_id) : null,
        b.unit_number || null, b.floor || null, b.unit_type || null,
        b.base_rent !== undefined ? Number(b.base_rent) : null,
        b.service_charge !== undefined ? Number(b.service_charge) : null,
        b.garbage_fee !== undefined ? Number(b.garbage_fee) : null,
        b.status || null, b.meter_number || null, b.notes || null,
        b.image_url || null,
        Number(id)
      ).run();
      const updated = await db.prepare('SELECT u.*, p.name as property_name FROM units u LEFT JOIN properties p ON u.property_id = p.id WHERE u.id = ?').bind(Number(id)).first();
      return json({ success: true, unit: updated });
    }
    if ((pathname === '/api/units' || pathname.startsWith('/api/units/')) && method === 'DELETE') {
      const pathId = pathname.startsWith('/api/units/') ? pathname.split('/')[3] : null;
      const id = pathId || url.searchParams.get('id');
      if (!id) return json({ error: 'Unit ID required' }, 400);
      await db.prepare('DELETE FROM units WHERE id = ?').bind(Number(id)).run();
      return json({ success: true, message: 'Unit deleted' });
    }

    // 8. Tenants
    if (pathname === '/api/tenants' && method === 'GET') {
      const rows = (await db.prepare(`
        SELECT t.*, u.unit_number, p.name as property_name, coalesce(sum(i.balance), 0) as balance
        FROM tenants t
        LEFT JOIN leases l ON t.id = l.tenant_id AND l.status = 'active'
        LEFT JOIN units u ON l.unit_id = u.id
        LEFT JOIN properties p ON u.property_id = p.id
        LEFT JOIN invoices i ON t.id = i.tenant_id AND i.status != 'paid'
        GROUP BY t.id
        ORDER BY t.id ASC
      `).all()).results || [];
      return json(rows);
    }
    if (pathname === '/api/tenants' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      if (!b.name || !b.phone) return json({ error: 'Name and phone are required' }, 400);
      const res = await db.prepare(`
        INSERT INTO tenants (name, phone, email, id_number, emergency_contact_name, emergency_contact_phone, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        b.name, b.phone, b.email || null, b.id_number || null,
        b.emergency_contact_name || null, b.emergency_contact_phone || null, b.status || 'active'
      ).run();
      const id = res.meta?.last_row_id;
      const created = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(id).first();
      return json({ success: true, id, tenant_id: id, tenant: created }, 201);
    }
    if ((pathname === '/api/tenants' || pathname.startsWith('/api/tenants/')) && method === 'PUT') {
      const b = await request.json().catch(() => ({}));
      const pathId = pathname.startsWith('/api/tenants/') ? pathname.split('/')[3] : null;
      const id = pathId || url.searchParams.get('id') || b.id;
      if (!id) return json({ error: 'Tenant ID required' }, 400);
      await db.prepare(`
        UPDATE tenants SET
          name = coalesce(?, name),
          phone = coalesce(?, phone),
          email = coalesce(?, email),
          id_number = coalesce(?, id_number),
          emergency_contact_name = coalesce(?, emergency_contact_name),
          emergency_contact_phone = coalesce(?, emergency_contact_phone),
          status = coalesce(?, status)
        WHERE id = ?
      `).bind(
        b.name || null, b.phone || null, b.email || null, b.id_number || null,
        b.emergency_contact_name || null, b.emergency_contact_phone || null, b.status || null, Number(id)
      ).run();
      const updated = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(Number(id)).first();
      return json({ success: true, tenant: updated });
    }
    if ((pathname === '/api/tenants' || pathname.startsWith('/api/tenants/')) && method === 'DELETE') {
      const pathId = pathname.startsWith('/api/tenants/') ? pathname.split('/')[3] : null;
      const id = pathId || url.searchParams.get('id');
      if (!id) return json({ error: 'Tenant ID required' }, 400);
      await db.prepare('DELETE FROM tenants WHERE id = ?').bind(Number(id)).run();
      return json({ success: true, message: 'Tenant deleted' });
    }

    // 9. Leases
    if (pathname === '/api/leases' && method === 'GET') {
      const rows = (await db.prepare(`
        SELECT l.*, t.name as tenant_name, t.phone as tenant_phone, u.unit_number, p.name as property_name
        FROM leases l
        JOIN tenants t ON l.tenant_id = t.id
        JOIN units u ON l.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        ORDER BY l.id DESC
      `).all()).results || [];
      return json(rows);
    }
    if (pathname === '/api/leases' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const unit = await db.prepare('SELECT status FROM units WHERE id = ?').bind(Number(b.unit_id)).first();
      if (unit && unit.status === 'occupied') {
        return json({ error: 'Cannot lease unit: This unit is already occupied by an active tenant.' }, 400);
      }
      const res = await db.prepare(`
        INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_paid, water_deposit, status, terms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        Number(b.unit_id), Number(b.tenant_id), b.start_date, b.end_date,
        Number(b.monthly_rent || 0), Number(b.deposit_paid || 0), Number(b.water_deposit || 0),
        b.status || 'active', b.terms || null
      ).run();
      await db.prepare("UPDATE units SET status = 'occupied' WHERE id = ?").bind(Number(b.unit_id)).run();
      const id = res.meta?.last_row_id;
      return json({ success: true, id, message: 'Lease created successfully' }, 201);
    }

    // 10. Invoices
    if (pathname === '/api/invoices' && method === 'GET') {
      const rows = (await db.prepare(`
        SELECT i.*, t.name as tenant_name, t.phone as tenant_phone, u.unit_number, p.name as property_name
        FROM invoices i
        JOIN tenants t ON i.tenant_id = t.id
        JOIN units u ON i.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        ORDER BY i.id DESC
      `).all()).results || [];
      return json(rows);
    }
    if (pathname === '/api/invoices' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const invNum = 'INV-' + new Date().toISOString().slice(0, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000);
      const rent = Number(b.rent_amount || 0);
      const water = Number(b.water_amount || 0);
      const garbage = Number(b.garbage_fee || b.garbage_amount || 0);
      const service = Number(b.service_charge || 0);
      const late = Number(b.late_fee || 0);
      const other = Number(b.other_charges || 0);
      const total = rent + water + garbage + service + late + other;
      const res = await db.prepare(`
        INSERT INTO invoices (invoice_number, lease_id, tenant_id, unit_id, month, issue_date, due_date, rent_amount, water_amount, garbage_amount, service_charge, late_fee, other_charges, total_amount, amount_paid, balance, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', ?)
      `).bind(
        invNum, b.lease_id ? Number(b.lease_id) : null, Number(b.tenant_id), Number(b.unit_id),
        b.month || new Date().toISOString().slice(0, 7), b.issue_date || new Date().toISOString().slice(0, 10),
        b.due_date || new Date().toISOString().slice(0, 10), rent, water, garbage, service, late, other, total, total, b.notes || null
      ).run();
      const id = res.meta?.last_row_id;
      return json({ success: true, id, invoice_number: invNum, total_amount: total }, 201);
    }

    // 11. Payments
    if (pathname === '/api/payments' && method === 'GET') {
      const rows = (await db.prepare(`
        SELECT p.*, t.name as tenant_name, i.invoice_number, u.unit_number, prop.name as property_name
        FROM payments p
        JOIN tenants t ON p.tenant_id = t.id
        LEFT JOIN invoices i ON p.invoice_id = i.id
        LEFT JOIN units u ON i.unit_id = u.id
        LEFT JOIN properties prop ON u.property_id = prop.id
        ORDER BY p.id DESC
      `).all()).results || [];
      return json(rows);
    }
    if (pathname === '/api/payments' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const recNum = 'REC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
      const amount = Number(b.amount || 0);
      const res = await db.prepare(`
        INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
        VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, 'completed', ?)
      `).bind(
        recNum, b.invoice_id ? Number(b.invoice_id) : null, Number(b.tenant_id), amount,
        b.payment_method || 'M-Pesa', b.reference_code || ('MPESA' + Math.floor(100000 + Math.random() * 900000)),
        b.payer_phone || null, b.payer_name || null, b.notes || null
      ).run();
      if (b.invoice_id) {
        const inv = await db.prepare('SELECT total_amount, amount_paid FROM invoices WHERE id = ?').bind(Number(b.invoice_id)).first();
        if (inv) {
          const newPaid = Number(inv.amount_paid) + amount;
          const newBal = Math.max(0, Number(inv.total_amount) - newPaid);
          const newStatus = newBal <= 0 ? 'paid' : 'partially_paid';
          await db.prepare('UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?').bind(newPaid, newBal, newStatus, Number(b.invoice_id)).run();
        }
      }
      return json({ success: true, receipt_number: recNum, amount, status: 'completed' }, 201);
    }

    // 12. Water Readings
    if (pathname === '/api/water-readings' && method === 'GET') {
      const rows = (await db.prepare(`
        SELECT w.*, u.unit_number, u.meter_number, p.name as property_name, t.name as tenant_name
        FROM water_readings w
        JOIN units u ON w.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        LEFT JOIN leases l ON u.id = l.unit_id AND l.status = 'active'
        LEFT JOIN tenants t ON l.tenant_id = t.id
        ORDER BY w.id DESC
      `).all()).results || [];
      return json(rows);
    }

    // 13. Maintenance
    if (pathname === '/api/maintenance' && method === 'GET') {
      const rows = (await db.prepare(`
        SELECT m.*, p.name as property_name, u.unit_number, t.name as tenant_name, t.phone as tenant_phone
        FROM maintenance_requests m
        JOIN properties p ON m.property_id = p.id
        JOIN units u ON m.unit_id = u.id
        LEFT JOIN tenants t ON m.tenant_id = t.id
        ORDER BY m.id DESC
      `).all()).results || [];
      return json(rows);
    }

    // 14. Expenses
    if (pathname === '/api/expenses' && method === 'GET') {
      const rows = (await db.prepare(`
        SELECT e.*, p.name as property_name
        FROM expenses e
        JOIN properties p ON e.property_id = p.id
        ORDER BY e.expense_date DESC, e.id DESC
      `).all()).results || [];
      return json(rows);
    }

    // 15. Public Vacancies & Book Viewing
    if (pathname === '/api/public/vacancies' && method === 'GET') {
      const totalUnitsRow = await db.prepare('SELECT count(*) as count FROM units').first().catch(() => ({ count: 0 }));
      const totalUnits = totalUnitsRow?.count || 0;

      let vacancies = (await db.prepare(`
        SELECT 
          u.id, u.unit_number, u.floor, u.unit_type, u.base_rent, u.service_charge, u.garbage_fee,
          u.status, u.notes, u.image_url as unit_image,
          p.id as property_id, p.name as property_name, p.property_type, p.address, p.city, p.image_url as property_image
        FROM units u
        JOIN properties p ON u.property_id = p.id
        WHERE LOWER(TRIM(u.status)) = 'vacant'
        ORDER BY u.id DESC
      `).all()).results || [];

      // Fallback to sample showcase units ONLY if the entire database has 0 units created
      if (totalUnits === 0 && vacancies.length === 0) {
        vacancies = [
          {
            id: 101, unit_number: 'A-402', floor: '4th Floor', unit_type: '2-Bedroom Master Ensuite',
            base_rent: 75000, service_charge: 5000, garbage_fee: 500, status: 'vacant',
            property_id: 1, property_name: 'Kilimani Royal Heights', property_type: 'Luxury Residential Apartments',
            address: 'Wood Avenue, Kilimani', city: 'Nairobi',
            unit_image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80',
            property_image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80'
          },
          {
            id: 102, unit_number: 'Penthouse B', floor: '12th Floor', unit_type: '4-Bedroom Penthouse with DSQ',
            base_rent: 220000, service_charge: 15000, garbage_fee: 1000, status: 'vacant',
            property_id: 2, property_name: 'Riverside Emerald Residency', property_type: 'Diplomatic Residential Suites',
            address: 'Riverside Drive, Westlands', city: 'Nairobi',
            unit_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
            property_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80'
          },
          {
            id: 103, unit_number: 'Villa 7', floor: 'Private Compound', unit_type: '4-Bedroom Beachfront Villa',
            base_rent: 180000, service_charge: 10000, garbage_fee: 500, status: 'vacant',
            property_id: 3, property_name: 'Nyali Ocean Breeze Villas', property_type: 'Beachfront Holiday Residences',
            address: 'Beach Road, Nyali', city: 'Mombasa',
            unit_image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80',
            property_image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80'
          }
        ];
      }

      const defaultPhotos = [
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80'
      ];

      const enriched = vacancies.map((v, idx) => {
        let bedrooms = 2;
        let bathrooms = 2;
        let sqft = 1100;

        let photos = [];
        if (v.unit_image) {
          try {
            const parsed = JSON.parse(v.unit_image);
            if (Array.isArray(parsed) && parsed.length > 0) photos = parsed;
            else if (typeof parsed === 'string') photos = [parsed];
          } catch(e) {
            photos = [v.unit_image];
          }
        }
        if (v.property_image) {
          try {
            const parsedP = JSON.parse(v.property_image);
            if (Array.isArray(parsedP)) {
              parsedP.forEach(img => { if (!photos.includes(img)) photos.push(img); });
            } else if (typeof parsedP === 'string' && !photos.includes(parsedP)) {
              photos.push(parsedP);
            }
          } catch(e) {
            if (!photos.includes(v.property_image)) photos.push(v.property_image);
          }
        }
        if (photos.length === 0) {
          photos = [
            defaultPhotos[idx % defaultPhotos.length],
            defaultPhotos[(idx + 1) % defaultPhotos.length],
            defaultPhotos[(idx + 2) % defaultPhotos.length]
          ];
        }

        const photo = photos[0];

        const ut = (v.unit_type || '').toLowerCase();
        if (ut.includes('commercial') || ut.includes('office') || ut.includes('retail')) {
          bedrooms = 0; bathrooms = 1; sqft = 850;
        } else if (ut.includes('studio')) {
          bedrooms = 1; bathrooms = 1; sqft = 450;
        } else if (ut.includes('1-bedroom')) {
          bedrooms = 1; bathrooms = 1; sqft = 650;
        } else if (ut.includes('3-bedroom')) {
          bedrooms = 3; bathrooms = 3; sqft = 1600;
        } else if (ut.includes('4-bedroom') || ut.includes('penthouse') || ut.includes('townhouse')) {
          bedrooms = 4; bathrooms = 4; sqft = 2400;
        }

        const mode = ut.includes('commercial') ? 'pan' : (ut.includes('townhouse') || ut.includes('penthouse') ? 'aerial' : 'dolly');

        const amenities = [
          'Borehole & County Water',
          'Standby Diesel Generator',
          '24/7 Biometric / Manned Security',
          'High-Speed Fiber Ready',
          'Dedicated Parking Bay'
        ];

        return {
          id: v.id,
          unit_number: v.unit_number,
          floor: v.floor,
          unit_type: v.unit_type,
          base_rent: Number(v.base_rent),
          service_charge: Number(v.service_charge || 0),
          garbage_fee: Number(v.garbage_fee || 0),
          property_id: v.property_id,
          property_name: v.property_name,
          property_type: v.property_type,
          address: v.address,
          city: v.city,
          bedrooms,
          bathrooms,
          sqft,
          photo,
          photos,
          amenities,
          total_monthly: Number(v.base_rent) + Number(v.service_charge || 0) + Number(v.garbage_fee || 0),
          deposit: Number(v.base_rent) * 2,
          higgsfield: {
            mode,
            rig: mode === 'aerial' ? 'Higgsfield Aerial Drone Arc (35mm)' : (mode === 'pan' ? 'Pedestal Cinema Pan' : 'Interior Dolly Glide'),
            fps: 24,
            prompt: `Cinematic 4K architectural glide through ${v.unit_type} at ${v.property_name}, ${v.city}. Natural lighting, photorealistic.`
          }
        };
      });

      return json({ success: true, count: enriched.length, vacancies: enriched });
    }

    if (pathname === '/api/public/book-viewing' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { unit_id, prospect_name, phone, email, preferred_date, time_slot, notes } = b;
      if (!unit_id || !prospect_name || !phone || !preferred_date) {
        return json({ error: 'Unit ID, prospect name, phone, and preferred date are required.' }, 400);
      }
      const res = await db.prepare(`
        INSERT INTO viewing_leads (unit_id, prospect_name, phone, email, preferred_date, time_slot, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)
      `).bind(Number(unit_id), prospect_name, phone, email || '', preferred_date, time_slot || '10:00 AM', notes || '').run();
      return json({ success: true, lead_id: res.meta?.last_row_id, message: 'Viewing booked successfully!' }, 201);
    }

    // 16. Users Management (Full CRUD)
    if (pathname === '/api/users' && method === 'GET') {
      const user = await getUser();
      if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
      if (user.role !== 'super_admin' && user.role !== 'property_manager') {
        return json({ error: `403 Forbidden: Role '${user.role}' is not authorized to inspect system user directories.` }, 403);
      }
      const rows = (await db.prepare('SELECT id, name, email, phone, role, property_id, tenant_id, status, created_at FROM users ORDER BY id ASC').all()).results || [];
      return json(rows);
    }

    if (pathname === '/api/users' && method === 'POST') {
      const user = await getUser();
      if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
      if (user.role !== 'super_admin' && user.role !== 'property_manager') {
        return json({ error: '403 Forbidden: Provisioning SaaS users requires Administrative privileges.' }, 403);
      }
      const b = await request.json().catch(() => ({}));
      if (!b.name || !b.email) return json({ error: 'Name and email are required to provision a user.' }, 400);
      const existing = await db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').bind(b.email.trim()).first();
      if (existing) return json({ error: 'User with this email already exists in system directory.' }, 409);
      const role = b.role || 'caretaker';
      const token = `token_${role}_${Date.now()}`;
      const pwd = (b.password && b.password.trim()) ? b.password.trim() : 'password123';
      const res = await db.prepare(`
        INSERT INTO users (name, email, phone, role, property_id, tenant_id, status, password_hash, session_token)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(b.name, b.email.trim(), b.phone || null, role, b.property_id ? Number(b.property_id) : null, b.tenant_id ? Number(b.tenant_id) : null, b.status || 'active', pwd, token).run();
      const id = res.meta?.last_row_id;
      const created = await db.prepare('SELECT id, name, email, phone, role, property_id, tenant_id, status, created_at FROM users WHERE id = ?').bind(id).first();
      return json({ success: true, id, user: created }, 201);
    }

    if ((pathname === '/api/users' || pathname.startsWith('/api/users/')) && method === 'PUT') {
      const user = await getUser();
      if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
      if (user.role !== 'super_admin' && user.role !== 'property_manager') {
        return json({ error: '403 Forbidden: Updating SaaS users requires Administrative privileges.' }, 403);
      }
      const b = await request.json().catch(() => ({}));
      const id = url.searchParams.get('id') || b.id || (pathname.startsWith('/api/users/') ? pathname.split('/')[3] : null);
      if (!id) return json({ error: 'User ID required' }, 400);
      await db.prepare(`
        UPDATE users SET
          name = coalesce(?, name),
          email = coalesce(?, email),
          phone = coalesce(?, phone),
          role = coalesce(?, role),
          property_id = coalesce(?, property_id),
          status = coalesce(?, status)
        WHERE id = ?
      `).bind(b.name || null, b.email ? b.email.trim() : null, b.phone || null, b.role || null, b.property_id ? Number(b.property_id) : null, b.status || null, Number(id)).run();
      if (b.password && b.password.trim()) {
        await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(b.password.trim(), Number(id)).run();
      }
      const updated = await db.prepare('SELECT id, name, email, phone, role, property_id, tenant_id, status, created_at FROM users WHERE id = ?').bind(Number(id)).first();
      return json({ success: true, user: updated });
    }

    if ((pathname === '/api/users' || pathname.startsWith('/api/users/')) && method === 'DELETE') {
      const user = await getUser();
      if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
      if (user.role !== 'super_admin' && user.role !== 'property_manager') {
        return json({ error: '403 Forbidden: Removing SaaS users requires Administrative privileges.' }, 403);
      }
      const id = url.searchParams.get('id') || (pathname.startsWith('/api/users/') ? pathname.split('/')[3] : null);
      if (!id) return json({ error: 'User ID required' }, 400);
      await db.prepare('DELETE FROM users WHERE id = ?').bind(Number(id)).run();
      return json({ success: true, message: 'User deleted successfully' });
    }

    // 17. Landlord Remittance Statement (D1 Native with RBAC)
    if (pathname === '/api/reports/landlord-statement' && method === 'GET') {
      const user = await getUser();
      if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
        return json({ error: '403 Forbidden: Access to owner remittance statements is restricted to Landlords and Property Managers.' }, 403);
      }
      let propId = Number(url.searchParams.get('property_id') || 1);
      if (user && user.role === 'landlord' && user.property_id) {
        if (Number(propId) !== Number(user.property_id)) {
          return json({ error: `403 Forbidden: Landlord '${user.name}' is only authorized to view statements for Property ID ${user.property_id}.` }, 403);
        }
        propId = user.property_id;
      }
      const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      let property = await db.prepare('SELECT * FROM properties WHERE id = ?').bind(propId).first();
      if (!property) {
        property = await db.prepare('SELECT * FROM properties ORDER BY id ASC LIMIT 1').first();
      }
      if (!property) return json({ error: 'Property not found' }, 404);

      const rentInvoices = (await db.prepare(`
        SELECT i.*, u.unit_number, u.unit_type, t.name as tenant_name
        FROM invoices i
        JOIN units u ON i.unit_id = u.id
        JOIN tenants t ON i.tenant_id = t.id
        WHERE u.property_id = ? AND i.month = ?
      `).bind(property.id, month).all()).results || [];

      const collections = (await db.prepare(`
        SELECT COALESCE(SUM(i.amount_paid), 0) as total_collected,
               COALESCE(SUM(i.total_amount), 0) as total_billed,
               COALESCE(SUM(i.balance), 0) as total_arrears
        FROM invoices i
        JOIN units u ON i.unit_id = u.id
        WHERE u.property_id = ? AND i.month = ?
      `).bind(property.id, month).first()) || { total_collected: 0, total_billed: 0, total_arrears: 0 };

      const expenses = (await db.prepare(`
        SELECT * FROM expenses 
        WHERE property_id = ? AND expense_date LIKE ?
      `).bind(property.id, `${month}%`).all()).results || [];

      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const grossCollections = Number(collections.total_collected || 0);
      const managementFeeRate = Number(property.management_fee_pct || 10.0);
      const managementFeeAmount = (grossCollections * managementFeeRate) / 100;
      const netLandlordRemittance = Math.max(0, grossCollections - managementFeeAmount - totalExpenses);

      return json({
        success: true,
        statement: {
          property,
          month,
          gross_collections: grossCollections,
          gross_rent_collected: grossCollections,
          total_billed: Number(collections.total_billed || 0),
          total_arrears: Number(collections.total_arrears || 0),
          management_fee_rate: managementFeeRate,
          management_fee_amount: managementFeeAmount,
          operating_expenses: totalExpenses,
          net_remittance_payout: netLandlordRemittance,
          expenses_breakdown: expenses,
          invoices_breakdown: rentInvoices
        }
      });
    }

    // 18. Diaspora Multi-Currency ROI Hub (D1 Native)
    if (pathname === '/api/reports/diaspora-roi' && method === 'GET') {
      const FX_RATES = { KES: 1, USD: 1 / 129.50, GBP: 1 / 168.20, EUR: 1 / 141.00 };
      const properties = (await db.prepare('SELECT * FROM properties').all()).results || [];
      const propertyMetrics = [];
      for (const p of properties) {
        const uStats = await db.prepare('SELECT COUNT(*) as count, SUM(base_rent) as total_rent FROM units WHERE property_id = ?').bind(p.id).first();
        const occStats = await db.prepare("SELECT COUNT(*) as count FROM units WHERE property_id = ? AND status = 'occupied'").bind(p.id).first();
        const totalUnits = uStats?.count || 1;
        const occupied = occStats?.count || 0;
        const occupancyPct = Number(((occupied / totalUnits) * 100).toFixed(1));
        const annualRentKES = (uStats?.total_rent || 0) * 12;
        const estimatedValuationKES = Math.round(annualRentKES / 0.085);
        propertyMetrics.push({
          id: p.id,
          name: p.name,
          city: p.city,
          property_type: p.property_type,
          total_units: totalUnits,
          occupancy_pct: occupancyPct,
          annual_gross_rent_kes: annualRentKES,
          estimated_valuation_kes: estimatedValuationKES,
          net_yield_pct: 8.5,
          cap_rate_pct: 7.8
        });
      }
      const totalValuationKES = propertyMetrics.reduce((s, p) => s + p.estimated_valuation_kes, 0);
      const totalAnnualRentKES = propertyMetrics.reduce((s, p) => s + p.annual_gross_rent_kes, 0);
      return json({
        success: true,
        fx_rates: { USD: 129.50, GBP: 168.20, EUR: 141.00 },
        portfolio_summary: {
          total_valuation_kes: totalValuationKES,
          total_valuation_usd: Math.round(totalValuationKES * FX_RATES.USD),
          total_valuation_gbp: Math.round(totalValuationKES * FX_RATES.GBP),
          total_valuation_eur: Math.round(totalValuationKES * FX_RATES.EUR),
          total_annual_rent_kes: totalAnnualRentKES,
          total_annual_rent_usd: Math.round(totalAnnualRentKES * FX_RATES.USD),
          average_cap_rate: '7.8%',
          average_net_yield: '8.5%'
        },
        properties: propertyMetrics
      });
    }

    // 19. Communications & SMS / WhatsApp Dispatcher (D1 Native)
    if (pathname === '/api/communications' && method === 'GET') {
      const rows = (await db.prepare('SELECT * FROM communications ORDER BY id DESC').all()).results || [];
      return json(rows);
    }
    if (pathname === '/api/communications/broadcast' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { message, purpose, channel } = b;
      if (!message) return json({ error: 'Message body is required.' }, 400);
      const activeTenants = (await db.prepare("SELECT * FROM tenants WHERE status = 'active'").all()).results || [];
      let count = 0;
      for (const t of activeTenants) {
        await db.prepare(`
          INSERT INTO communications (type, recipient_name, recipient_phone, tenant_id, message, status, purpose)
          VALUES (?, ?, ?, ?, ?, 'delivered', ?)
        `).bind(channel || 'SMS', t.name, t.phone, t.id, message, purpose || 'Broadcast').run();
        count++;
      }
      return json({ success: true, count, recipients_reached: count, recipient_count: count });
    }
    if (pathname === '/api/communications/send' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { recipient_name, recipient_phone, message, tenant_id, purpose, type } = b;
      if (!message || !recipient_phone) return json({ error: 'Recipient phone and message required' }, 400);
      const resIns = await db.prepare(`
        INSERT INTO communications (type, recipient_name, recipient_phone, tenant_id, message, status, purpose)
        VALUES (?, ?, ?, ?, ?, 'delivered', ?)
      `).bind(type || 'SMS', recipient_name || 'Resident', recipient_phone, tenant_id ? Number(tenant_id) : null, message, purpose || 'Notice').run();
      return json({ success: true, id: resIns.meta?.last_row_id, message: 'Dispatched successfully' }, 201);
    }

    // 20. Monthly Batch Invoicing Engine (D1 Native)
    if (pathname === '/api/invoices/generate-monthly' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const month = b.month || new Date().toISOString().slice(0, 7);
      const activeLeases = (await db.prepare(`
        SELECT l.*, u.base_rent, u.service_charge, u.garbage_fee
        FROM leases l
        JOIN units u ON l.unit_id = u.id
        WHERE l.status = 'active'
      `).all()).results || [];
      let generated = 0;
      for (const l of activeLeases) {
        const exists = await db.prepare('SELECT id FROM invoices WHERE lease_id = ? AND month = ?').bind(l.id, month).first();
        if (!exists) {
          const invNum = 'INV-' + month.replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000);
          const rent = Number(l.monthly_rent || l.base_rent || 0);
          const serv = Number(l.service_charge || 0);
          const garb = Number(l.garbage_fee || 0);
          const total = rent + serv + garb;
          await db.prepare(`
            INSERT INTO invoices (invoice_number, lease_id, tenant_id, unit_id, month, issue_date, due_date, rent_amount, water_amount, garbage_amount, service_charge, total_amount, amount_paid, balance, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?, 0.0, ?, 'unpaid')
          `).bind(
            invNum, l.id, l.tenant_id, l.unit_id, month,
            `${month}-01`, `${month}-05`,
            rent, garb, serv, total, total
          ).run();
          generated++;
        }
      }
      return json({ success: true, generated_count: generated, message: `${generated} invoices generated for ${month}.` });
    }

    // 21. Viewing Leads (D1 Native)
    if (pathname === '/api/viewing-leads' && method === 'GET') {
      const leads = (await db.prepare(`
        SELECT l.*, u.unit_number, p.name as property_name
        FROM viewing_leads l
        JOIN units u ON l.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        ORDER BY l.id DESC
      `).all()).results || [];
      return json({ success: true, count: leads.length, leads });
    }

    // 22. IoT Telemetry & Smart Meters (D1 Native)
    if (pathname === '/api/iot/devices' && method === 'GET') {
      const devices = (await db.prepare(`
        SELECT d.*, u.unit_number, p.name as property_name
        FROM iot_devices d
        JOIN properties p ON d.property_id = p.id
        LEFT JOIN units u ON d.unit_id = u.id
        ORDER BY d.id ASC
      `).all()).results || [];
      return json({ success: true, count: devices.length, devices });
    }
    if (pathname === '/api/iot/leak-alerts' && method === 'GET') {
      const alerts = (await db.prepare(`
        SELECT a.*, d.meter_number, u.unit_number, p.name as property_name
        FROM leak_alerts a
        JOIN iot_devices d ON a.device_id = d.id
        JOIN units u ON a.unit_id = u.id
        JOIN properties p ON d.property_id = p.id
        ORDER BY a.id DESC
      `).all()).results || [];
      return json({ success: true, count: alerts.length, alerts });
    }
    if (pathname === '/api/iot/valve-toggle' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { device_id, valve_status } = b;
      if (!device_id || !valve_status) return json({ error: 'Device ID and valve status required.' }, 400);
      await db.prepare('UPDATE iot_devices SET valve_status = ? WHERE id = ?').bind(valve_status, Number(device_id)).run();
      const updated = await db.prepare('SELECT * FROM iot_devices WHERE id = ?').bind(Number(device_id)).first();
      return json({ success: true, message: `Smart valve ${valve_status.toUpperCase()} command acknowledged.`, device: updated });
    }

    // 23. KRA eTIMS & 7.5% MRI Tax Summary (D1 Native)
    if (pathname === '/api/tax/etims-summary' && method === 'GET') {
      const records = (await db.prepare(`
        SELECT e.*, i.invoice_number, i.month, u.unit_number, p.name as property_name, t.name as tenant_name
        FROM etims_records e
        JOIN invoices i ON e.invoice_id = i.id
        JOIN units u ON i.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        JOIN tenants t ON i.tenant_id = t.id
        ORDER BY e.id DESC
      `).all()).results || [];
      const totals = (await db.prepare(`
        SELECT COUNT(*) as total_transmitted, SUM(taxable_amount) as total_taxable_rent, SUM(tax_payable) as total_mri_tax
        FROM etims_records
      `).first()) || { total_transmitted: 0, total_taxable_rent: 0, total_mri_tax: 0 };
      return json({
        success: true,
        stats: {
          total_transmitted: totals.total_transmitted || 0,
          total_taxable_rent: totals.total_taxable_rent || 0,
          total_mri_tax: totals.total_mri_tax || 0,
          mri_rate: '7.5%'
        },
        records
      });
    }

    // 24. Artisan Escrow Marketplace (D1 Native)
    if (pathname === '/api/marketplace/fundis' && method === 'GET') {
      const fundis = (await db.prepare('SELECT * FROM artisan_marketplace ORDER BY rating DESC').all()).results || [];
      return json({ success: true, count: fundis.length, fundis });
    }
    if (pathname === '/api/marketplace/escrows' && method === 'GET') {
      const escrows = (await db.prepare(`
        SELECT e.*, m.title as ticket_title, m.ticket_number, f.name as fundi_name, f.trade as fundi_trade, f.phone as fundi_phone
        FROM maintenance_escrows e
        JOIN maintenance_requests m ON e.ticket_id = m.id
        LEFT JOIN artisan_marketplace f ON e.fundi_id = f.id
        ORDER BY e.id DESC
      `).all()).results || [];
      return json({ success: true, count: escrows.length, escrows });
    }
    if (pathname === '/api/marketplace/escrow/allocate' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { ticket_id, fundi_id, amount, milestone_desc } = b;
      if (!ticket_id || !amount) return json({ error: 'Ticket ID and escrow allocation amount are required.' }, 400);
      const resIns = await db.prepare(`
        INSERT INTO maintenance_escrows (ticket_id, fundi_id, amount, status, milestone_desc)
        VALUES (?, ?, ?, 'held', ?)
      `).bind(Number(ticket_id), fundi_id ? Number(fundi_id) : null, Number(amount), milestone_desc || 'Repair milestone deposit').run();
      return json({ success: true, escrow_id: resIns.meta?.last_row_id, status: 'held', message: `KES ${Number(amount).toLocaleString()} locked in escrow.` }, 201);
    }
    if (pathname === '/api/marketplace/escrow/release' || (pathname.includes('/escrows/') && pathname.endsWith('/release'))) {
      const b = await request.json().catch(() => ({}));
      let escrowId = b.escrow_id || (pathname.includes('/escrows/') ? pathname.split('/escrows/')[1].split('/')[0] : null);
      if (!escrowId) return json({ error: 'Escrow ID required' }, 400);
      const b2cRef = 'B2C-MPESA-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await db.prepare("UPDATE maintenance_escrows SET status = 'released', b2c_disbursement_ref = ?, released_at = CURRENT_TIMESTAMP WHERE id = ?").bind(b2cRef, Number(escrowId)).run();
      return json({ success: true, status: 'released', b2c_disbursement_ref: b2cRef, message: 'Escrow funds successfully disbursed to contractor.' });
    }

    // 25. Digital Lease Agreements & E-Sign (D1 Native)
    if (pathname === '/api/leases/agreements' && method === 'GET') {
      const user = await getUser();
      let query = `
        SELECT a.*, l.monthly_rent, u.unit_number, p.name as property_name, t.name as tenant_name, t.phone as tenant_phone
        FROM lease_agreements a
        JOIN leases l ON a.lease_id = l.id
        JOIN units u ON a.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        JOIN tenants t ON a.tenant_id = t.id
      `;
      const params = [];
      if (user && user.role === 'tenant' && user.tenant_id) {
        query += ' WHERE a.tenant_id = ?';
        params.push(user.tenant_id);
      }
      query += ' ORDER BY a.id DESC';
      const agreements = (await db.prepare(query).bind(...params).all()).results || [];
      return json({ success: true, count: agreements.length, agreements });
    }
    if ((pathname.startsWith('/api/leases/agreements/') && pathname.endsWith('/sign')) && method === 'POST') {
      const parts = pathname.split('/');
      const agreementId = parts[parts.indexOf('agreements') + 1];
      const b = await request.json().catch(() => ({}));
      const { signature } = b;
      if (!signature) return json({ error: 'Signature data is required.' }, 400);
      await db.prepare("UPDATE lease_agreements SET tenant_signature = ?, tenant_signed_at = CURRENT_TIMESTAMP, status = 'active' WHERE id = ?").bind(signature, Number(agreementId)).run();
      const updated = await db.prepare('SELECT * FROM lease_agreements WHERE id = ?').bind(Number(agreementId)).first();
      return json({ success: true, agreement: updated, message: 'Lease agreement signed and legally executed.' });
    }

    // 26. Move-In / Move-Out Inspections (D1 Native)
    if (pathname === '/api/inspections' && method === 'GET') {
      const inspections = (await db.prepare(`
        SELECT i.*, u.unit_number, u.unit_type, p.name as property_name, t.name as tenant_name
        FROM property_inspections i
        JOIN units u ON i.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        LEFT JOIN tenants t ON i.tenant_id = t.id
        ORDER BY i.id DESC
      `).all()).results || [];
      const parsed = inspections.map(insp => {
        let checklist = [];
        try { checklist = JSON.parse(insp.checklist_json); } catch (e) {}
        return { ...insp, checklist };
      });
      return json({ success: true, count: parsed.length, inspections: parsed });
    }
    if (pathname === '/api/inspections' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { unit_id, tenant_id, inspection_type, inspector_name, checklist, deposit_held, unpaid_utility_arrears } = b;
      if (!unit_id || !inspection_type) return json({ error: 'Unit ID and Inspection Type required.' }, 400);
      const items = Array.isArray(checklist) ? checklist : [];
      const damagesTotal = items.reduce((sum, it) => sum + (Number(it.repair_cost) || 0), 0);
      const held = Number(deposit_held || 0);
      const arrears = Number(unpaid_utility_arrears || 0);
      const netRefund = Math.max(0, held - arrears - damagesTotal);
      const resIns = await db.prepare(`
        INSERT INTO property_inspections (unit_id, tenant_id, inspection_type, inspection_date, inspector_name, checklist_json, damages_total, deposit_held, unpaid_utility_arrears, net_deposit_refund, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
      `).bind(
        Number(unit_id), tenant_id ? Number(tenant_id) : null, inspection_type,
        new Date().toISOString().slice(0, 10), inspector_name || 'Site Caretaker',
        JSON.stringify(items), damagesTotal, held, arrears, netRefund
      ).run();
      return json({ success: true, id: resIns.meta?.last_row_id, net_deposit_refund: netRefund }, 201);
    }

    // 27. Gated Estate Visitor Passes (D1 Native)
    if (pathname === '/api/visitor-passes' && method === 'GET') {
      const user = await getUser();
      let query = `
        SELECT v.*, u.unit_number, p.name as property_name, t.name as host_name, t.phone as host_phone
        FROM visitor_passes v
        JOIN units u ON v.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        JOIN tenants t ON v.tenant_id = t.id
      `;
      const params = [];
      if (user && user.role === 'tenant' && user.tenant_id) {
        query += ' WHERE v.tenant_id = ?';
        params.push(user.tenant_id);
      }
      query += ' ORDER BY v.id DESC';
      const passes = (await db.prepare(query).bind(...params).all()).results || [];
      return json({ success: true, count: passes.length, passes });
    }
    if (pathname === '/api/visitor-passes' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { unit_id, tenant_id, visitor_name, visitor_phone, vehicle_plate, valid_date, time_slot } = b;
      if (!visitor_name || !visitor_phone) return json({ error: 'Visitor name and phone number required.' }, 400);
      const passCode = 'PASS-' + Math.floor(1000 + Math.random() * 9000);
      const date = valid_date || new Date().toISOString().slice(0, 10);
      const slot = time_slot || '08:00 AM - 08:00 PM';
      const qrData = `BOMASPHERE:${passCode}:UNIT-${unit_id || 1}:${date}`;
      const resIns = await db.prepare(`
        INSERT INTO visitor_passes (pass_code, unit_id, tenant_id, visitor_name, visitor_phone, vehicle_plate, valid_date, time_slot, status, qr_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).bind(passCode, Number(unit_id || 1), Number(tenant_id || 1), visitor_name, visitor_phone, vehicle_plate || 'N/A', date, slot, qrData).run();
      return json({ success: true, id: resIns.meta?.last_row_id, pass_code: passCode, qr_data: qrData, message: `Visitor Pass ${passCode} issued.` }, 201);
    }
    if (pathname === '/api/visitor-passes/validate' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { pass_code, action } = b;
      if (!pass_code) return json({ error: 'Gate pass code is required.' }, 400);
      const pass = await db.prepare(`
        SELECT v.*, u.unit_number, p.name as property_name, t.name as host_name
        FROM visitor_passes v
        JOIN units u ON v.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        JOIN tenants t ON v.tenant_id = t.id
        WHERE v.pass_code = ? OR v.pass_code = ?
      `).bind(pass_code.toUpperCase(), 'PASS-' + pass_code.toUpperCase()).first();
      if (!pass) return json({ error: 'Invalid or unknown gate pass code.' }, 404);
      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      if (action === 'check_out' || pass.status === 'checked_in') {
        await db.prepare("UPDATE visitor_passes SET status = 'completed', checked_out_at = ? WHERE id = ?").bind(timestamp, pass.id).run();
        return json({ success: true, action: 'check_out', status: 'completed', pass, message: `Visitor ${pass.visitor_name} checked out.` });
      } else {
        await db.prepare("UPDATE visitor_passes SET status = 'checked_in', checked_in_at = ? WHERE id = ?").bind(timestamp, pass.id).run();
        return json({ success: true, action: 'check_in', status: 'checked_in', pass, message: `Access Granted: Visitor ${pass.visitor_name} checked in.` });
      }
    }

    // 28. Shared Estate Amenities & Bookings (D1 Native)
    if (pathname === '/api/amenities' && method === 'GET') {
      const amenities = (await db.prepare(`
        SELECT a.*, p.name as property_name, p.city
        FROM estate_amenities a
        JOIN properties p ON a.property_id = p.id
        ORDER BY a.id ASC
      `).all()).results || [];
      return json({ success: true, count: amenities.length, amenities });
    }
    if (pathname === '/api/amenity-bookings' && method === 'GET') {
      const user = await getUser();
      let query = `
        SELECT b.*, a.name as amenity_name, a.photo as amenity_photo,
               u.unit_number, t.name as tenant_name, t.phone as tenant_phone
        FROM amenity_bookings b
        JOIN estate_amenities a ON b.amenity_id = a.id
        JOIN units u ON b.unit_id = u.id
        JOIN tenants t ON b.tenant_id = t.id
      `;
      const params = [];
      if (user && user.role === 'tenant' && user.tenant_id) {
        query += ' WHERE b.tenant_id = ?';
        params.push(user.tenant_id);
      }
      query += ' ORDER BY b.id DESC';
      const bookings = (await db.prepare(query).bind(...params).all()).results || [];
      return json({ success: true, count: bookings.length, bookings });
    }
    if (pathname === '/api/amenity-bookings' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { amenity_id, booking_date, start_time } = b;
      if (!amenity_id || !booking_date || !start_time) return json({ error: 'Amenity ID, date, and start time required.' }, 400);
      const amenity = await db.prepare('SELECT * FROM estate_amenities WHERE id = ?').bind(Number(amenity_id)).first();
      if (!amenity) return json({ error: 'Amenity not found.' }, 404);
      const hours = Number(b.duration_hours || 2);
      const totalFee = Number(amenity.hourly_fee || 0) * hours;
      const ref = 'BK-' + Math.floor(1000 + Math.random() * 9000);
      const user = await getUser();
      let tenantId = Number(b.tenant_id || user?.tenant_id || 1);
      let unitId = Number(b.unit_id || 1);
      const tRow = await db.prepare('SELECT id FROM tenants WHERE id = ?').bind(tenantId).first();
      if (!tRow) {
        const firstT = await db.prepare('SELECT id FROM tenants ORDER BY id ASC LIMIT 1').first();
        if (firstT) tenantId = firstT.id;
      }
      const uRow = await db.prepare('SELECT id FROM units WHERE id = ?').bind(unitId).first();
      if (!uRow) {
        const firstU = await db.prepare('SELECT id FROM units ORDER BY id ASC LIMIT 1').first();
        if (firstU) unitId = firstU.id;
      }
      const resIns = await db.prepare(`
        INSERT INTO amenity_bookings (booking_reference, amenity_id, tenant_id, unit_id, booking_date, start_time, end_time, total_fee, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
      `).bind(ref, Number(amenity_id), tenantId, unitId, booking_date, start_time, b.end_time || '07:00 PM', totalFee).run();
      return json({ success: true, id: resIns.meta?.last_row_id, booking_reference: ref, total_fee: totalFee, message: `Reservation ${ref} confirmed.` }, 201);
    }

    // 29. AI Tenant Vetting & CRB Scoring (D1 Native)
    if (pathname === '/api/tenant-vetting' && method === 'GET') {
      const vettings = (await db.prepare('SELECT * FROM tenant_vettings ORDER BY id DESC').all()).results || [];
      return json({ success: true, count: vettings.length, vettings });
    }
    if (pathname === '/api/tenant-vetting/analyze' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { applicant_name, phone, monthly_income, requested_rent } = b;
      if (!applicant_name || !monthly_income || !requested_rent) return json({ error: 'Applicant name, monthly income, and rent required.' }, 400);
      const income = Number(monthly_income);
      const rent = Number(requested_rent);
      const rentToIncomePct = Number(((rent / income) * 100).toFixed(1));
      let crbScore = 720;
      let riskCategory = 'Low Risk';
      let recommendation = 'Approved for Lease Execution';
      if (rentToIncomePct > 45) {
        crbScore = 580;
        riskCategory = 'High Risk';
        recommendation = 'Guarantor or 3-Month Security Deposit Required';
      } else if (rentToIncomePct > 35) {
        crbScore = 650;
        riskCategory = 'Medium Risk';
        recommendation = 'Conditional Approval with Standard 2-Month Deposit';
      }
      const resIns = await db.prepare(`
        INSERT INTO tenant_vettings (applicant_name, phone, monthly_income, crb_score, risk_category, rent_to_income_pct, recommendation, kra_pin_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(applicant_name, phone || '+254700000000', income, crbScore, riskCategory, rentToIncomePct, recommendation).run();
      return json({ success: true, id: resIns.meta?.last_row_id, crb_score: crbScore, risk_category: riskCategory, rent_to_income_pct: rentToIncomePct, recommendation }, 201);
    }

  } catch (err) {
    console.error('D1 execution error:', err);
    if (err.message && err.message.includes('no such table')) {
      await ensureD1Schema(db);
      return json({ success: false, auto_initialized: true, message: 'Database tables auto-created. Please refresh the page.' }, 503);
    }
    return json({ error: err.message || 'Database error occurred' }, 500);
  }

  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token, X-Role',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://cdn.tailwindcss.com;"
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: corsHeaders });

  // If Cloudflare D1 database binding 'DB' is present, route to D1
  if (env && env.DB) {
    const d1Res = await handleD1(context, json, corsHeaders);
    if (d1Res !== null) return d1Res;
  }

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

  if (pathname === '/api/properties' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const newProp = {
      id: DB.properties.length + 1,
      name: b.name || 'New Property',
      property_type: b.property_type || 'Residential',
      address: b.address || '',
      city: b.city || 'Nairobi',
      landlord_name: b.landlord_name || '',
      landlord_phone: b.landlord_phone || '',
      landlord_email: b.landlord_email || '',
      management_fee_pct: Number(b.management_fee_pct || 8.5),
      paybill_number: b.paybill_number || '522522',
      bank_name: b.bank_name || 'KCB Bank',
      bank_account: b.bank_account || '',
      image_url: b.image_url || null
    };
    DB.properties.push(newProp);
    return json({ success: true, id: newProp.id, name: newProp.name, property: newProp }, 201);
  }

  if ((pathname === '/api/properties' || pathname.startsWith('/api/properties/')) && method === 'PUT') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const pathId = pathname.startsWith('/api/properties/') ? pathname.split('/')[3] : null;
    const id = Number(pathId || url.searchParams.get('id') || b.id);
    const prop = DB.properties.find(p => p.id === id);
    if (!prop) return json({ error: 'Property not found' }, 404);
    Object.assign(prop, b);
    return json({ success: true, property: prop });
  }

  if ((pathname === '/api/properties' || pathname.startsWith('/api/properties/')) && method === 'DELETE') {
    const pathId = pathname.startsWith('/api/properties/') ? pathname.split('/')[3] : null;
    const id = Number(pathId || url.searchParams.get('id'));
    const idx = DB.properties.findIndex(p => p.id === id);
    if (idx !== -1) DB.properties.splice(idx, 1);
    return json({ success: true, message: 'Property deleted' });
  }

  // 3. Units
  if (pathname === '/api/units' && method === 'GET') {
    return json(DB.units);
  }

  if (pathname === '/api/units' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const prop = DB.properties.find(p => p.id === Number(b.property_id)) || DB.properties[0];
    const newUnit = {
      id: DB.units.length + 1,
      property_id: Number(b.property_id || 1),
      unit_number: b.unit_number || `U-${DB.units.length + 1}`,
      floor: b.floor || 'Ground',
      unit_type: b.unit_type || '2-Bedroom',
      base_rent: Number(b.base_rent || 50000),
      service_charge: Number(b.service_charge || 3000),
      garbage_fee: Number(b.garbage_fee || 500),
      status: b.status || 'vacant',
      meter_number: b.meter_number || `WM-${Math.floor(100 + Math.random() * 900)}`,
      property_name: prop ? prop.name : 'Kilimani Royal Heights',
      image_url: b.image_url || null
    };
    DB.units.push(newUnit);
    return json({ success: true, id: newUnit.id, unit_number: newUnit.unit_number, unit: newUnit }, 201);
  }

  if ((pathname === '/api/units' || pathname.startsWith('/api/units/')) && method === 'PUT') {
    const pathId = pathname.startsWith('/api/units/') ? pathname.split('/')[3] : null;
    const id = Number(pathId || url.searchParams.get('id'));
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const unit = DB.units.find(u => u.id === id);
    if (!unit) return json({ error: 'Unit not found' }, 404);
    Object.assign(unit, b);
    return json({ success: true, unit });
  }

  if ((pathname === '/api/units' || pathname.startsWith('/api/units/')) && method === 'DELETE') {
    const pathId = pathname.startsWith('/api/units/') ? pathname.split('/')[3] : null;
    const id = Number(pathId || url.searchParams.get('id'));
    const idx = DB.units.findIndex(u => u.id === id);
    if (idx !== -1) DB.units.splice(idx, 1);
    return json({ success: true, message: 'Unit deleted' });
  }

  // 4. Tenants
  if (pathname === '/api/tenants' && method === 'GET') {
    return json(DB.tenants);
  }

  if (pathname === '/api/tenants' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const unitId = Number(b.unit_id || 0);
    const unit = unitId ? DB.units.find(u => u.id === unitId) : null;
    if (unitId && !unit) {
      return json({ error: 'Specified unit was not found.' }, 404);
    }
    if (unit && unit.status !== 'vacant') {
      return json({ error: `Unit ${unit.unit_number} (${unit.property_name}) is currently marked as ${unit.status}. Only vacant units can be assigned.` }, 400);
    }
    if (unit && unit.status === 'vacant') {
      unit.status = 'occupied';
    }

    const tenantId = DB.tenants.length + 1;
    const monthlyRent = Number(b.monthly_rent || (unit ? unit.base_rent : 65000));
    const depositPaid = Number(b.deposit_paid || monthlyRent);
    const waterDeposit = Number(b.water_deposit || 5000);

    const newTenant = {
      id: tenantId,
      name: b.name || 'New Tenant',
      phone: b.phone || '',
      email: b.email || '',
      id_number: b.id_number || '',
      emergency_contact_name: b.emergency_contact_name || '',
      emergency_contact_phone: b.emergency_contact_phone || '',
      status: 'active',
      unit_id: unit ? unit.id : null,
      unit_number: unit ? unit.unit_number : null,
      property_name: unit ? unit.property_name : null,
      balance: 0,
      monthly_rent: unit ? monthlyRent : null,
      lease_start: unit ? (b.lease_start_date || new Date().toISOString().slice(0, 10)) : null,
      lease_end: unit ? (b.lease_end_date || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)) : null
    };
    DB.tenants.unshift(newTenant);

    let leaseInfo = {};
    if (unit) {
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `BS-LEASE-2026-${unit.unit_number.replace(/\s+/g, '')}-${suffix}`;
      const hash = 'SHA256-' + Math.random().toString(36).substring(2, 14).toUpperCase();
      const agreementId = DB.leaseAgreements.length + 1;
      const newLease = {
        id: agreementId,
        lease_id: agreementId,
        unit_id: unit.id,
        tenant_id: tenantId,
        start_date: b.lease_start_date || new Date().toISOString().slice(0, 10),
        end_date: b.lease_end_date || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        monthly_rent: monthlyRent,
        rent_amount: monthlyRent,
        deposit_amount: depositPaid,
        status: 'pending_tenant',
        agreement_code: code,
        contract_hash: hash,
        tenant_name: newTenant.name,
        unit_number: unit.unit_number,
        property_name: unit.property_name,
        terms_clauses: b.terms || 'Residential Tenancy Agreement governed by the Laws of Kenya.'
      };
      DB.leaseAgreements.unshift(newLease);

      // Auto-generate inaugural Move-In Invoice
      const invNum = `INV-202611-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const totalDue = monthlyRent + depositPaid + waterDeposit;
      const invoiceId = DB.invoices.length + 1;
      const newInv = {
        id: invoiceId,
        invoice_number: invNum,
        month: '2026-11',
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        rent_amount: monthlyRent,
        water_amount: waterDeposit,
        other_charges: depositPaid,
        total_amount: totalDue,
        amount_paid: 0,
        balance: totalDue,
        status: 'unpaid',
        tenant_id: tenantId,
        tenant_name: newTenant.name,
        tenant_phone: newTenant.phone,
        unit_id: unit.id,
        unit_number: unit.unit_number,
        property_name: unit.property_name,
        notes: 'Initial Move-In Settlement: 1st Month Rent + Security Deposit + Utility Water Deposit'
      };
      DB.invoices.unshift(newInv);

      leaseInfo = {
        lease_id: agreementId,
        agreement_id: agreementId,
        agreement_code: code,
        contract_hash: hash,
        invoice_id: invoiceId,
        invoice_number: invNum,
        total_due: totalDue,
        monthly_rent: monthlyRent,
        deposit_amount: depositPaid,
        water_deposit: waterDeposit,
        unit_number: unit.unit_number,
        property_name: unit.property_name,
        tenant_name: newTenant.name,
        tenant_phone: newTenant.phone
      };
    }

    return json({ success: true, id: newTenant.id, tenant_id: newTenant.id, name: newTenant.name, tenant: newTenant, ...leaseInfo }, 201);
  }

  if ((pathname === '/api/tenants' || pathname.startsWith('/api/tenants/')) && method === 'PUT') {
    const pathId = pathname.startsWith('/api/tenants/') ? pathname.split('/')[3] : null;
    const id = Number(pathId || url.searchParams.get('id'));
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const tenant = DB.tenants.find(t => t.id === id);
    if (!tenant) return json({ error: 'Tenant not found' }, 404);
    Object.assign(tenant, b);
    return json({ success: true, tenant });
  }

  if ((pathname === '/api/tenants' || pathname.startsWith('/api/tenants/')) && method === 'DELETE') {
    const pathId = pathname.startsWith('/api/tenants/') ? pathname.split('/')[3] : null;
    const id = Number(pathId || url.searchParams.get('id'));
    const idx = DB.tenants.findIndex(t => t.id === id);
    if (idx !== -1) DB.tenants.splice(idx, 1);
    return json({ success: true, message: 'Tenant deleted' });
  }

  // Leases
  if (pathname === '/api/leases' && method === 'GET') {
    return json(DB.leaseAgreements);
  }

  if (pathname === '/api/leases' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Authorizing lease agreements requires Property Manager or Admin privileges.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const unitId = Number(b.unit_id || 1);
    const tenantId = Number(b.tenant_id || 1);
    const unit = DB.units.find(u => u.id === unitId);
    const tenant = DB.tenants.find(t => t.id === tenantId);

    // Enforce: Occupied units CANNOT be leased again
    const activeLease = DB.leaseAgreements.find(l => l.unit_id === unitId && (l.status === 'active' || l.status === 'executed' || l.status === 'pending_tenant'));
    if (activeLease || (unit && unit.status === 'occupied')) {
      const activeTenant = DB.tenants.find(t => t.id === (activeLease ? activeLease.tenant_id : unit.tenant_id));
      const tenantName = activeTenant ? activeTenant.name : 'an existing resident';
      return json({
        error: `Unit ${unit ? unit.unit_number : unitId} is already occupied by ${tenantName}. An occupied unit cannot be leased again. Please terminate or expire the existing lease before assigning a new tenant.`
      }, 400);
    }

    if (unit) unit.status = 'occupied';

    const monthlyRent = Number(b.monthly_rent || (unit ? unit.base_rent : 65000));
    const depositPaid = Number(b.deposit_paid || monthlyRent);
    const waterDeposit = Number(b.water_deposit || 5000);
    const totalDue = monthlyRent + depositPaid + waterDeposit;

    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `BS-LEASE-2026-${unit ? unit.unit_number.replace(/\s+/g, '') : Math.floor(1000 + Math.random() * 9000)}-${suffix}`;
    const hash = 'SHA256-' + Math.random().toString(36).substring(2, 14).toUpperCase();
    const agreementId = DB.leaseAgreements.length + 1;
    const newLease = {
      id: agreementId,
      lease_id: agreementId,
      unit_id: unitId,
      tenant_id: tenantId,
      start_date: b.start_date || new Date().toISOString().slice(0, 10),
      end_date: b.end_date || '2027-12-31',
      monthly_rent: monthlyRent,
      rent_amount: monthlyRent,
      deposit_amount: depositPaid,
      status: 'pending_tenant',
      agreement_code: code,
      contract_hash: hash,
      tenant_name: tenant ? tenant.name : 'Resident Tenant',
      unit_number: unit ? unit.unit_number : 'Unit',
      property_name: unit ? unit.property_name : 'BomaSphere Residence',
      terms_clauses: b.terms || 'Residential Tenancy Agreement governed by the Laws of Kenya (Landlord and Tenant Act). Rent due on or before 5th. No unauthorized subletting.'
    };
    DB.leaseAgreements.unshift(newLease);

    // Auto-generate inaugural Move-In Invoice
    const invNum = `INV-202611-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const invoiceId = DB.invoices.length + 1;
    const newInv = {
      id: invoiceId,
      invoice_number: invNum,
      month: '2026-11',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      rent_amount: monthlyRent,
      water_amount: waterDeposit,
      other_charges: depositPaid,
      total_amount: totalDue,
      amount_paid: 0,
      balance: totalDue,
      status: 'unpaid',
      tenant_id: tenantId,
      tenant_name: tenant ? tenant.name : 'Resident Tenant',
      tenant_phone: tenant ? tenant.phone : '+254700000000',
      unit_id: unitId,
      unit_number: unit ? unit.unit_number : 'Unit',
      property_name: unit ? unit.property_name : 'BomaSphere Residence',
      notes: 'Initial Move-In Settlement: 1st Month Rent + Security Deposit + Utility Water Deposit'
    };
    DB.invoices.unshift(newInv);

    return json({
      success: true,
      id: newLease.id,
      lease_id: newLease.id,
      agreement_id: newLease.id,
      agreement_code: code,
      contract_hash: hash,
      invoice_id: invoiceId,
      invoice_number: invNum,
      total_due: totalDue,
      monthly_rent: monthlyRent,
      deposit_amount: depositPaid,
      water_deposit: waterDeposit,
      unit_number: unit ? unit.unit_number : 'Unit',
      property_name: unit ? unit.property_name : 'Property',
      tenant_name: tenant ? tenant.name : 'Resident Tenant',
      tenant_phone: tenant ? tenant.phone : '',
      message: 'Lease activated and automatically added to Digital Leases & E-sign.'
    }, 201);
  }

  if (pathname.startsWith('/api/leases/') && method === 'PUT') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Modifying lease agreements requires Property Manager or Admin privileges.' }, 403);
    }
    const id = Number(pathname.split('/')[3]);
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const lease = DB.leaseAgreements.find(l => l.id === id);
    if (!lease) return json({ error: 'Lease not found' }, 404);
    if (b.status) lease.status = b.status;
    return json({ success: true, lease });
  }

  // 5. Invoices
  if (pathname === '/api/invoices' && method === 'GET') {
    const user = resolveRequestUser(request);
    if (user && user.role === 'caretaker') {
      return json({
        error: '403 Forbidden: Caretakers are restricted from accessing financial ledgers and billing records.',
        role: user.role
      }, 403);
    }
    let list = DB.invoices;
    if (user && user.role === 'tenant') {
      list = list.filter(i => i.tenant_id === (user.tenant_id || 1));
    } else if (user && user.role === 'landlord' && user.property_id) {
      const prop = DB.properties.find(p => p.id === user.property_id);
      if (prop) list = list.filter(i => i.property_name === prop.name);
    }
    return json(list);
  }

  if (pathname === '/api/invoices' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
    if (user.role === 'caretaker' || user.role === 'tenant' || user.role === 'landlord') {
      return json({ error: '403 Forbidden: Invoicing authority is restricted to Property Managers and Super Admins.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch (e) { }

    const tenant = DB.tenants.find(t => t.id === Number(b.tenant_id)) || DB.tenants[0] || {};
    const unit = DB.units.find(u => u.id === Number(b.unit_id || tenant.unit_id)) || {};
    const rent = Number(b.rent_amount || unit.base_rent || 50000);
    const water = Number(b.water_amount || 0);
    const service = Number(b.service_charge || 0);
    const total = rent + water + service;

    const newInv = {
      id: DB.invoices.length + 1,
      invoice_number: `INV-202611-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      month: b.month || '2026-11',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      rent_amount: rent,
      water_amount: water,
      service_charge: service,
      total_amount: total,
      amount_paid: 0,
      balance: total,
      status: 'unpaid',
      tenant_id: tenant.id || 1,
      tenant_name: tenant.name || 'Resident Tenant',
      tenant_phone: tenant.phone || '+254700000000',
      unit_id: unit.id || tenant.unit_id || 1,
      unit_number: unit.unit_number || tenant.unit_number || 'A101',
      property_name: unit.property_name || tenant.property_name || 'BomaSphere Residences'
    };
    DB.invoices.unshift(newInv);
    return json({ success: true, id: newInv.id, invoice_number: newInv.invoice_number }, 201);
  }

  if (pathname === '/api/invoices/generate-monthly' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant' || user.role === 'landlord')) {
      return json({ error: '403 Forbidden: Batch monthly invoicing requires Property Manager privileges.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const month = b.month || '2026-12';
    let generated = 0;

    for (const u of DB.units.filter(u => u.status === 'occupied')) {
      const tenant = DB.tenants.find(t => t.unit_id === u.id) || DB.tenants[0];
      const invNum = `INV-${month.replace('-', '')}-${String(u.id).padStart(3, '0')}`;
      if (!DB.invoices.some(i => i.invoice_number === invNum)) {
        const total = (u.base_rent || 0) + (u.service_charge || 0) + (u.garbage_fee || 0) + 2150;
        DB.invoices.unshift({
          id: DB.invoices.length + 1,
          invoice_number: invNum,
          unit_id: u.id,
          tenant_id: tenant ? tenant.id : 1,
          month: month,
          issue_date: new Date().toISOString().slice(0, 10),
          due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
          rent_amount: u.base_rent,
          water_amount: 2150,
          service_charge: u.service_charge,
          garbage_amount: u.garbage_fee,
          total_amount: total,
          amount_paid: 0,
          balance: total,
          status: 'unpaid',
          tenant_name: tenant ? tenant.name : 'Resident',
          tenant_phone: tenant ? tenant.phone : '+254700000000',
          unit_number: u.unit_number,
          property_name: u.property_name
        });
        generated++;
      }
    }
    return json({ success: true, count: generated, message: `Successfully generated ${generated} consolidated invoices for ${month}.` });
  }

  // 6. Payments
  if (pathname === '/api/payments' && method === 'GET') {
    const user = resolveRequestUser(request);
    if (user && user.role === 'caretaker') {
      return json({
        error: '403 Forbidden: Caretakers are restricted from accessing financial ledgers and payment receipts.',
        role: user.role
      }, 403);
    }
    let list = DB.payments;
    if (user && user.role === 'tenant') {
      list = list.filter(p => p.tenant_id === (user.tenant_id || 1));
    } else if (user && user.role === 'landlord' && user.property_id) {
      const prop = DB.properties.find(p => p.id === user.property_id);
      if (prop) list = list.filter(p => p.property_name === prop.name);
    }
    return json(list);
  }

  if (pathname === '/api/payments' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (user && user.role === 'caretaker') {
      return json({ error: '403 Forbidden: Caretakers cannot process payment receipts.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch (e) { }
    if (user && user.role === 'tenant' && b.tenant_id && b.tenant_id !== user.tenant_id) {
      return json({ error: '403 Forbidden: Tenants can only make payments on their own accounts.' }, 403);
    }
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
    try { b = await request.json(); } catch (e) { }
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
    try { b = await request.json(); } catch (e) { }
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
    return json({ success: true, id: newMaint.id, ticket_number: newMaint.ticket_number, ticket: newMaint.ticket_number }, 201);
  }

  if (pathname.startsWith('/api/maintenance/') && method === 'PUT') {
    const id = Number(pathname.split('/')[3]);
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const ticket = DB.maintenance.find(m => m.id === id);
    if (!ticket) return json({ error: 'Maintenance ticket not found' }, 404);
    if (b.status) ticket.status = b.status;
    if (b.assigned_contractor) ticket.assigned_contractor = b.assigned_contractor;
    if (b.actual_cost) ticket.actual_cost = Number(b.actual_cost);
    if (b.notes) ticket.notes = b.notes;
    return json({ success: true, ticket });
  }

  // 9. Communications
  if (pathname === '/api/communications' && method === 'GET') {
    return json(DB.communications);
  }

  if (pathname === '/api/communications/broadcast' && method === 'POST') {
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
      message: `Broadcast successfully dispatched to ${recipients.length} tenants.`
    });
  }

  if (pathname === '/api/communications/send' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const tenant = DB.tenants.find(t => t.id === Number(b.tenant_id)) || DB.tenants[0];
    const newComm = {
      id: DB.communications.length + 1,
      tenant_id: tenant ? tenant.id : 1,
      recipient_name: tenant ? tenant.name : 'Resident',
      recipient_phone: tenant ? tenant.phone : '+254700000000',
      type: b.type || 'sms',
      message: b.message || 'Notice from property management',
      purpose: b.purpose || 'direct',
      sent_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      status: 'delivered'
    };
    DB.communications.unshift(newComm);
    return json({ success: true, id: newComm.id, channel: newComm.type, recipient: newComm.recipient_phone, message: 'Message queued and delivered.' }, 201);
  }

  // 10. Expenses
  if (pathname === '/api/expenses' && method === 'GET') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Caretakers and Tenants are not permitted to inspect property operating expenses.' }, 403);
    }
    let list = DB.expenses;
    if (user && user.role === 'landlord' && user.property_id) {
      list = list.filter(e => e.property_id === user.property_id);
    }
    return json(list);
  }

  if (pathname === '/api/expenses' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Only Property Managers and Landlords can log operating expense vouchers.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch (e) { }
    if (user && user.role === 'landlord' && b.property_id && Number(b.property_id) !== user.property_id) {
      return json({ error: `403 Forbidden: Landlord '${user.name}' is only authorized to log expenses for Property ID ${user.property_id}.` }, 403);
    }
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
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Access to owner remittance statements is restricted to Landlords and Property Managers.' }, 403);
    }
    const propId = Number(url.searchParams.get('property_id') || 1);
    if (user && user.role === 'landlord' && user.property_id && propId !== user.property_id) {
      return json({ error: `403 Forbidden: Landlord '${user.name}' is only authorized to view statements for Property ID ${user.property_id}.` }, 403);
    }
    const prop = DB.properties.find(p => p.id === propId);
    if (!prop) return json({ error: 'Property not found' }, 404);
    return json({
      statement: {
        property: prop,
        month: url.searchParams.get('month') || '2026-11',
        gross_collections: 451759,
        gross_rent_collected: 451759,
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
    const user = resolveRequestUser(request);
    if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
    if (user.role !== 'super_admin' && user.role !== 'property_manager') {
      return json({ error: `403 Forbidden: Role '${user.role}' is not authorized to inspect system user directories.` }, 403);
    }
    return json(DB.users);
  }

  if (pathname === '/api/users' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
    if (user.role !== 'super_admin' && user.role !== 'property_manager') {
      return json({ error: '403 Forbidden: Provisioning SaaS users requires Administrative privileges.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const newUser = {
      id: DB.users.length + 1,
      name: b.name || 'New SaaS User',
      email: b.email || 'user@bomasphere.co.ke',
      phone: b.phone || '+254700000000',
      role: b.role || 'caretaker',
      property_id: b.property_id ? Number(b.property_id) : null,
      tenant_id: b.tenant_id ? Number(b.tenant_id) : null,
      status: 'active'
    };
    DB.users.push(newUser);
    return json({ success: true, user: newUser }, 201);
  }

  if ((pathname === '/api/users' || pathname.startsWith('/api/users/')) && method === 'PUT') {
    const user = resolveRequestUser(request);
    if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
    if (user.role !== 'super_admin' && user.role !== 'property_manager') {
      return json({ error: '403 Forbidden: Modifying user accounts requires Administrative privileges.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const id = Number(url.searchParams.get('id') || b.id || pathname.split('/')[3]);
    const targetUser = DB.users.find(u => u.id === id);
    if (!targetUser) return json({ error: 'User not found' }, 404);
    if (b.name) targetUser.name = b.name;
    if (b.email) targetUser.email = b.email;
    if (b.phone) targetUser.phone = b.phone;
    if (b.role) targetUser.role = b.role;
    if (b.status) targetUser.status = b.status;
    return json({ success: true, user: targetUser });
  }

  if ((pathname === '/api/users' || pathname.startsWith('/api/users/')) && method === 'DELETE') {
    const user = resolveRequestUser(request);
    if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
    if (user.role !== 'super_admin' && user.role !== 'property_manager') {
      return json({ error: '403 Forbidden: Deleting user accounts requires Administrative privileges.' }, 403);
    }
    const id = Number(url.searchParams.get('id') || pathname.split('/')[3]);
    const idx = DB.users.findIndex(u => u.id === id);
    if (idx !== -1) DB.users.splice(idx, 1);
    return json({ success: true, message: 'User deactivated and removed' });
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = resolveRequestUser(request);
    if (!user) {
      return json({ error: 'Authentication required. Please sign in.' }, 401);
    }
    return json({ success: true, user });
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
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
    try { b = await request.json(); } catch (e) { }
    const role = b.role || 'property_manager';
    const user = DB.users.find(u => u.role === role) || DB.users[0];
    return json({ success: true, token: `token_${user.role}`, user });
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    return json({ success: true, message: 'Logged out successfully' });
  }

  if (pathname === '/api/reset-seed' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (!user || user.role !== 'super_admin') {
      return json({ error: '403 Forbidden: System database reset requires Super Admin authentication.' }, 403);
    }
    return json({ success: true, message: 'Sample data refreshed successfully' });
  }

  // 13. Public Vacancies & Viewing Bookings
  if (pathname === '/api/public/vacancies' && method === 'GET') {
    const vacancies = DB.units.filter(u => u.status === 'vacant').map(v => {
      const prop = DB.properties.find(p => p.id === v.property_id) || {};
      let bedrooms = 2;
      let bathrooms = 2;
      let sqft = 1100;
      let photo = v.image_url || prop.image_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80';
      let higgsfield = {
        mode: 'dolly',
        rig: 'Interior Tracking Glide (35mm Cine)',
        fps: 24,
        lighting: 'Golden hour ambient diffusion (3200K)',
        prompt: 'Dolly forward through sunlit living room with teak finishes, open balcony overlooking gardens, natural light, 35mm lens, steadycam 24fps glide, photorealistic.'
      };

      if (v.unit_type.includes('Commercial') || v.unit_type.includes('Office')) {
        bedrooms = 0; bathrooms = 1; sqft = 650;
        photo = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80';
        higgsfield = {
          mode: 'pan',
          rig: 'Pedestal Horizontal Pan (24mm Cine)',
          fps: 24,
          lighting: 'Cool executive daylight & recessed LED ceiling glow',
          prompt: 'Slow horizontal pedestal pan across open-plan executive commercial office suite, glass partition reflections, panoramic city view, 24fps smooth pan.'
        };
      } else if (v.unit_type.includes('3-Bedroom') || v.unit_type.includes('DSQ')) {
        bedrooms = 3; bathrooms = 3; sqft = 1650;
        photo = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80';
        higgsfield = {
          mode: 'dolly',
          rig: 'Steadicam Dolly In (35mm Anamorphic)',
          fps: 24,
          lighting: 'Warm afternoon golden hour ambient diffusion',
          prompt: 'Dolly forward through sunlit living room with teak dining finishes, open balcony overlooking lush gardens, natural volumetric light, 35mm lens, photorealistic.'
        };
      } else if (v.unit_type.includes('Townhouse') || v.unit_type.includes('Villa')) {
        bedrooms = 4; bathrooms = 4.5; sqft = 3200;
        photo = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80';
        higgsfield = {
          mode: 'aerial',
          rig: 'Cinema Drone 3D Arc Pullback',
          fps: 24,
          lighting: 'Sunset golden hour with warm interior window glow',
          prompt: 'Cinematic drone aerial pullback, 4k ultra-high definition, slow smooth arc revealing modern luxury villa at golden hour, private manicured lawn, warm ambient interior lighting visible through floor-to-ceiling glass.'
        };
      }
      return {
        ...v,
        property_name: prop.name || 'Kilimani Royal Heights',
        property_type: prop.property_type || 'Residential',
        address: prop.address || 'Nairobi',
        city: prop.city || 'Nairobi',
        bedrooms, bathrooms, sqft, photo,
        deposit: v.base_rent * 2,
        total_monthly: v.base_rent + (v.service_charge || 0) + (v.garbage_fee || 0),
        higgsfield,
        amenities: ['High-Speed Fiber', 'Borehole Water', '24/7 Manned Security', 'Backup Generator', 'Reserved Parking', 'Solar Water Heating']
      };
    });
    return json({ success: true, count: vacancies.length, vacancies });
  }

  if (pathname === '/api/public/book-viewing' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const ref = 'VIEW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newLead = {
      id: DB.viewingLeads.length + 1,
      unit_id: Number(b.unit_id || 4),
      prospect_name: b.prospect_name || 'Prospect',
      phone: b.phone || '+254700000000',
      email: b.email || null,
      preferred_date: b.preferred_date || new Date().toISOString().slice(0, 10),
      time_slot: b.time_slot || '10:00 AM',
      status: 'confirmed',
      notes: b.notes || null,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    DB.viewingLeads.unshift(newLead);

    return json({
      success: true,
      reference: ref,
      booking_reference: ref,
      lead_id: newLead.id,
      message: 'Viewing booked successfully. SMS dispatched.'
    }, 201);
  }

  if (pathname === '/api/viewing-leads' && method === 'GET') {
    const enriched = DB.viewingLeads.map(v => {
      const u = DB.units.find(unit => unit.id === v.unit_id) || {};
      const p = DB.properties.find(prop => prop.id === u.property_id) || {};
      return {
        ...v,
        unit_number: u.unit_number || 'N/A',
        unit_type: u.unit_type || 'N/A',
        base_rent: u.base_rent || 0,
        property_name: p.name || 'BomaSphere'
      };
    });
    return json({ success: true, count: enriched.length, leads: enriched });
  }

  if (pathname.startsWith('/api/viewing-leads/') && method === 'PUT') {
    const id = Number(pathname.split('/')[3]);
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const lead = DB.viewingLeads.find(v => v.id === id);
    if (!lead) return json({ error: 'Viewing lead not found' }, 404);
    if (b.status) lead.status = b.status;
    if (b.notes) lead.notes = b.notes;
    if (b.preferred_date) lead.preferred_date = b.preferred_date;
    if (b.time_slot) lead.time_slot = b.time_slot;
    return json({ success: true, message: 'Viewing lead updated successfully.' });
  }

  // 14. WhatsApp Business Bot
  if (pathname === '/api/whatsapp/webhook' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const incoming = (b.message || b.Body || '1').trim();
    const cmd = incoming.toUpperCase();
    let reply = `Jambo Kariuki James! Your current BomaSphere balance is KES 0.00. All invoices settled. Reply 'PAY' to trigger M-Pesa prompt.`;
    if (cmd.includes('RECEIPT') || cmd === '2') {
      reply = `Official BomaSphere Receipt: REC-20261101-4912. Paid KES 71,310 via M-Pesa (QG982KLA83). Status: Reconciled.`;
    } else if (cmd.includes('PAY') || cmd === '3') {
      reply = `Daraja M-Pesa STK push initiated for KES 65,000 to handset. Enter your M-Pesa PIN on prompt.`;
    } else if (cmd.startsWith('TICKET') || cmd === '4') {
      reply = `Maintenance ticket TKT-4890 logged successfully! Our site caretaker has been notified.`;
    }
    return json({ success: true, incoming, reply, action: 'whatsapp_response' });
  }

  if (pathname === '/api/whatsapp/history' && method === 'GET') {
    return json({ success: true, messages: DB.communications.filter(c => c.type === 'whatsapp') });
  }

  // 15. AI Tenant Vetting & CRB
  if (pathname === '/api/tenant-vetting' && method === 'GET') {
    return json({ success: true, vettings: DB.vettings });
  }

  if (pathname === '/api/tenant-vetting/analyze' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const income = Number(b.monthly_income || 250000);
    const rent = 65000;
    const ratio = Number(((rent / income) * 100).toFixed(1));
    const analysisData = {
      applicant_name: b.applicant_name || 'Applicant',
      crb_score: ratio > 40 ? 590 : 765,
      risk_category: ratio > 40 ? 'High Risk' : 'Low Risk',
      rent_to_income_pct: ratio,
      recommendation: ratio > 40 ? 'Declined: Rent exceeds 40% threshold' : 'Approved: Clean credit history'
    };
    return json({
      success: true,
      applicant_name: analysisData.applicant_name,
      crb_score: analysisData.crb_score,
      risk_category: analysisData.risk_category,
      rent_to_income_pct: ratio,
      recommendation: analysisData.recommendation,
      analysis: analysisData
    }, 201);
  }

  // 16. IoT Telemetry & Leak Alerts
  if (pathname === '/api/iot/devices' && method === 'GET') {
    return json({ success: true, count: DB.iotDevices.length, devices: DB.iotDevices });
  }

  if (pathname === '/api/iot/leak-alerts' && method === 'GET') {
    return json({ success: true, count: DB.leakAlerts.length, alerts: DB.leakAlerts });
  }

  if (pathname === '/api/iot/valve-toggle' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const dev = DB.iotDevices.find(d => d.id === Number(b.device_id));
    if (!dev) return json({ error: 'IoT device not found' }, 404);
    dev.valve_status = b.valve_status || 'open';
    return json({ success: true, message: `Smart valve status updated to ${dev.valve_status}`, device: dev });
  }

  // 17. KRA eTIMS & 7.5% MRI Tax
  if (pathname === '/api/tax/etims-summary' && method === 'GET') {
    const totalTaxable = DB.invoices.reduce((sum, i) => sum + i.rent_amount, 0);
    const totalMri = Math.round(totalTaxable * 0.075);
    return json({
      success: true,
      stats: { total_transmitted: DB.etimsRecords.length, total_taxable_rent: totalTaxable, total_mri_tax: totalMri, mri_rate: '7.5%' },
      records: DB.etimsRecords
    });
  }

  if (pathname === '/api/tax/etims/generate' && method === 'POST') {
    const code = 'KRA-ETIMS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    return json({ success: true, record: { control_code: code, qr_code_url: `https://itax.kra.go.ke/verify?code=${code}`, tax_payable: 4875 } }, 201);
  }

  // 18. Artisan Escrow Marketplace
  if (pathname === '/api/marketplace/fundis' && method === 'GET') {
    return json({ success: true, count: DB.fundis.length, fundis: DB.fundis });
  }

  if (pathname === '/api/marketplace/escrows' && method === 'GET') {
    return json({ success: true, count: DB.escrows.length, escrows: DB.escrows });
  }

  if (pathname === '/api/marketplace/escrow/allocate' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    return json({ success: true, escrow_id: 99, status: 'held', message: `KES ${Number(b.amount || 3500).toLocaleString()} locked in escrow` }, 201);
  }

  if (((pathname === '/api/marketplace/escrow/release') ||
    (pathname.startsWith('/api/artisan-marketplace/fundi-escrow/') && pathname.endsWith('/release')) ||
    (pathname.startsWith('/api/marketplace/escrows/') && pathname.endsWith('/release'))) && method === 'POST') {
    const ref = 'B2C-MPESA-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    return json({
      success: true,
      status: 'disbursed',
      b2c_disbursement_ref: ref,
      b2c_reference: ref,
      message: `Escrow released and disbursed via M-Pesa B2C (${ref}).`
    });
  }

  // 19. Digital Lease Agreements & E-Signatures
  if (pathname === '/api/leases/agreements' && method === 'GET') {
    return json({ success: true, count: DB.leaseAgreements.length, agreements: DB.leaseAgreements });
  }

  if (pathname.startsWith('/api/leases/agreements/') && pathname.endsWith('/sign') && method === 'POST') {
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
    return json({ success: true, agreement: agr, is_executed: true, message: `Lease ${agr.agreement_code} signed and legally executed!` });
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
    const code = `BS-LEASE-2026-${(unit?.unit_number || Math.floor(100+Math.random()*900)).toString().replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
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
  }

  // 20. Move-In / Move-Out Inspections & Deposit Settlement
  if (pathname === '/api/inspections' && method === 'GET') {
    return json({ success: true, count: DB.inspections.length, inspections: DB.inspections });
  }

  if (pathname === '/api/inspections' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const items = b.checklist || [];
    const damages = items.reduce((s, it) => s + (Number(it.repair_cost) || 0), 0);
    const held = Number(b.deposit_held || 130000);
    const arrears = Number(b.unpaid_utility_arrears || 0);
    const net = Math.max(0, held - arrears - damages);
    const newInsp = {
      id: DB.inspections.length + 1,
      unit_id: b.unit_id || 1,
      tenant_id: b.tenant_id || 1,
      inspection_type: b.inspection_type || 'move_out',
      inspection_date: new Date().toISOString().slice(0, 10),
      inspector_name: b.inspector_name || 'John Otieno (Site Caretaker)',
      damages_total: damages,
      deposit_held: held,
      unpaid_utility_arrears: arrears,
      net_deposit_refund: net,
      status: 'completed',
      unit_number: 'A101',
      property_name: 'Kilimani Royal Heights',
      tenant_name: 'Kariuki James Mwangi',
      checklist: items
    };
    DB.inspections.unshift(newInsp);
    return json({ success: true, id: newInsp.id, damages_total: damages, net_deposit_refund: net, message: 'Inspection recorded successfully.' }, 201);
  }

  if (pathname.startsWith('/api/inspections/') && pathname.endsWith('/settle-deposit') && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const held = Number(b.deposit_held || 130000);
    const deductions = Number(b.deductions_damages || 0) + Number(b.deductions_arrears || 0);
    const net = Math.max(0, held - deductions);
    const voucher = 'REF-DEP-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    return json({
      success: true,
      voucher_number: voucher,
      net_refund: net,
      net_refund_amount: net,
      deposit_held: held,
      deductions_total: deductions,
      message: `Deposit refund settled (${voucher}) via M-Pesa B2C.`
    });
  }

  // 21. Gated Estate Visitor Passes & Gate QR Security
  if (pathname === '/api/visitor-passes' && method === 'GET') {
    return json({ success: true, count: DB.visitorPasses.length, passes: DB.visitorPasses });
  }

  if (pathname === '/api/visitor-passes' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const code = 'PASS-' + Math.floor(1000 + Math.random() * 9000);
    const newPass = {
      id: DB.visitorPasses.length + 1,
      pass_code: code,
      unit_id: b.unit_id || 1,
      tenant_id: b.tenant_id || 1,
      visitor_name: b.visitor_name || 'Guest',
      visitor_phone: b.visitor_phone || '+254700000000',
      vehicle_plate: b.vehicle_plate || 'KDA 000A',
      valid_date: b.valid_date || new Date().toISOString().slice(0, 10),
      time_slot: b.time_slot || '08:00 AM - 08:00 PM',
      status: 'active',
      qr_data: `BOMASPHERE:${code}:UNIT-1`,
      unit_number: 'A101',
      property_name: 'Kilimani Royal Heights',
      host_name: 'Kariuki James Mwangi'
    };
    DB.visitorPasses.unshift(newPass);
    return json({ success: true, id: newPass.id, pass_code: code, qr_data: newPass.qr_data, message: `Visitor Gate Pass ${code} generated.` }, 201);
  }

  if (pathname === '/api/visitor-passes/validate' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const pass = DB.visitorPasses.find(p => p.pass_code === b.pass_code);
    if (!pass) return json({ error: 'Visitor pass not found or invalid' }, 404);
    pass.status = b.action === 'check_out' ? 'completed' : 'checked_in';
    return json({ success: true, action: b.action || 'check_in', status: pass.status, pass, message: `Pass validated for ${pass.visitor_name}.` });
  }

  // 22. Diaspora Landlord Multi-Currency Hub & ROI
  if (pathname === '/api/reports/diaspora-roi' && method === 'GET') {
    const totalValuationKES = 880000000;
    return json({
      success: true,
      fx_rates: { USD: 129.50, GBP: 168.20, EUR: 141.00 },
      portfolio_summary: {
        total_valuation_kes: totalValuationKES,
        total_valuation_usd: Math.round(totalValuationKES / 129.50),
        total_valuation_gbp: Math.round(totalValuationKES / 168.20),
        total_valuation_eur: Math.round(totalValuationKES / 141.00),
        total_annual_rent_kes: 74800000,
        average_cap_rate: '7.8%',
        average_net_yield: '8.5%'
      },
      properties: DB.properties.map(p => ({
        id: p.id,
        name: p.name,
        city: p.city,
        estimated_valuation_kes: Math.round(totalValuationKES / DB.properties.length),
        net_yield_pct: 8.5,
        cap_rate_pct: 7.8
      }))
    });
  }

  // 23. Shared Estate Amenities & Booking
  if (pathname === '/api/amenities' && method === 'GET') {
    return json({ success: true, count: DB.amenities.length, amenities: DB.amenities });
  }

  if (pathname === '/api/amenity-bookings' && method === 'GET') {
    return json({ success: true, count: DB.amenityBookings.length, bookings: DB.amenityBookings });
  }

  if (pathname === '/api/amenity-bookings' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const ref = 'BK-' + Math.floor(1000 + Math.random() * 9000);
    const amenity = DB.amenities.find(a => a.id === Number(b.amenity_id)) || DB.amenities[0];
    const durationHours = Number(b.duration_hours || b.hours || 2);
    const totalFee = (amenity.hourly_fee || 0) * durationHours;
    const user = resolveRequestUser(request);
    const tenantId = Number(b.tenant_id || user?.tenant_id || 1);
    const tenant = DB.tenants.find(t => t.id === tenantId) || DB.tenants[0];
    const newBk = {
      id: DB.amenityBookings.length + 1,
      booking_reference: ref,
      booking_ref: ref,
      amenity_id: amenity.id,
      tenant_id: tenantId,
      unit_id: b.unit_id || tenant?.unit_id || 1,
      booking_date: b.booking_date || new Date().toISOString().slice(0, 10),
      start_time: b.start_time || '03:00 PM',
      end_time: b.end_time || '06:00 PM',
      duration_hours: durationHours,
      total_fee: totalFee,
      status: 'confirmed',
      amenity_name: amenity.name,
      unit_number: tenant?.unit_number || 'A101',
      tenant_name: tenant?.name || 'Kariuki James Mwangi'
    };
    DB.amenityBookings.unshift(newBk);
    return json({
      success: true,
      id: newBk.id,
      booking_reference: ref,
      booking_ref: ref,
      booking: newBk,
      total_fee: totalFee,
      amenity_name: amenity.name,
      message: `Booking ${ref} confirmed for ${amenity.name}.`
    }, 201);
  }



  // Catch-all 404 for unmatched API routes
  return json({ error: "404 Not Found: API route does not exist", path: pathname }, 404);
}
