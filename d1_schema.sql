-- ====================================================================
-- BomaSphere PMS - Cloudflare D1 Production Schema
-- Tables ordered strictly by parent-child dependency
-- ====================================================================

CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      property_type TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      landlord_name TEXT NOT NULL,
      landlord_phone TEXT NOT NULL,
      landlord_email TEXT NOT NULL,
      management_fee_pct REAL DEFAULT 10.0,
      paybill_number TEXT,
      bank_name TEXT,
      bank_account TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      unit_number TEXT NOT NULL,
      floor TEXT DEFAULT 'Ground',
      unit_type TEXT NOT NULL,
      base_rent REAL NOT NULL,
      service_charge REAL DEFAULT 0.0,
      garbage_fee REAL DEFAULT 0.0,
      status TEXT DEFAULT 'vacant',
      meter_number TEXT,
      notes TEXT,
      image_url TEXT
    );

CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      id_number TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS leases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      monthly_rent REAL NOT NULL,
      deposit_paid REAL DEFAULT 0.0,
      water_deposit REAL DEFAULT 0.0,
      status TEXT DEFAULT 'active',
      terms TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      lease_id INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      issue_date DATE NOT NULL,
      due_date DATE NOT NULL,
      rent_amount REAL NOT NULL,
      water_amount REAL DEFAULT 0.0,
      garbage_amount REAL DEFAULT 0.0,
      service_charge REAL DEFAULT 0.0,
      late_fee REAL DEFAULT 0.0,
      other_charges REAL DEFAULT 0.0,
      total_amount REAL NOT NULL,
      amount_paid REAL DEFAULT 0.0,
      balance REAL NOT NULL,
      status TEXT DEFAULT 'unpaid',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_date DATETIME NOT NULL,
      payment_method TEXT NOT NULL,
      reference_code TEXT,
      payer_phone TEXT,
      payer_name TEXT,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS water_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      reading_date DATE NOT NULL,
      previous_reading REAL NOT NULL,
      current_reading REAL NOT NULL,
      units_consumed REAL NOT NULL,
      rate_per_unit REAL NOT NULL,
      total_cost REAL NOT NULL,
      invoiced INTEGER DEFAULT 0
    );

CREATE TABLE IF NOT EXISTS maintenance_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      assigned_contractor TEXT,
      contractor_phone TEXT,
      estimated_cost REAL DEFAULT 0.0,
      actual_cost REAL DEFAULT 0.0,
      requested_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_date DATETIME,
      notes TEXT
    );

CREATE TABLE IF NOT EXISTS communications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'delivered',
      purpose TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date DATE NOT NULL,
      paid_to TEXT,
      receipt_voucher TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      role TEXT NOT NULL,
      property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , password_hash TEXT DEFAULT 'password123', session_token TEXT);

CREATE TABLE IF NOT EXISTS iot_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meter_number TEXT UNIQUE NOT NULL,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
      device_type TEXT DEFAULT 'Ultrasonic Water Meter',
      battery_pct INTEGER DEFAULT 98,
      signal_rssi INTEGER DEFAULT -78,
      flow_rate_lph REAL DEFAULT 0.0,
      total_cubic_meters REAL DEFAULT 142.5,
      valve_status TEXT DEFAULT 'open',
      last_telemetry_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS leak_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL REFERENCES iot_devices(id) ON DELETE CASCADE,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      severity TEXT DEFAULT 'warning',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      flow_detected_lph REAL NOT NULL,
      status TEXT DEFAULT 'active',
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS artisan_marketplace (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trade TEXT NOT NULL,
      phone TEXT NOT NULL,
      rating REAL DEFAULT 4.8,
      jobs_completed INTEGER DEFAULT 24,
      id_verified INTEGER DEFAULT 1,
      daily_rate REAL DEFAULT 2500,
      availability TEXT DEFAULT 'available',
      location TEXT DEFAULT 'Nairobi'
    );

CREATE TABLE IF NOT EXISTS maintenance_escrows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
      fundi_id INTEGER REFERENCES artisan_marketplace(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'held',
      b2c_disbursement_ref TEXT,
      milestone_desc TEXT,
      released_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS tenant_vettings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applicant_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      id_number TEXT,
      requested_unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
      monthly_income REAL NOT NULL,
      crb_score INTEGER NOT NULL,
      risk_category TEXT NOT NULL,
      rent_to_income_pct REAL NOT NULL,
      recommendation TEXT NOT NULL,
      kra_pin_verified INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS viewing_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      prospect_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      preferred_date DATE NOT NULL,
      time_slot TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS estate_amenities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'Recreation',
      capacity INTEGER DEFAULT 20,
      hourly_fee REAL DEFAULT 0.0,
      photo TEXT,
      status TEXT DEFAULT 'available'
    );

CREATE TABLE IF NOT EXISTS amenity_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_reference TEXT UNIQUE NOT NULL,
      amenity_id INTEGER NOT NULL REFERENCES estate_amenities(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      booking_date DATE NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      total_fee REAL DEFAULT 0.0,
      status TEXT DEFAULT 'confirmed',
      invoiced INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS visitor_passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pass_code TEXT UNIQUE NOT NULL,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      visitor_name TEXT NOT NULL,
      visitor_phone TEXT NOT NULL,
      vehicle_plate TEXT,
      valid_date DATE NOT NULL,
      time_slot TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      checked_in_at DATETIME,
      checked_out_at DATETIME,
      qr_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS property_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
      inspection_type TEXT NOT NULL,
      inspection_date DATE NOT NULL,
      inspector_name TEXT NOT NULL,
      checklist_json TEXT NOT NULL,
      damages_total REAL DEFAULT 0.0,
      deposit_held REAL DEFAULT 0.0,
      unpaid_utility_arrears REAL DEFAULT 0.0,
      net_deposit_refund REAL DEFAULT 0.0,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS lease_agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lease_id INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      agreement_code TEXT UNIQUE NOT NULL,
      rent_amount REAL NOT NULL,
      deposit_amount REAL NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      terms_clauses TEXT,
      tenant_signature TEXT,
      tenant_signed_at DATETIME,
      manager_signature TEXT,
      manager_signed_at DATETIME,
      status TEXT DEFAULT 'pending_tenant',
      contract_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS etims_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      control_code TEXT UNIQUE NOT NULL,
      qr_code_url TEXT,
      tax_type TEXT DEFAULT 'MRI_7.5_PCT',
      taxable_amount REAL NOT NULL,
      tax_payable REAL NOT NULL,
      kra_status TEXT DEFAULT 'transmitted',
      validated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS mpesa_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_request_id TEXT,
      checkout_request_id TEXT UNIQUE NOT NULL,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      phone TEXT NOT NULL,
      account_reference TEXT,
      status TEXT DEFAULT 'pending',
      result_code INTEGER,
      result_desc TEXT,
      mpesa_receipt_number TEXT,
      transaction_date TEXT,
      raw_callback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS ratiba_standing_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      standing_order_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency INTEGER DEFAULT 5,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      account_reference TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      saf_standing_order_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

-- ====================================================================
-- Initial System RBAC Users (Preserved Passwords & Session Tokens)
-- ====================================================================
INSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Grace Wambui (Test Agent)', 'grace.test@bomasphere.co.ke', 'password123', '+254711998877', 'caretaker', NULL, NULL, 'token_caretaker', 'active');
INSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Sarah Cherono (Platform Super Admin)', 'admin@bomasphere.co.ke', '653a8cd6d79b4b826260601d51de295d:7314d101be03089baba43ecba759ae9b10d1cc151270cd7523bb3ef53a31bbb0ff0b0dc46f219f0e28f032166df835de6eb10f3778c752a5461b4bd96dc1f987', '+254700112233', 'super_admin', NULL, NULL, 'token_super_admin', 'active');
INSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Patrick Ndegwa (Property Manager)', 'ndegwa@crownpeak.co.ke', '3f2333516c39ca85d328860684cbcf52:bd58369db88a81bb73b3e4eb198d9a9ebca45c3a2ea318e2b16d0ced72baf0fb1be7e672a0b8375c595a47974ca77a4c8285b1fe2f9f06217dcab4e9a36a9b09', '+254711333444', 'property_manager', NULL, NULL, 'token_property_manager', 'active');
INSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('John Otieno (Site Caretaker)', 'otieno.caretaker@kilimaniheights.ke', '5e0138938d1b0c36d2ac29442e610d38:05b6ab17262c34da6844f8778f978fafb7a707203ecb3bdcfad70b46e9b2c046d1d39f8c3a102a068f76846368c42f85bb4043884360c082b43f14b5f4edf8a7', '+254722556677', 'caretaker', NULL, NULL, 'token_caretaker', 'active');
INSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Dr. Esther Wambui Ndung''u (Landlord / Investor)', 'esther.ndungu@gmail.com', '449aa4629b48c5ca356a47ddd859cbb2:c14b7117c51814abdf8ed699da2234e9074dba06ecf5bf32dcba3a4ef673b2eddac10540a5b8f14d2a8a0774ed02579c78b4e9fb53f3fd1fd44f220b4778b9f5', '+254733555777', 'landlord', NULL, NULL, 'token_landlord', 'active');
INSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Kariuki James Mwangi (Resident Tenant)', 'james.kariuki@techke.com', '0fb18377ade2b4ace7746c9f1b3059c9:03c060e8ce011f858a56096162dd8c1f567117cafb8ee520cdb20de3fc86b9eb0c4ffd4b793043514e181de55729151faa8004f9125c583546c183428012e219', '+254722889900', 'tenant', NULL, NULL, 'token_tenant', 'active');
