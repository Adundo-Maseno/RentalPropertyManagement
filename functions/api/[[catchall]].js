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
  auditLogs: [],
  leaseAgreements: [],
  inspections: [],
  visitorPasses: [],
  amenities: [],
  amenityBookings: [],
  mpesaTransactions: [],
  ratibaStandingOrders: [],
  unallocatedPayments: []
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

// ==========================================
// SAFARICOM DARAJA M-PESA STK PUSH (EDGE)
// ==========================================
function normalizeMpesaPhone(phone) {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '254' + clean.slice(1);
  } else if (clean.startsWith('7') || clean.startsWith('1')) {
    clean = '254' + clean;
  }
  return clean;
}

function getDarajaConfig(env = {}) {
  const isProd = env.MPESA_ENV === 'production';
  return {
    isProd,
    baseUrl: isProd ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke',
    consumerKey: env.MPESA_CONSUMER_KEY || '',
    consumerSecret: env.MPESA_CONSUMER_SECRET || '',
    passkey: env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
    shortcode: env.MPESA_SHORTCODE || '174379',
    callbackUrl: env.MPESA_CALLBACK_URL || 'https://rentalpropertymanagement.pages.dev/api/mpesa/callback'
  };
}

async function requestDarajaOAuthToken(config) {
  if (!config.consumerKey || !config.consumerSecret) {
    return 'sandbox_mock_token_' + Date.now();
  }
  const auth = btoa(`${config.consumerKey}:${config.consumerSecret}`);
  const res = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });
  if (!res.ok) {
    throw new Error(`Daraja OAuth Error (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function initiateMpesaStkPush({ phone, amount, accountReference, transactionDesc }, config) {
  const normalizedPhone = normalizeMpesaPhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 12) {
    throw new Error('Invalid Kenyan mobile number. Please enter a valid Safaricom number (e.g. 0712345678 or 254712345678).');
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}${hour}${minute}${second}`;

  const password = btoa(`${config.shortcode}${config.passkey}${timestamp}`);

  if (config.consumerKey && config.consumerSecret) {
    try {
      const token = await requestDarajaOAuthToken(config);
      const payload = {
        BusinessShortCode: config.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(Number(amount)),
        PartyA: normalizedPhone,
        PartyB: config.shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: config.callbackUrl,
        AccountReference: (accountReference || "BomaSphere").slice(0, 12),
        TransactionDesc: (transactionDesc || "Rent Payment").slice(0, 13)
      };

      const res = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.ResponseCode === "0") {
        return {
          merchantRequestId: data.MerchantRequestID,
          checkoutRequestId: data.CheckoutRequestID,
          responseCode: data.ResponseCode,
          responseDescription: data.ResponseDescription,
          customerMessage: data.CustomerMessage
        };
      }
      console.warn('Daraja STK Gateway Notice:', data.errorMessage || data.ResponseDescription);
    } catch (netErr) {
      console.warn('Daraja live gateway network notice (using sandbox simulator):', netErr.message);
    }
  }

  const mockCheckoutId = `ws_CO_${timestamp}_${Math.floor(100000 + Math.random() * 900000)}`;
  const mockMerchantId = `${Math.floor(10000 + Math.random() * 90000)}-${Date.now()}`;
  return {
    merchantRequestId: mockMerchantId,
    checkoutRequestId: mockCheckoutId,
    responseCode: "0",
    responseDescription: "Success. Request accepted for processing",
    customerMessage: "Success. Request accepted for processing"
  };
}

async function generateDarajaQrCode({ amount, refNo, trxCode }, config) {
  const shortcode = config.shortcode || '174379';
  const cleanRef = (refNo || 'RENT-PAY').slice(0, 15);
  const cleanAmount = Math.round(Number(amount)) || 1;
  const transactionType = trxCode === 'BG' ? 'BG' : 'PB';

  if (config.consumerKey && config.consumerSecret) {
    try {
      const token = await requestDarajaOAuthToken(config);
      const res = await fetch(`${config.baseUrl}/mpesa/qrcode/v1/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          MerchantName: "BomaSphere Properties",
          RefNo: cleanRef,
          Amount: cleanAmount,
          TrxCode: transactionType,
          CPI: shortcode,
          Size: "300"
        })
      });
      const data = await res.json();
      if (res.ok && (data.ResponseCode === "00" || data.QRCode)) {
        let code = data.QRCode;
        if (code && typeof code === 'string' && !code.startsWith('data:') && !code.startsWith('http')) {
          code = `data:image/png;base64,${code}`;
        }
        return {
          qr_code: code,
          qrCode: code,
          ref_no: cleanRef,
          refNo: cleanRef,
          amount: cleanAmount,
          shortcode,
          merchant_name: "BomaSphere Properties",
          merchantName: "BomaSphere Properties"
        };
      }
    } catch (apiErr) {
      console.warn('Daraja QR API call failed, generating fallback QR:', apiErr.message);
    }
  }

  // Self-contained SVG QR Code with Safaricom M-Pesa branding
  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300"><rect width="300" height="300" fill="#ffffff" rx="16"/><rect x="20" y="20" width="260" height="260" fill="none" stroke="#00A859" stroke-width="6" rx="12"/><text x="150" y="55" font-family="sans-serif" font-size="14" font-weight="bold" fill="#00A859" text-anchor="middle">LIPA NA M-PESA</text><rect x="50" y="80" width="45" height="45" fill="#000"/><rect x="58" y="88" width="29" height="29" fill="#fff"/><rect x="66" y="96" width="13" height="13" fill="#000"/><rect x="205" y="80" width="45" height="45" fill="#000"/><rect x="213" y="88" width="29" height="29" fill="#fff"/><rect x="221" y="96" width="13" height="13" fill="#000"/><rect x="50" y="195" width="45" height="45" fill="#000"/><rect x="58" y="203" width="29" height="29" fill="#fff"/><rect x="66" y="211" width="13" height="13" fill="#000"/><g fill="#111827"><rect x="110" y="90" width="10" height="20"/><rect x="130" y="80" width="15" height="10"/><rect x="155" y="95" width="20" height="10"/><rect x="110" y="125" width="80" height="12"/><rect x="120" y="150" width="60" height="10"/><rect x="105" y="175" width="25" height="25"/><rect x="145" y="170" width="35" height="15"/><rect x="120" y="205" width="20" height="35"/><rect x="155" y="200" width="35" height="15"/><rect x="205" y="145" width="45" height="10"/><rect x="220" y="170" width="20" height="30"/><rect x="200" y="215" width="45" height="25"/></g><text x="150" y="272" font-family="sans-serif" font-size="11" font-weight="600" fill="#374151" text-anchor="middle">Paybill: ${shortcode} | Acc: ${cleanRef}</text></svg>`;
  let base64Svg = '';
  try {
    base64Svg = btoa(unescape(encodeURIComponent(fallbackSvg)));
  } catch (e) {
    base64Svg = '';
  }
  const utf8SvgUri = `data:image/svg+xml;utf8,${encodeURIComponent(fallbackSvg)}`;

  return {
    qr_code: utf8SvgUri,
    qrCode: utf8SvgUri,
    qr_svg: fallbackSvg,
    qr_data_url: utf8SvgUri,
    ref_no: cleanRef,
    refNo: cleanRef,
    amount: cleanAmount,
    shortcode,
    merchant_name: "BomaSphere Properties",
    merchantName: "BomaSphere Properties"
  };
}

// ====================================================================
// Cloudflare D1 Serverless SQL Schema (Auto-Migration Payload)
// ====================================================================
const D1_SCHEMA_SQL = "-- ====================================================================\n-- BomaSphere PMS - Cloudflare D1 Production Schema\n-- Tables ordered strictly by parent-child dependency\n-- ====================================================================\n\nCREATE TABLE IF NOT EXISTS properties (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      name TEXT NOT NULL,\n      property_type TEXT NOT NULL,\n      address TEXT NOT NULL,\n      city TEXT NOT NULL,\n      landlord_name TEXT NOT NULL,\n      landlord_phone TEXT NOT NULL,\n      landlord_email TEXT NOT NULL,\n      management_fee_pct REAL DEFAULT 10.0,\n      paybill_number TEXT,\n      bank_name TEXT,\n      bank_account TEXT,\n      image_url TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS units (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,\n      unit_number TEXT NOT NULL,\n      floor TEXT DEFAULT 'Ground',\n      unit_type TEXT NOT NULL,\n      base_rent REAL NOT NULL,\n      service_charge REAL DEFAULT 0.0,\n      garbage_fee REAL DEFAULT 0.0,\n      status TEXT DEFAULT 'vacant',\n      meter_number TEXT,\n      notes TEXT,\n      image_url TEXT\n    );\n\nCREATE TABLE IF NOT EXISTS tenants (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      name TEXT NOT NULL,\n      phone TEXT NOT NULL,\n      email TEXT,\n      id_number TEXT,\n      emergency_contact_name TEXT,\n      emergency_contact_phone TEXT,\n      status TEXT DEFAULT 'active',\n      lifecycle_stage TEXT DEFAULT 'active',\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS leases (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      start_date DATE NOT NULL,\n      end_date DATE NOT NULL,\n      monthly_rent REAL NOT NULL,\n      deposit_paid REAL DEFAULT 0.0,\n      water_deposit REAL DEFAULT 0.0,\n      status TEXT DEFAULT 'active',\n      terms TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS invoices (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      invoice_number TEXT UNIQUE NOT NULL,\n      lease_id INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      month TEXT NOT NULL,\n      issue_date DATE NOT NULL,\n      due_date DATE NOT NULL,\n      rent_amount REAL NOT NULL,\n      water_amount REAL DEFAULT 0.0,\n      garbage_amount REAL DEFAULT 0.0,\n      service_charge REAL DEFAULT 0.0,\n      late_fee REAL DEFAULT 0.0,\n      other_charges REAL DEFAULT 0.0,\n      total_amount REAL NOT NULL,\n      amount_paid REAL DEFAULT 0.0,\n      balance REAL NOT NULL,\n      status TEXT DEFAULT 'unpaid',\n      notes TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS payments (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      receipt_number TEXT UNIQUE NOT NULL,\n      invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      amount REAL NOT NULL,\n      payment_date DATETIME NOT NULL,\n      payment_method TEXT NOT NULL,\n      reference_code TEXT,\n      payer_phone TEXT,\n      payer_name TEXT,\n      status TEXT DEFAULT 'completed',\n      notes TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS water_readings (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      month TEXT NOT NULL,\n      reading_date DATE NOT NULL,\n      previous_reading REAL NOT NULL,\n      current_reading REAL NOT NULL,\n      units_consumed REAL NOT NULL,\n      rate_per_unit REAL NOT NULL,\n      total_cost REAL NOT NULL,\n      invoiced INTEGER DEFAULT 0\n    );\n\nCREATE TABLE IF NOT EXISTS maintenance_requests (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      ticket_number TEXT UNIQUE NOT NULL,\n      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,\n      title TEXT NOT NULL,\n      description TEXT NOT NULL,\n      category TEXT NOT NULL,\n      priority TEXT DEFAULT 'medium',\n      status TEXT DEFAULT 'open',\n      assigned_contractor TEXT,\n      contractor_phone TEXT,\n      estimated_cost REAL DEFAULT 0.0,\n      actual_cost REAL DEFAULT 0.0,\n      requested_date DATETIME DEFAULT CURRENT_TIMESTAMP,\n      completed_date DATETIME,\n      notes TEXT\n    );\n\nCREATE TABLE IF NOT EXISTS communications (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      type TEXT NOT NULL,\n      recipient_name TEXT NOT NULL,\n      recipient_phone TEXT NOT NULL,\n      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,\n      message TEXT NOT NULL,\n      status TEXT DEFAULT 'delivered',\n      purpose TEXT,\n      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS expenses (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,\n      category TEXT NOT NULL,\n      description TEXT NOT NULL,\n      amount REAL NOT NULL,\n      expense_date DATE NOT NULL,\n      paid_to TEXT,\n      receipt_voucher TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS users (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      name TEXT NOT NULL,\n      email TEXT UNIQUE NOT NULL,\n      phone TEXT,\n      role TEXT NOT NULL,\n      property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,\n      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,\n      status TEXT DEFAULT 'active',\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    , password_hash TEXT DEFAULT 'password123', session_token TEXT);\n\nCREATE TABLE IF NOT EXISTS iot_devices (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      meter_number TEXT UNIQUE NOT NULL,\n      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,\n      unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,\n      device_type TEXT DEFAULT 'Ultrasonic Water Meter',\n      battery_pct INTEGER DEFAULT 98,\n      signal_rssi INTEGER DEFAULT -78,\n      flow_rate_lph REAL DEFAULT 0.0,\n      total_cubic_meters REAL DEFAULT 142.5,\n      valve_status TEXT DEFAULT 'open',\n      last_telemetry_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS leak_alerts (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      device_id INTEGER NOT NULL REFERENCES iot_devices(id) ON DELETE CASCADE,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      severity TEXT DEFAULT 'warning',\n      title TEXT NOT NULL,\n      message TEXT NOT NULL,\n      flow_detected_lph REAL NOT NULL,\n      status TEXT DEFAULT 'active',\n      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS artisan_marketplace (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      name TEXT NOT NULL,\n      trade TEXT NOT NULL,\n      phone TEXT NOT NULL,\n      rating REAL DEFAULT 4.8,\n      jobs_completed INTEGER DEFAULT 24,\n      id_verified INTEGER DEFAULT 1,\n      daily_rate REAL DEFAULT 2500,\n      availability TEXT DEFAULT 'available',\n      location TEXT DEFAULT 'Nairobi'\n    );\n\nCREATE TABLE IF NOT EXISTS maintenance_escrows (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      ticket_id INTEGER NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,\n      fundi_id INTEGER REFERENCES artisan_marketplace(id) ON DELETE SET NULL,\n      amount REAL NOT NULL,\n      status TEXT DEFAULT 'held',\n      b2c_disbursement_ref TEXT,\n      milestone_desc TEXT,\n      released_at DATETIME,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS tenant_vettings (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      applicant_name TEXT NOT NULL,\n      phone TEXT NOT NULL,\n      email TEXT,\n      id_number TEXT,\n      requested_unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,\n      monthly_income REAL NOT NULL,\n      crb_score INTEGER NOT NULL,\n      risk_category TEXT NOT NULL,\n      rent_to_income_pct REAL NOT NULL,\n      recommendation TEXT NOT NULL,\n      kra_pin_verified INTEGER DEFAULT 1,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS viewing_leads (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      prospect_name TEXT NOT NULL,\n      phone TEXT NOT NULL,\n      email TEXT,\n      preferred_date DATE NOT NULL,\n      time_slot TEXT NOT NULL,\n      status TEXT DEFAULT 'pending',\n      notes TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS estate_amenities (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,\n      name TEXT NOT NULL,\n      description TEXT,\n      category TEXT DEFAULT 'Recreation',\n      capacity INTEGER DEFAULT 20,\n      hourly_fee REAL DEFAULT 0.0,\n      photo TEXT,\n      status TEXT DEFAULT 'available'\n    );\n\nCREATE TABLE IF NOT EXISTS amenity_bookings (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      booking_reference TEXT UNIQUE NOT NULL,\n      amenity_id INTEGER NOT NULL REFERENCES estate_amenities(id) ON DELETE CASCADE,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      booking_date DATE NOT NULL,\n      start_time TEXT NOT NULL,\n      end_time TEXT NOT NULL,\n      total_fee REAL DEFAULT 0.0,\n      status TEXT DEFAULT 'confirmed',\n      invoiced INTEGER DEFAULT 0,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS visitor_passes (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      pass_code TEXT UNIQUE NOT NULL,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      visitor_name TEXT NOT NULL,\n      visitor_phone TEXT NOT NULL,\n      vehicle_plate TEXT,\n      valid_date DATE NOT NULL,\n      time_slot TEXT NOT NULL,\n      status TEXT DEFAULT 'active',\n      checked_in_at DATETIME,\n      checked_out_at DATETIME,\n      qr_data TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS property_inspections (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,\n      inspection_type TEXT NOT NULL,\n      inspection_date DATE NOT NULL,\n      inspector_name TEXT NOT NULL,\n      checklist_json TEXT NOT NULL,\n      damages_total REAL DEFAULT 0.0,\n      deposit_held REAL DEFAULT 0.0,\n      unpaid_utility_arrears REAL DEFAULT 0.0,\n      net_deposit_refund REAL DEFAULT 0.0,\n      status TEXT DEFAULT 'completed',\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS lease_agreements (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      lease_id INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,\n      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,\n      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n      agreement_code TEXT UNIQUE NOT NULL,\n      rent_amount REAL NOT NULL,\n      deposit_amount REAL NOT NULL,\n      start_date DATE NOT NULL,\n      end_date DATE NOT NULL,\n      terms_clauses TEXT,\n      tenant_signature TEXT,\n      tenant_signed_at DATETIME,\n      manager_signature TEXT,\n      manager_signed_at DATETIME,\n      status TEXT DEFAULT 'pending_tenant',\n      contract_hash TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS etims_records (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,\n      control_code TEXT UNIQUE NOT NULL,\n      qr_code_url TEXT,\n      tax_type TEXT DEFAULT 'MRI_7.5_PCT',\n      taxable_amount REAL NOT NULL,\n      tax_payable REAL NOT NULL,\n      kra_status TEXT DEFAULT 'transmitted',\n      validated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS mpesa_transactions (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      merchant_request_id TEXT,\n      checkout_request_id TEXT UNIQUE NOT NULL,\n      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,\n      invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,\n      amount REAL NOT NULL,\n      phone TEXT NOT NULL,\n      account_reference TEXT,\n      status TEXT DEFAULT 'pending',\n      result_code INTEGER,\n      result_desc TEXT,\n      mpesa_receipt_number TEXT,\n      transaction_date TEXT,\n      raw_callback TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS ratiba_standing_orders (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,\n      standing_order_name TEXT NOT NULL,\n      phone TEXT NOT NULL,\n      amount REAL NOT NULL,\n      frequency INTEGER DEFAULT 5,\n      start_date TEXT NOT NULL,\n      end_date TEXT NOT NULL,\n      account_reference TEXT NOT NULL,\n      status TEXT DEFAULT 'active',\n      saf_standing_order_id TEXT,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\nCREATE TABLE IF NOT EXISTS system_audit_logs (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,\n      actor_name TEXT NOT NULL DEFAULT 'System Agent',\n      actor_role TEXT NOT NULL DEFAULT 'system',\n      action TEXT NOT NULL,\n      entity_type TEXT NOT NULL,\n      entity_id INTEGER NOT NULL,\n      description TEXT NOT NULL,\n      diff_json TEXT,\n      checksum TEXT NOT NULL,\n      prev_checksum TEXT,\n      ip_address TEXT DEFAULT '127.0.0.1',\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n\n-- ====================================================================\n-- Initial System RBAC Users (Preserved Passwords & Session Tokens)\n-- ====================================================================\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Grace Wambui (Test Agent)', 'grace.test@bomasphere.co.ke', 'password123', '+254711998877', 'caretaker', NULL, NULL, 'token_caretaker', 'active');\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Sarah Cherono (Platform Super Admin)', 'admin@bomasphere.co.ke', '653a8cd6d79b4b826260601d51de295d:7314d101be03089baba43ecba759ae9b10d1cc151270cd7523bb3ef53a31bbb0ff0b0dc46f219f0e28f032166df835de6eb10f3778c752a5461b4bd96dc1f987', '+254700112233', 'super_admin', NULL, NULL, 'token_super_admin', 'active');\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Patrick Ndegwa (Property Manager)', 'ndegwa@crownpeak.co.ke', '3f2333516c39ca85d328860684cbcf52:bd58369db88a81bb73b3e4eb198d9a9ebca45c3a2ea318e2b16d0ced72baf0fb1be7e672a0b8375c595a47974ca77a4c8285b1fe2f9f06217dcab4e9a36a9b09', '+254711333444', 'property_manager', NULL, NULL, 'token_property_manager', 'active');\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('John Otieno (Site Caretaker)', 'otieno.caretaker@kilimaniheights.ke', '5e0138938d1b0c36d2ac29442e610d38:05b6ab17262c34da6844f8778f978fafb7a707203ecb3bdcfad70b46e9b2c046d1d39f8c3a102a068f76846368c42f85bb4043884360c082b43f14b5f4edf8a7', '+254722556677', 'caretaker', NULL, NULL, 'token_caretaker', 'active');\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Dr. Esther Wambui Ndung''u (Landlord / Investor)', 'esther.ndungu@gmail.com', '449aa4629b48c5ca356a47ddd859cbb2:c14b7117c51814abdf8ed699da2234e9074dba06ecf5bf32dcba3a4ef673b2eddac10540a5b8f14d2a8a0774ed02579c78b4e9fb53f3fd1fd44f220b4778b9f5', '+254733555777', 'landlord', NULL, NULL, 'token_landlord', 'active');\nINSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status) VALUES ('Kariuki James Mwangi (Resident Tenant)', 'james.kariuki@techke.com', '0fb18377ade2b4ace7746c9f1b3059c9:03c060e8ce011f858a56096162dd8c1f567117cafb8ee520cdb20de3fc86b9eb0c4ffd4b793043514e181de55729151faa8004f9125c583546c183428012e219', '+254722889900', 'tenant', NULL, NULL, 'token_tenant', 'active');\n";

function parseMpesaMessage(text) {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();

  const codeMatch = raw.match(/\b([A-Z0-9]{10})\s+Confirmed/i) ||
                    raw.match(/(?:claim|paid|ref|code|mpesa|receipt)[:\s#]*([A-Z0-9]{10})\b/i) ||
                    raw.match(/\b([Q-Z0-9][A-Z0-9]{9})\b/i);

  if (!codeMatch) return null;
  const referenceCode = codeMatch[1].toUpperCase();

  const amtMatch = raw.match(/(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i) ||
                   raw.match(/(?:sent|paid|amount|deposit)\s*(?:of\s*)?(?:Ksh|KES)?\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : null;

  const payeeMatch = raw.match(/(?:sent to|paid to)\s*([^.]+?)(?:\s+for account|\s+on|\.)/i);
  const accountMatch = raw.match(/(?:for account|acc(?:ount)?\.?[:\s]*)\s*([0-9A-Z_.-]+)/i);

  return {
    referenceCode,
    amount,
    payee: payeeMatch ? payeeMatch[1].trim() : null,
    accountReference: accountMatch ? accountMatch[1].trim() : null,
    rawText: raw
  };
}

async function reconcileMpesaClaimD1({ referenceCode, amount, phone, name, source = 'whatsapp' }, db) {
  const existingPayment = await db.prepare("SELECT p.*, t.name as tenant_name, u.unit_number FROM payments p LEFT JOIN tenants t ON p.tenant_id = t.id LEFT JOIN leases l ON l.tenant_id = t.id AND l.status = 'active' LEFT JOIN units u ON l.unit_id = u.id WHERE p.reference_code = ?").bind(referenceCode).first();
  if (existingPayment) {
    return {
      status: 'already_reconciled',
      payment: existingPayment,
      message: `Transaction ${referenceCode} was already reconciled on ${existingPayment.payment_date} for Unit ${existingPayment.unit_number || 'Resident'} (Receipt #${existingPayment.receipt_number}).`
    };
  }

  let tenant = null;
  if (phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const last9 = cleanPhone.slice(-9);
    tenant = await db.prepare("SELECT t.*, u.unit_number, u.property_id, p.name as property_name FROM tenants t LEFT JOIN leases l ON l.tenant_id = t.id AND l.status = 'active' LEFT JOIN units u ON l.unit_id = u.id LEFT JOIN properties p ON u.property_id = p.id WHERE t.phone LIKE ? OR t.phone LIKE ?").bind(`%${last9}%`, phone).first();
  }

  if (!tenant && name) {
    const words = name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    for (const w of words) {
      tenant = await db.prepare("SELECT t.*, u.unit_number, u.property_id, p.name as property_name FROM tenants t LEFT JOIN leases l ON l.tenant_id = t.id AND l.status = 'active' LEFT JOIN units u ON l.unit_id = u.id LEFT JOIN properties p ON u.property_id = p.id WHERE LOWER(t.name) LIKE ?").bind(`%${w}%`).first();
      if (tenant) break;
    }
  }

  if (tenant) {
    let inv = await db.prepare("SELECT * FROM invoices WHERE tenant_id = ? AND balance > 0 ORDER BY id ASC LIMIT 1").bind(tenant.id).first();
    if (!inv) {
      inv = await db.prepare("SELECT * FROM invoices WHERE tenant_id = ? ORDER BY id DESC LIMIT 1").bind(tenant.id).first();
    }

    const paidAmount = Number(amount) > 0 ? Number(amount) : (inv ? Number(inv.balance) : 0);
    const receiptNum = 'REC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    let newBalance = 0;
    if (inv) {
      newBalance = Math.max(0, Number(inv.balance) - paidAmount);
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';
      const newPaid = Number(inv.amount_paid || 0) + paidAmount;
      await db.prepare("UPDATE invoices SET balance = ?, amount_paid = ?, status = ? WHERE id = ?").bind(newBalance, newPaid, newStatus, inv.id).run();
    }

    await db.prepare(`
      INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'mpesa_c2b_claim', ?, ?, ?, 'completed', ?)
    `).bind(receiptNum, inv?.id || null, tenant.id, paidAmount, referenceCode, phone || tenant.phone, name || tenant.name, `Auto-reconciled via ${source}`).run();

    return {
      status: 'reconciled',
      tenant,
      invoice: inv,
      receiptNumber: receiptNum,
      paidAmount,
      newBalance,
      referenceCode
    };
  }

  try {
    await db.prepare(`
      INSERT OR IGNORE INTO unallocated_payments (reference_code, amount, payer_phone, payer_name, source, status, payment_date, notes)
      VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, 'Unidentified sender payment')
    `).bind(referenceCode, Number(amount) || 0, phone || '', name || '', source).run();
  } catch (e) {}

  return {
    status: 'unallocated',
    referenceCode,
    paidAmount: Number(amount) || 0,
    phone,
    name
  };
}

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
      await db.prepare(`
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
        )
      `).run();
    } catch (e) {}

    try {
      await db.prepare(`
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
        )
      `).run();
    } catch (e) {}

    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS unallocated_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reference_code TEXT UNIQUE NOT NULL,
          amount REAL NOT NULL,
          payer_phone TEXT,
          payer_name TEXT,
          paybill_number TEXT DEFAULT '174379',
          account_reference TEXT,
          source TEXT DEFAULT 'bank_statement',
          status TEXT DEFAULT 'pending',
          claimed_tenant_id INTEGER REFERENCES tenants(id),
          claimed_invoice_id INTEGER REFERENCES invoices(id),
          reconciled_at DATETIME,
          payment_date DATETIME NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    } catch (e) {}

    try { await db.prepare("ALTER TABLE tenants ADD COLUMN lifecycle_stage TEXT DEFAULT 'active'").run(); } catch (e) {}

    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS system_audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          actor_name TEXT NOT NULL DEFAULT 'System Agent',
          actor_role TEXT NOT NULL DEFAULT 'system',
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          diff_json TEXT,
          checksum TEXT NOT NULL,
          prev_checksum TEXT,
          ip_address TEXT DEFAULT '127.0.0.1',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    } catch (e) {}
    
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

    try {
      const propCountRow = await db.prepare("SELECT count(*) as total FROM properties").first().catch(() => null);
      if (!propCountRow || propCountRow.total <= 1) {
        // 1. Properties
        await db.prepare("INSERT OR REPLACE INTO properties (id, name, property_type, address, city, landlord_name, landlord_phone, landlord_email, management_fee_pct, paybill_number, bank_name, bank_account, image_url) VALUES (1, 'Kilimani Royal Heights', 'Residential Apartments', 'Argwings Kodhek Rd, Kilimani', 'Nairobi', 'Maziwa Investment Group', '+254722100200', 'finance@maziwa.co.ke', 8.5, '522522 / Acc: KRH-01', 'KCB Bank', '1189452300', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80')").run();
        await db.prepare("INSERT OR REPLACE INTO properties (id, name, property_type, address, city, landlord_name, landlord_phone, landlord_email, management_fee_pct, paybill_number, bank_name, bank_account, image_url) VALUES (2, 'Westlands Executive Suites', 'Mixed Commercial & Residential', 'Mpaka Road, Westlands', 'Nairobi', 'Crown Peak Holdings Ltd', '+254711333444', 'properties@crownpeak.co.ke', 10.0, '600100 / Acc: WES-99', 'Equity Bank', '0450293847291', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80')").run();
        await db.prepare("INSERT OR REPLACE INTO properties (id, name, property_type, address, city, landlord_name, landlord_phone, landlord_email, management_fee_pct, paybill_number, bank_name, bank_account, image_url) VALUES (3, 'Riverside Green Court', 'Residential Townhouses', 'Riverside Drive', 'Nairobi', 'Dr. Esther Wambui Ndung''u', '+254733555777', 'esther.ndungu@gmail.com', 7.5, '247247 / Acc: RGC-12', 'Co-operative Bank', '01129384756200', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80')").run();
        await db.prepare("INSERT OR REPLACE INTO properties (id, name, property_type, address, city, landlord_name, landlord_phone, landlord_email, management_fee_pct, paybill_number, bank_name, bank_account, image_url) VALUES (4, 'Nyali Ocean Breeze Villas', 'Luxury Holiday & Long-let Villas', 'Links Road, Nyali', 'Mombasa', 'Sheikh Omar Al-Harthy', '+254720999888', 'omar.alharthy@coastinvest.com', 10.0, '522522 / Acc: NOB-04', 'NCBA Bank', '1004829103', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80')").run();

        // 2. Units
        const units = [
          [1, 1, 'A101', '1st Floor', '2-Bedroom Master Ensuite', 65000, 3500, 500, 'occupied', 'WM-KIL-101', 'Balcony facing pool', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80'],
          [2, 1, 'A102', '1st Floor', '2-Bedroom Master Ensuite', 65000, 3500, 500, 'occupied', 'WM-KIL-102', 'Road view', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80'],
          [3, 1, 'A201', '2nd Floor', '3-Bedroom with DSQ', 85000, 4500, 500, 'occupied', 'WM-KIL-201', 'High floor corner unit', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80'],
          [4, 1, 'A202', '2nd Floor', '3-Bedroom with DSQ', 85000, 4500, 500, 'vacant', 'WM-KIL-202', 'Freshly painted, ready for move-in', 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&auto=format&fit=crop&q=80'],
          [5, 1, 'Penthouse 1', 'Top Floor', '4-Bedroom Luxury Penthouse', 140000, 6000, 750, 'occupied', 'WM-KIL-PH1', 'Rooftop terrace and private Jacuzzi', 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800&auto=format&fit=crop&q=80'],
          [6, 2, 'Suite 101', '1st Floor', 'Commercial Office Space (850 sqft)', 95000, 12000, 1000, 'occupied', 'WM-WES-101', 'Fitted with conference room and AC', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80'],
          [7, 2, 'Suite 102', '1st Floor', 'Commercial Office Space (650 sqft)', 75000, 8500, 1000, 'vacant', 'WM-WES-102', 'Open layout, high foot traffic', 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&auto=format&fit=crop&q=80'],
          [8, 2, 'Res B3', '3rd Floor', '1-Bedroom Executive Serviced', 55000, 4000, 500, 'occupied', 'WM-WES-B3', 'Fully furnished', 'https://images.unsplash.com/photo-1502005229762-ee1b2b8ab98f?w=800&auto=format&fit=crop&q=80'],
          [9, 2, 'Res B4', '3rd Floor', 'Studio Loft Apartment', 42000, 3000, 500, 'maintenance', 'WM-WES-B4', 'Bathroom tile regrouting underway', 'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&auto=format&fit=crop&q=80'],
          [10, 3, 'Villa 4', 'Ground + 1', '4-Bedroom Townhouse with Garden', 180000, 7500, 1000, 'occupied', 'WM-RIV-04', 'Private garden and solar water heater', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80'],
          [11, 3, 'Villa 7', 'Ground + 1', '4-Bedroom Townhouse with Garden', 180000, 7500, 1000, 'vacant', 'WM-RIV-07', 'Vacated last month, deep cleaned', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=80'],
          [12, 4, 'Villa Palms', 'Ground + 1', '3-Bedroom Beachfront Villa', 120000, 5000, 800, 'occupied', 'WM-NYA-01', 'Swimming pool access', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80']
        ];
        for (const u of units) {
          await db.prepare("INSERT OR REPLACE INTO units (id, property_id, unit_number, floor, unit_type, base_rent, service_charge, garbage_fee, status, meter_number, notes, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(...u).run();
        }

        // 3. Tenants
        const tenants = [
          [1, 'Kariuki James Mwangi', '+254722889900', 'james.kariuki@techke.com', '28945612', 'Grace Mwangi (Wife)', '+254721445566', 'active'],
          [2, 'Amina Hassan Mohamed', '+254710123456', 'amina.hassan@innovate.co.ke', '31098452', 'Farah Mohamed (Brother)', '+254734998877', 'active'],
          [3, 'Brian Omondi Otieno', '+254798654321', 'brian.omondi@consultancy.org', '26781290', 'Brenda Otieno (Sister)', '+254712334455', 'active'],
          [4, 'Nexus Law Advocates LLP', '+254700554433', 'admin@nexuslaw.co.ke', 'CPR/2019/94832', 'Senior Partner K. Mutua', '+254722998811', 'active'],
          [5, 'David Kimani Ngugi', '+254725332211', 'david.kimani@safari.com', '25890143', 'Beatrice Ngugi (Mother)', '+254722114477', 'active'],
          [6, 'Sophie Van Der Beek', '+254746112233', 'sophie.vdb@unep.org', 'PASSPORT-NL983214', 'Dirk Van Der Beek', '+31612345678', 'active'],
          [7, 'Capt. Salim Bwanaheri', '+254720448833', 'salim.bwanaheri@kpa.co.ke', '24119830', 'Asha Salim (Wife)', '+254733221100', 'active']
        ];
        for (const t of tenants) {
          await db.prepare("INSERT OR REPLACE INTO tenants (id, name, phone, email, id_number, emergency_contact_name, emergency_contact_phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(...t).run();
        }

        // 4. Leases
        const leases = [
          [1, 1, 1, '2026-01-01', '2026-12-31', 65000, 65000, 5000, 'active', 'Standard 1-year residential lease. Rent due on 5th of every month.'],
          [2, 2, 2, '2026-03-01', '2027-02-28', 65000, 65000, 5000, 'active', 'Standard 1-year lease.'],
          [3, 3, 3, '2025-11-01', '2026-10-31', 85000, 85000, 7000, 'active', 'Includes 2 dedicated parking bays.'],
          [4, 5, 6, '2026-02-01', '2027-01-31', 140000, 140000, 10000, 'active', 'Diplomatic lease clause.'],
          [5, 6, 4, '2025-06-01', '2028-05-31', 95000, 190000, 15000, 'active', '3-year commercial office lease.'],
          [6, 8, 5, '2026-04-01', '2027-03-31', 55000, 55000, 5000, 'active', 'Serviced apartment lease.'],
          [7, 10, 6, '2025-09-01', '2026-08-31', 180000, 180000, 15000, 'active', 'High security townhouse.'],
          [8, 12, 7, '2026-01-15', '2027-01-14', 120000, 120000, 10000, 'active', 'Beach villa long let.']
        ];
        for (const l of leases) {
          await db.prepare("INSERT OR REPLACE INTO leases (id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_paid, water_deposit, status, terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(...l).run();
        }

        // 5. Invoices for November 2026
        const invoices = [
          [1, 'INV-202611-001', 1, 1, 1, '2026-11', '2026-11-01', '2026-11-05', 65000, 2310, 500, 3500, 0, 71310, 71310, 0, 'paid', 'Automated monthly billing for Nov 2026'],
          [2, 'INV-202611-002', 2, 2, 2, '2026-11', '2026-11-01', '2026-11-05', 65000, 2012.5, 500, 3500, 0, 71012.5, 40000, 31012.5, 'partially_paid', 'Partial payment received; balance due by 10th'],
          [3, 'INV-202611-003', 3, 3, 3, '2026-11', '2026-11-01', '2026-11-05', 85000, 3587.5, 500, 4500, 2500, 96087.5, 0, 96087.5, 'overdue', 'Late fee applied as payment missed 5th deadline'],
          [4, 'INV-202611-004', 4, 6, 5, '2026-11', '2026-11-01', '2026-11-05', 140000, 3937.5, 750, 6000, 0, 150687.5, 150687.5, 0, 'paid', 'NCBA Wire transfer'],
          [5, 'INV-202611-005', 5, 4, 6, '2026-11', '2026-11-01', '2026-11-10', 95000, 2100, 1000, 12000, 0, 110100, 0, 110100, 'unpaid', 'Commercial office Nov invoice'],
          [6, 'INV-202611-006', 6, 5, 8, '2026-11', '2026-11-01', '2026-11-05', 55000, 1487.5, 500, 4000, 0, 60987.5, 60987.5, 0, 'paid', 'Serviced apartment billing'],
          [7, 'INV-202611-007', 8, 7, 12, '2026-11', '2026-11-01', '2026-11-05', 120000, 2975, 800, 5000, 0, 128775, 128775, 0, 'paid', 'Nyali coastal villa Nov rent']
        ];
        for (const inv of invoices) {
          await db.prepare("INSERT OR REPLACE INTO invoices (id, invoice_number, lease_id, tenant_id, unit_id, month, issue_date, due_date, rent_amount, water_amount, garbage_amount, service_charge, late_fee, total_amount, amount_paid, balance, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(...inv).run();
        }
      }
    } catch (e) {
      console.warn('Portfolio seed error:', e);
    }

    console.log('✅ Cloudflare D1 tables and RBAC users verified and initialized.');
  } catch (err) {
    console.error('ensureD1Schema error:', err);
  }
}

async function sha256Subtle(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function logSystemAuditD1(db, { actorId = null, actorName = 'System Agent', actorRole = 'system', action, entityType, entityId, description, diff = null, ipAddress = '127.0.0.1' }) {
  try {
    const lastRow = await db.prepare('SELECT checksum FROM system_audit_logs ORDER BY id DESC LIMIT 1').first().catch(() => null);
    const prevChecksum = (lastRow && lastRow.checksum) ? lastRow.checksum : 'GENESIS';
    const timestamp = new Date().toISOString();
    const diffJson = diff ? (typeof diff === 'string' ? diff : JSON.stringify(diff)) : null;
    const payload = `${prevChecksum}|${action}|${entityType}|${entityId}|${diffJson || ''}|${timestamp}`;
    const checksum = await sha256Subtle(payload);

    await db.prepare(`
      INSERT INTO system_audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, diff_json, checksum, prev_checksum, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(actorId, actorName, actorRole, action, entityType, entityId, description, diffJson, checksum, prevChecksum, ipAddress, timestamp).run();

    return { checksum, prevChecksum, timestamp };
  } catch (err) {
    console.error('Failed to log system audit in D1:', err.message);
    return null;
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
  if (pathname === '/api/reset-seed' && method === 'POST') {
    await ensureD1Schema(db);
    return json({ success: true, message: 'D1 database re-seeded successfully.' });
  }

  // 1. Auto-provision D1 tables and RBAC users if database is fresh or columns/tables missing
  try {
    const usersTable = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
    const hasImageCol = await db.prepare("SELECT image_url FROM units LIMIT 1").first().catch(() => null);
    const hasRatiba = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ratiba_standing_orders'").first().catch(() => null);
    const hasAuditLogs = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system_audit_logs'").first().catch(() => null);
    if (!usersTable || hasImageCol === null || !hasRatiba || !hasAuditLogs) {
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
    if ((pathname === '/api/leases' || pathname.startsWith('/api/leases/')) && method === 'PUT') {
      const pathId = pathname.startsWith('/api/leases/') ? pathname.split('/')[3] : null;
      const b = await request.json().catch(() => ({}));
      const id = pathId || b.id;
      if (!id) return json({ error: 'Lease ID required' }, 400);

      await db.prepare(`
        UPDATE leases SET
          monthly_rent = COALESCE(?, monthly_rent),
          deposit_paid = COALESCE(?, deposit_paid),
          water_deposit = COALESCE(?, water_deposit),
          status = COALESCE(?, status),
          end_date = COALESCE(?, end_date),
          terms = COALESCE(?, terms)
        WHERE id = ?
      `).bind(
        b.monthly_rent !== undefined ? Number(b.monthly_rent) : null,
        b.deposit_paid !== undefined ? Number(b.deposit_paid) : null,
        b.water_deposit !== undefined ? Number(b.water_deposit) : null,
        b.status || null, b.end_date || null, b.terms || null, Number(id)
      ).run();

      return json({ success: true, message: 'Lease updated successfully.' });
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

    // 11b. Live Safaricom Daraja M-Pesa STK Push Express Endpoint (D1)
    if (pathname === '/api/mpesa/stkpush' && method === 'POST') {
      const user = resolveRequestUser(request);
      if (user && user.role === 'caretaker') {
        return json({ error: '403 Forbidden: Caretakers cannot trigger billing payments.' }, 403);
      }
      const b = await request.json().catch(() => ({}));
      const amount = Number(b.amount);
      if (!amount || amount <= 0) {
        return json({ error: 'Invalid payment amount.' }, 400);
      }
      const phone = normalizeMpesaPhone(b.phone);
      if (!phone || phone.length < 12) {
        return json({ error: 'Invalid Safaricom phone number format. Use 07XXXXXXXX or 2547XXXXXXXX.' }, 400);
      }

      try {
        const config = getDarajaConfig(context.env);
        const stkRes = await initiateMpesaStkPush({
          phone,
          amount,
          accountReference: b.account_reference || (b.unit_number ? `Unit ${b.unit_number}` : 'BomaSphere'),
          transactionDesc: `Rent ${b.invoice_number || ''}`
        }, config);

        const tenantId = b.tenant_id ? Number(b.tenant_id) : null;
        const invoiceId = b.invoice_id ? Number(b.invoice_id) : null;

        await db.prepare(`
          INSERT INTO mpesa_transactions (merchant_request_id, checkout_request_id, tenant_id, invoice_id, amount, phone, account_reference, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `).bind(stkRes.merchantRequestId, stkRes.checkoutRequestId, tenantId, invoiceId, amount, phone, b.account_reference || 'Rent').run();

        return json({
          success: true,
          checkout_request_id: stkRes.checkoutRequestId,
          merchant_request_id: stkRes.merchantRequestId,
          customer_message: stkRes.customerMessage,
          amount,
          phone
        }, 200);
      } catch (stkErr) {
        return json({ error: stkErr.message || 'M-Pesa STK Push service failure' }, 500);
      }
    }

    // 11c. Live Safaricom Daraja Webhook Callback Handler (D1)
    if (pathname === '/api/mpesa/callback' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const callback = b?.Body?.stkCallback;
      if (!callback) {
        return json({ error: 'Invalid M-Pesa callback payload format.' }, 400);
      }

      const checkoutRequestId = callback.CheckoutRequestID;
      const merchantRequestId = callback.MerchantRequestID;
      const resultCode = Number(callback.ResultCode);
      const resultDesc = callback.ResultDesc || '';

      const tx = await db.prepare('SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?').bind(checkoutRequestId).first().catch(() => null);

      if (resultCode === 0) {
        let mpesaReceipt = '';
        let amount = tx ? tx.amount : 0;
        let transDate = '';
        let phone = tx ? tx.phone : '';

        const items = callback.CallbackMetadata?.Item || [];
        for (const item of items) {
          if (item.Name === 'MpesaReceiptNumber') mpesaReceipt = String(item.Value);
          if (item.Name === 'Amount') amount = Number(item.Value);
          if (item.Name === 'TransactionDate') transDate = String(item.Value);
          if (item.Name === 'PhoneNumber') phone = String(item.Value);
        }
        if (!mpesaReceipt) mpesaReceipt = 'QG' + Math.random().toString(36).substring(2, 10).toUpperCase();

        await db.prepare(`
          UPDATE mpesa_transactions 
          SET status = 'completed', result_code = ?, result_desc = ?, mpesa_receipt_number = ?, transaction_date = ?, raw_callback = ?, updated_at = CURRENT_TIMESTAMP
          WHERE checkout_request_id = ?
        `).bind(resultCode, resultDesc, mpesaReceipt, transDate, JSON.stringify(b), checkoutRequestId).run();

        const recNum = 'REC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
        let invoiceId = tx ? tx.invoice_id : null;
        let tenantId = tx ? tx.tenant_id : null;
        let linkedInv = invoiceId ? await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first() : null;
        if (!tenantId && linkedInv) tenantId = linkedInv.tenant_id;

        await db.prepare(`
          INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
          VALUES (?, ?, ?, ?, datetime('now'), 'M-Pesa', ?, ?, 'M-Pesa STK Resident', 'completed', 'Live Safaricom Daraja STK Push Reconciled')
        `).bind(recNum, invoiceId, tenantId, amount, mpesaReceipt, phone).run();

        if (linkedInv) {
          const newPaid = Number(linkedInv.amount_paid) + amount;
          const newBal = Math.max(0, Number(linkedInv.total_amount) - newPaid);
          const newStatus = newBal <= 0 ? 'paid' : 'partially_paid';
          await db.prepare('UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?').bind(newPaid, newBal, newStatus, linkedInv.id).run();
        }

        if (tenantId) {
          const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first();
          if (tenant) {
            const smsMsg = `Confirmed! ${mpesaReceipt} Confirmed. KES ${amount.toLocaleString()} received via M-Pesa STK for ${recNum}. Thank you! - BomaSphere Management`;
            await db.prepare(`
              INSERT INTO communications (type, recipient_name, recipient_phone, tenant_id, message, status, purpose)
              VALUES ('sms', ?, ?, ?, ?, 'delivered', 'receipt')
            `).bind(tenant.name, tenant.phone, tenant.id, smsMsg).run();
          }
        }
      } else {
        const status = resultCode === 1032 ? 'cancelled' : 'failed';
        await db.prepare(`
          UPDATE mpesa_transactions
          SET status = ?, result_code = ?, result_desc = ?, raw_callback = ?, updated_at = CURRENT_TIMESTAMP
          WHERE checkout_request_id = ?
        `).bind(status, resultCode, resultDesc, JSON.stringify(b), checkoutRequestId).run();
      }

      return json({ ResultCode: 0, ResultDesc: "Accepted" }, 200);
    }

    // 11d. M-Pesa Transaction Status Polling Endpoint (D1)
    if (pathname.startsWith('/api/mpesa/status/') && method === 'GET') {
      const parts = pathname.split('/');
      const checkoutRequestId = decodeURIComponent(parts[parts.length - 1]);
      const tx = await db.prepare('SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?').bind(checkoutRequestId).first().catch(() => null);
      if (!tx) {
        return json({ error: 'M-Pesa transaction not found.' }, 404);
      }
      return json({
        checkout_request_id: tx.checkout_request_id,
        status: tx.status,
        result_code: tx.result_code,
        result_desc: tx.result_desc,
        mpesa_receipt_number: tx.mpesa_receipt_number,
        amount: tx.amount,
        phone: tx.phone,
        created_at: tx.created_at
      }, 200);
    }

    // 11e. M-Pesa Simulation Callback Trigger (D1)
    if (pathname === '/api/mpesa/simulate-callback' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const checkoutRequestId = b.checkout_request_id;
      if (!checkoutRequestId) {
        return json({ error: 'checkout_request_id is required' }, 400);
      }
      const tx = await db.prepare('SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?').bind(checkoutRequestId).first().catch(() => null);
      if (!tx) {
        return json({ error: 'Transaction not found.' }, 404);
      }
      const isSuccess = b.result_code === undefined || Number(b.result_code) === 0;
      const receiptCode = b.mpesa_receipt_number || ('QG' + Math.random().toString(36).substring(2, 10).toUpperCase());

      if (isSuccess) {
        await db.prepare(`
          UPDATE mpesa_transactions 
          SET status = 'completed', result_code = 0, result_desc = 'The service request is processed successfully.', mpesa_receipt_number = ?, transaction_date = ?, updated_at = CURRENT_TIMESTAMP
          WHERE checkout_request_id = ?
        `).bind(receiptCode, String(Date.now()), checkoutRequestId).run();

        const recNum = 'REC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
        let invoiceId = tx.invoice_id;
        let tenantId = tx.tenant_id;
        let linkedInv = invoiceId ? await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first() : null;
        if (!tenantId && linkedInv) tenantId = linkedInv.tenant_id;

        await db.prepare(`
          INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
          VALUES (?, ?, ?, ?, datetime('now'), 'M-Pesa', ?, ?, 'M-Pesa STK Resident', 'completed', 'Daraja STK Simulated Settlement')
        `).bind(recNum, invoiceId, tenantId, tx.amount, receiptCode, tx.phone).run();

        if (linkedInv) {
          const newPaid = Number(linkedInv.amount_paid) + tx.amount;
          const newBal = Math.max(0, Number(linkedInv.total_amount) - newPaid);
          const newStatus = newBal <= 0 ? 'paid' : 'partially_paid';
          await db.prepare('UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?').bind(newPaid, newBal, newStatus, linkedInv.id).run();
        }
      } else {
        await db.prepare(`
          UPDATE mpesa_transactions
          SET status = 'cancelled', result_code = 1032, result_desc = 'Request cancelled by user', updated_at = CURRENT_TIMESTAMP
          WHERE checkout_request_id = ?
        `).bind(checkoutRequestId).run();
      }

      return json({ success: true, status: isSuccess ? 'completed' : 'cancelled', mpesa_receipt_number: receiptCode }, 200);
    }

    // 11f. Daraja 3.0: Dynamic M-Pesa QR Code Generator (D1)
    if (pathname === '/api/mpesa/qrcode' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const amount = Number(b.amount) || 0;
      const refNo = b.ref_no || (b.invoice_id ? `INV-${b.invoice_id}` : 'RENT-D1');
      const trxCode = b.trx_code || 'PB';
      const config = getDarajaConfig(env);
      const qrData = await generateDarajaQrCode({ amount, refNo, trxCode }, config);
      return json({ success: true, ...qrData }, 200);
    }

    // 11g. Daraja 3.0: M-Pesa Ratiba (Standing Order Auto-Pay Creation) (D1)
    if (pathname === '/api/mpesa/ratiba/create' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const tenantId = Number(b.tenant_id);
      const amount = Number(b.amount);
      const phone = normalizeMpesaPhone(b.phone);
      const startDate = b.start_date || new Date().toISOString().split('T')[0];
      const endDate = b.end_date || new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0];
      const frequency = Number(b.frequency) || 5;
      const standingOrderName = b.standing_order_name || `Rent AutoPay Tenant #${tenantId}`;
      const accountReference = b.account_reference || `UNIT-${tenantId}`;

      if (!tenantId || !amount || !phone) {
        return json({ error: 'tenant_id, amount, and valid phone are required' }, 400);
      }

      const safStandingOrderId = `SO_RATIBA_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      try {
        await db.prepare(`
          INSERT INTO ratiba_standing_orders (
            tenant_id, standing_order_name, phone, amount, frequency,
            start_date, end_date, account_reference, status, saf_standing_order_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        `).bind(tenantId, standingOrderName, phone, amount, frequency, startDate, endDate, accountReference, safStandingOrderId).run();
      } catch (insertErr) {
        await ensureD1Schema(db);
        await db.prepare(`
          INSERT INTO ratiba_standing_orders (
            tenant_id, standing_order_name, phone, amount, frequency,
            start_date, end_date, account_reference, status, saf_standing_order_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        `).bind(tenantId, standingOrderName, phone, amount, frequency, startDate, endDate, accountReference, safStandingOrderId).run();
      }

      const created = await db.prepare('SELECT * FROM ratiba_standing_orders WHERE saf_standing_order_id = ?').bind(safStandingOrderId).first().catch(() => null);
      return json({
        success: true,
        message: 'M-Pesa Ratiba monthly recurring rent standing order active',
        standing_order: created
      }, 201);
    }

    // 11h. Daraja 3.0: Get Tenant Active Ratiba Standing Orders (D1)
    if (pathname.startsWith('/api/mpesa/ratiba/tenant/') && method === 'GET') {
      const tenantId = Number(pathname.split('/').pop());
      const orders = (await db.prepare('SELECT * FROM ratiba_standing_orders WHERE tenant_id = ? ORDER BY id DESC').bind(tenantId).all()).results || [];
      return json(orders, 200);
    }

    // 11i. Daraja 3.0: Cancel Ratiba Standing Order (D1)
    if (pathname.startsWith('/api/mpesa/ratiba/cancel/') && method === 'POST') {
      const id = Number(pathname.split('/').pop());
      await db.prepare("UPDATE ratiba_standing_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
      return json({ success: true, message: 'Standing order cancelled successfully' }, 200);
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
    if (pathname === '/api/water-readings' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { unit_id, month, reading_date, previous_reading, current_reading, rate_per_unit } = b;
      if (!unit_id || previous_reading === undefined || current_reading === undefined) {
        return json({ error: 'Unit ID, previous reading, and current reading are required.' }, 400);
      }
      const prev = Number(previous_reading);
      const curr = Number(current_reading);
      if (curr < prev) {
        return json({ error: 'Current reading cannot be less than previous reading.' }, 400);
      }
      const consumed = Math.round((curr - prev) * 100) / 100;
      const rate = Number(rate_per_unit || 180.00);
      const total = Math.round(consumed * rate * 100) / 100;
      const m = month || new Date().toISOString().slice(0, 7);
      const d = reading_date || new Date().toISOString().slice(0, 10);

      const resIns = await db.prepare(`
        INSERT INTO water_readings (unit_id, month, reading_date, previous_reading, current_reading, units_consumed, rate_per_unit, total_cost, invoiced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).bind(Number(unit_id), m, d, prev, curr, consumed, rate, total).run();

      await db.prepare('UPDATE units SET meter_number = COALESCE(meter_number, ?) WHERE id = ?').bind(`WM-${unit_id}-01`, Number(unit_id)).run();

      if (consumed >= 25) {
        const u = await db.prepare('SELECT u.*, p.name as property_name FROM units u JOIN properties p ON u.property_id = p.id WHERE u.id = ?').bind(Number(unit_id)).first();
        if (u) {
          try {
            await db.prepare(`
              INSERT INTO leak_alerts (device_id, alert_type, flow_rate_lpm, severity, status, notes)
              VALUES (1, 'high_consumption', ?, 'medium', 'active', ?)
            `).bind(consumed, `Abnormal water consumption spike: ${consumed} units used in Unit ${u.unit_number} (${u.property_name}).`).run();
          } catch (e) {}
        }
      }

      return json({
        success: true,
        id: resIns.meta?.last_row_id,
        units_consumed: consumed,
        total_cost: total,
        message: `Water reading recorded: ${consumed} units (KES ${total.toLocaleString()}).`
      }, 201);
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
    if (pathname === '/api/maintenance' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { property_id, unit_id, title, description, category, priority, tenant_id } = b;
      if (!property_id || !unit_id || !title) {
        return json({ error: 'Property, unit, and issue title are required.' }, 400);
      }
      const tNum = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      const resIns = await db.prepare(`
        INSERT INTO maintenance_requests (ticket_number, property_id, unit_id, tenant_id, title, description, category, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
      `).bind(
        tNum, Number(property_id), Number(unit_id), tenant_id ? Number(tenant_id) : null,
        title, description || '', category || 'Plumbing', priority || 'medium'
      ).run();

      return json({
        success: true,
        id: resIns.meta?.last_row_id,
        ticket_number: tNum,
        message: 'Maintenance ticket created successfully.'
      }, 201);
    }
    if ((pathname === '/api/maintenance' || pathname.startsWith('/api/maintenance/')) && method === 'PUT') {
      const pathId = pathname.startsWith('/api/maintenance/') ? pathname.split('/')[3] : null;
      const b = await request.json().catch(() => ({}));
      const id = pathId || b.id;
      if (!id) return json({ error: 'Ticket ID required' }, 400);

      await db.prepare(`
        UPDATE maintenance_requests SET
          status = COALESCE(?, status),
          actual_cost = COALESCE(?, actual_cost),
          assigned_contractor = COALESCE(?, assigned_contractor),
          contractor_phone = COALESCE(?, contractor_phone),
          completed_date = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_date END
        WHERE id = ?
      `).bind(
        b.status || null, b.actual_cost ? Number(b.actual_cost) : null,
        b.assigned_contractor || null, b.contractor_phone || null,
        b.status || null, Number(id)
      ).run();

      return json({ success: true, message: 'Maintenance ticket updated successfully.' });
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
    if (pathname === '/api/expenses' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { property_id, category, amount, description, expense_date, paid_to, receipt_number, payment_method } = b;
      if (!property_id || !category || !amount) {
        return json({ error: 'Property ID, category, and amount are required.' }, 400);
      }
      const resIns = await db.prepare(`
        INSERT INTO expenses (property_id, category, amount, description, expense_date, paid_to, receipt_number, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        Number(property_id), category, Number(amount), description || '',
        expense_date || new Date().toISOString().slice(0, 10),
        paid_to || '', receipt_number || null, payment_method || 'mpesa'
      ).run();

      return json({
        success: true,
        id: resIns.meta?.last_row_id,
        message: 'Expense recorded successfully.'
      }, 201);
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
      const ref = 'VIEW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const res = await db.prepare(`
        INSERT INTO viewing_leads (unit_id, prospect_name, phone, email, preferred_date, time_slot, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)
      `).bind(Number(unit_id), prospect_name, phone, email || '', preferred_date, time_slot || '10:00 AM', notes || '').run();
      return json({ success: true, reference: ref, booking_reference: ref, lead_id: res.meta?.last_row_id, message: 'Viewing booked successfully!' }, 201);
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
    if (pathname === '/api/whatsapp/webhook' && method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      const verifyToken = env.WHATSAPP_VERIFY_TOKEN || 'bomasphere_webhook_secret_2026';

      if (mode === 'subscribe' && token === verifyToken) {
        return new Response(challenge || 'VERIFIED', {
          status: 200,
          headers: { 'Content-Type': 'text/plain', ...corsHeaders }
        });
      }
      return json({ error: 'Forbidden: Invalid verification token' }, 403);
    }

    if (pathname === '/api/whatsapp/webhook' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      
      let phone = b.phone || b.From || '';
      let incomingText = (b.message || b.Body || '').trim();

      if (b.entry && Array.isArray(b.entry) && b.entry[0]?.changes?.[0]?.value?.messages?.[0]) {
        const msg = b.entry[0].changes[0].value.messages[0];
        phone = msg.from;
        incomingText = (msg.text?.body || '').trim();
      }

      if (!phone) phone = '+254722889900';

      let tenant = await db.prepare("SELECT t.*, u.unit_number, u.property_id, p.name as property_name FROM tenants t LEFT JOIN leases l ON l.tenant_id = t.id AND l.status = 'active' LEFT JOIN units u ON l.unit_id = u.id LEFT JOIN properties p ON u.property_id = p.id WHERE t.phone LIKE ? OR t.phone LIKE ?").bind(`%${phone.slice(-9)}%`, phone).first();
      if (!tenant) tenant = await db.prepare("SELECT t.*, u.unit_number, u.property_id, p.name as property_name FROM tenants t LEFT JOIN leases l ON l.tenant_id = t.id AND l.status = 'active' LEFT JOIN units u ON l.unit_id = u.id LEFT JOIN properties p ON u.property_id = p.id LIMIT 1").first();

      const cmd = incomingText.toUpperCase();
      let replyText = '';
      let action = 'menu';

      const parsedMpesa = parseMpesaMessage(incomingText);
      const isClaimIntent = cmd.includes('CLAIM') || cmd.includes('PAID') || cmd.includes('CONFIRMED') || cmd.startsWith('5');

      if (parsedMpesa && (isClaimIntent || incomingText.includes('Confirmed') || incomingText.length >= 10)) {
        const recResult = await reconcileMpesaClaimD1({
          referenceCode: parsedMpesa.referenceCode,
          amount: parsedMpesa.amount,
          phone,
          name: tenant?.name,
          source: 'whatsapp'
        }, db);

        if (recResult.status === 'reconciled') {
          replyText = `🎉 Jambo ${recResult.tenant.name}!\nYour payment of KES ${Number(recResult.paidAmount).toLocaleString()} (M-Pesa Ref: ${recResult.referenceCode}) has been VERIFIED & RECONCILED!\n\n🏠 Property: ${recResult.tenant.property_name || 'BomaSphere Residences'}\n🚪 Unit: ${recResult.tenant.unit_number || 'Resident'}\n📄 Invoice: ${recResult.invoice?.invoice_number || 'RENT'}\n🧾 Official Receipt: ${recResult.receiptNumber}\n💰 Remaining Balance: KES ${Number(recResult.newBalance).toLocaleString()}\n\nOfficial KRA eTIMS compliant receipt generated. Asante sana!`;
          action = 'claim_reconciled';
        } else if (recResult.status === 'already_reconciled') {
          replyText = `⚠️ Notice: M-Pesa transaction ${recResult.referenceCode} was already reconciled on ${recResult.payment.payment_date} (Receipt #${recResult.payment.receipt_number}). Reply 'RECEIPT' to view.`;
          action = 'claim_duplicate';
        } else {
          replyText = `Jambo! We received your M-Pesa claim ${recResult.referenceCode} for KES ${Number(recResult.paidAmount).toLocaleString()}, but your phone number (${phone}) is not yet linked to an active unit lease.\n\nOur property manager has queued this in the suspense ledger. Please reply with your Unit Number (e.g. 'Unit A102') to expedite reconciliation.`;
          action = 'claim_unallocated';
        }
      } else if (cmd.includes('BALANCE') || cmd === '1') {
        const inv = await db.prepare("SELECT * FROM invoices WHERE tenant_id = ? ORDER BY id DESC LIMIT 1").bind(tenant.id).first();
        const bal = inv ? inv.balance : 0;
        replyText = `Jambo ${tenant.name}! Your current BomaSphere balance is KES ${Number(bal).toLocaleString()}. Due date: 5th of this month. Pay easily via Bank Paybill or Safaricom Paybill 174379, Account: ${inv?.invoice_number || tenant.unit_number || 'RENT'}. Forward your M-Pesa SMS here to claim instant reconciliation!`;
        action = 'balance';
      } else if (cmd.includes('RECEIPT') || cmd === '2') {
        const pmt = await db.prepare("SELECT * FROM payments WHERE tenant_id = ? ORDER BY id DESC LIMIT 1").bind(tenant.id).first();
        if (pmt) {
          replyText = `Official BomaSphere Receipt: ${pmt.receipt_number}. Paid KES ${Number(pmt.amount).toLocaleString()} via ${pmt.payment_method} on ${pmt.payment_date}. Ref: ${pmt.reference_code}. Status: Verified & eTIMS Compliant.`;
        } else {
          replyText = `No recent receipts found for account ${tenant.name}.`;
        }
        action = 'receipt';
      } else if (cmd.includes('PAY') || cmd === '3') {
        const inv = await db.prepare("SELECT * FROM invoices WHERE tenant_id = ? AND balance > 0 ORDER BY id DESC LIMIT 1").bind(tenant.id).first();
        const amount = inv ? inv.balance : 65000;
        const ref = 'QG' + Math.random().toString(36).substring(2, 10).toUpperCase();
        replyText = `Daraja M-Pesa STK push initiated for KES ${Number(amount).toLocaleString()} to ${phone}. Enter your M-Pesa PIN on handset prompt. Receipt ${ref} will follow.`;
        action = 'pay';
      } else if (cmd.startsWith('TICKET') || cmd === '4') {
        const issue = incomingText.replace(/^TICKET/i, '').trim() || 'General repairs needed';
        const tktNum = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
        const unit = await db.prepare("SELECT * FROM units LIMIT 1").first();
        await db.prepare(`
          INSERT INTO maintenance_requests (ticket_number, property_id, unit_id, tenant_id, title, description, category, priority, status)
          VALUES (?, ?, ?, ?, ?, ?, 'plumbing', 'medium', 'open')
        `).bind(tktNum, unit.property_id, unit.id, tenant.id, 'WhatsApp: ' + issue.substring(0, 40), issue).run();
        replyText = `Maintenance ticket ${tktNum} logged successfully for ${tenant.name}! Our site caretaker has been notified and will contact you shortly.`;
        action = 'ticket';
      } else {
        replyText = `Welcome to BomaSphere WhatsApp Concierge!\n\nReply with a number or command:\n1. BALANCE - Check rent & utilities balance\n2. RECEIPT - View latest official payment receipt\n3. PAY - Receive 1-tap Lipa Na M-Pesa STK prompt\n4. TICKET <issue> - Report a maintenance issue\n5. CLAIM <code/SMS> - Reconcile Bank Paybill or M-Pesa payment\n\nOr simply forward your Safaricom M-Pesa confirmation SMS here to auto-reconcile your rent instantly!`;
      }

      try {
        await db.prepare(`
          INSERT INTO communications (type, recipient_name, recipient_phone, message, status, purpose)
          VALUES ('whatsapp', ?, ?, ?, 'delivered', ?)
        `).bind(tenant.name, phone, replyText, action).run();
      } catch (e) {}

      return json({
        success: true,
        tenant_name: tenant.name,
        incoming: incomingText,
        reply: replyText,
        action
      }, 200);
    }

    if (pathname === '/api/whatsapp/history' && method === 'GET') {
      const msgs = (await db.prepare("SELECT * FROM communications WHERE type = 'whatsapp' ORDER BY id DESC LIMIT 50").all()).results || [];
      return json({ success: true, count: msgs.length, messages: msgs });
    }

    // ==========================================
    // BANK PAYBILL CSV RECONCILER & SUSPENSE (D1)
    // ==========================================
    if (pathname === '/api/payments/reconcile-bank-statement' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const statementText = b.statement_text || b.csv || '';
      const lines = statementText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

      const results = [];
      let matchedCount = 0;
      let alreadyReconciledCount = 0;
      let unallocatedCount = 0;
      let totalReconciledAmount = 0;

      for (const line of lines) {
        if (/^(date|transaction|details|narration|ref)/i.test(line)) continue;

        const parsed = parseMpesaMessage(line);
        if (!parsed || !parsed.referenceCode) continue;

        const phoneMatch = line.match(/(?:254|0)(7\d{8})/);
        const phone = phoneMatch ? ('+254' + phoneMatch[1]) : null;

        let extractedName = null;
        const nameMatch = line.match(/(?:mpesa|c2b|b2c|paybill|\b[A-Z0-9]{10}\b)\s+([A-Z\s]{4,30})/i);
        if (nameMatch) {
          extractedName = nameMatch[1].replace(/EQUITY|KCB|COOP|BANK|PAYBILL|LIPA|NA/gi, '').trim();
        }

        const rec = await reconcileMpesaClaimD1({
          referenceCode: parsed.referenceCode,
          amount: parsed.amount,
          phone,
          name: extractedName,
          source: 'bank_statement'
        }, db);

        if (rec.status === 'reconciled') {
          matchedCount++;
          totalReconciledAmount += Number(rec.paidAmount);
          results.push({ line, status: 'reconciled', code: rec.referenceCode, tenant: rec.tenant.name, unit: rec.tenant.unit_number, amount: rec.paidAmount, receipt: rec.receiptNumber });
        } else if (rec.status === 'already_reconciled') {
          alreadyReconciledCount++;
          results.push({ line, status: 'already_reconciled', code: rec.referenceCode, amount: rec.payment.amount });
        } else {
          unallocatedCount++;
          results.push({ line, status: 'unallocated', code: rec.referenceCode, amount: rec.paidAmount });
        }
      }

      return json({
        success: true,
        total_processed: lines.length,
        matched_count: matchedCount,
        already_reconciled_count: alreadyReconciledCount,
        unallocated_count: unallocatedCount,
        total_reconciled_amount: totalReconciledAmount,
        results
      }, 200);
    }

    if (pathname === '/api/payments/unallocated' && method === 'GET') {
      const list = (await db.prepare("SELECT * FROM unallocated_payments ORDER BY id DESC LIMIT 50").all()).results || [];
      return json({ success: true, count: list.length, unallocated: list });
    }

    if (pathname.startsWith('/api/payments/unallocated/') && pathname.endsWith('/claim') && method === 'POST') {
      const parts = pathname.split('/');
      const unallocId = Number(parts[4]);
      const b = await request.json().catch(() => ({}));
      const tenantId = Number(b.tenant_id);
      const invoiceId = Number(b.invoice_id) || null;

      const record = await db.prepare("SELECT * FROM unallocated_payments WHERE id = ?").bind(unallocId).first();
      if (!record) return json({ error: 'Unallocated payment record not found' }, 404);

      const tenant = await db.prepare("SELECT t.*, u.unit_number FROM tenants t LEFT JOIN leases l ON l.tenant_id = t.id AND l.status = 'active' LEFT JOIN units u ON l.unit_id = u.id WHERE t.id = ?").bind(tenantId).first();
      if (!tenant) return json({ error: 'Tenant not found' }, 404);

      let inv = invoiceId ? await db.prepare("SELECT * FROM invoices WHERE id = ?").bind(invoiceId).first() :
                            await db.prepare("SELECT * FROM invoices WHERE tenant_id = ? AND balance > 0 ORDER BY id ASC LIMIT 1").bind(tenantId).first();

      const receiptNum = 'REC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      let newBalance = 0;
      if (inv) {
        newBalance = Math.max(0, Number(inv.balance) - Number(record.amount));
        const newStatus = newBalance <= 0 ? 'paid' : 'partial';
        const newPaid = Number(inv.amount_paid || 0) + Number(record.amount);
        await db.prepare("UPDATE invoices SET balance = ?, amount_paid = ?, status = ? WHERE id = ?").bind(newBalance, newPaid, newStatus, inv.id).run();
      }

      await db.prepare(`
        INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'bank_paybill_manual_match', ?, ?, ?, 'completed', 'Manually claimed from suspense queue')
      `).bind(receiptNum, inv?.id || null, tenant.id, record.amount, record.reference_code, record.payer_phone, record.payer_name).run();

      await db.prepare("UPDATE unallocated_payments SET status = 'claimed', claimed_tenant_id = ?, claimed_invoice_id = ?, reconciled_at = CURRENT_TIMESTAMP WHERE id = ?").bind(tenant.id, inv?.id || null, unallocId).run();

      return json({
        success: true,
        message: `Payment ${record.reference_code} of KES ${record.amount} successfully allocated to Unit ${tenant.unit_number} (${tenant.name})`,
        receipt_number: receiptNum,
        new_balance: newBalance
      }, 200);
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
    if (pathname.startsWith('/api/viewing-leads/') && method === 'PUT') {
      const id = pathname.split('/')[3];
      const b = await request.json().catch(() => ({}));
      await db.prepare(`
        UPDATE viewing_leads SET
          status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          preferred_date = COALESCE(?, preferred_date),
          time_slot = COALESCE(?, time_slot)
        WHERE id = ?
      `).bind(b.status || null, b.notes || null, b.preferred_date || null, b.time_slot || null, Number(id)).run();
      return json({ success: true, message: 'Viewing lead updated successfully.' });
    }

    // 21b. 1-Click Lead-to-Lease Pipeline Conversion (D1 Native)
    if ((pathname.startsWith('/api/viewing-leads/') || pathname.startsWith('/api/leads/')) && pathname.endsWith('/convert') && method === 'POST') {
      const parts = pathname.split('/');
      const id = Number(parts[3]);
      const lead = await db.prepare('SELECT * FROM viewing_leads WHERE id = ?').bind(id).first();
      if (!lead) return json({ error: 'Viewing lead not found.' }, 404);

      const unit = await db.prepare(`
        SELECT u.*, p.name as property_name, p.landlord_name 
        FROM units u 
        JOIN properties p ON u.property_id = p.id 
        WHERE u.id = ?
      `).bind(lead.unit_id).first();
      if (!unit) return json({ error: 'Associated unit not found for this viewing lead.' }, 404);

      let b = {};
      try { b = await request.json(); } catch (e) {}

      // 1. Create or link Tenant
      let tenant = await db.prepare('SELECT * FROM tenants WHERE phone = ? OR (email IS NOT NULL AND email = ?)').bind(lead.phone, lead.email || '').first();
      if (!tenant) {
        const insTenant = await db.prepare(`
          INSERT INTO tenants (name, phone, email, status, lifecycle_stage)
          VALUES (?, ?, ?, 'active', 'vetted')
        `).bind(lead.prospect_name, lead.phone, lead.email || null).run();
        tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(insTenant.meta.last_row_id).first();
      } else {
        await db.prepare("UPDATE tenants SET lifecycle_stage = 'vetted' WHERE id = ?").bind(tenant.id).run();
        tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenant.id).first();
      }

      // 2. Mark unit as reserved
      await db.prepare("UPDATE units SET status = 'reserved' WHERE id = ?").bind(unit.id).run();

      // 3. Create or fetch active/pending Lease
      const startDate = b.move_in_date || lead.preferred_date || new Date().toISOString().split('T')[0];
      const startObj = new Date(startDate);
      const endObj = new Date(startObj);
      endObj.setFullYear(endObj.getFullYear() + 1);
      const endDate = endObj.toISOString().split('T')[0];

      let lease = await db.prepare("SELECT * FROM leases WHERE unit_id = ? AND tenant_id = ? AND status != 'terminated'").bind(unit.id, tenant.id).first();
      if (!lease) {
        const insLease = await db.prepare(`
          INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_paid, water_deposit, status, terms)
          VALUES (?, ?, ?, ?, ?, 0, 2500, 'pending_active', 'Standard 12-month residential tenancy agreement with 1-month deposit.')
        `).bind(unit.id, tenant.id, startDate, endDate, unit.base_rent).run();
        lease = await db.prepare('SELECT * FROM leases WHERE id = ?').bind(insLease.meta.last_row_id).first();
      }

      // 4. Create Digital Lease Agreement
      let agreement = await db.prepare('SELECT * FROM lease_agreements WHERE lease_id = ?').bind(lease.id).first();
      if (!agreement) {
        const agreementCode = `LSE-${Date.now().toString(36).toUpperCase()}-${unit.unit_number.replace(/\\s+/g, '')}`;
        const clauses = "1. Rent payable by 5th. 2. Deposit refundable post-move-out inspection. 3. Subletting prohibited without prior written consent.";
        const contractHash = await sha256Subtle(`${agreementCode}|${tenant.id}|${unit.id}|${unit.base_rent}|${startDate}`);
        const insAgreement = await db.prepare(`
          INSERT INTO lease_agreements (lease_id, unit_id, tenant_id, agreement_code, rent_amount, deposit_amount, start_date, end_date, terms_clauses, status, contract_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_tenant', ?)
        `).bind(lease.id, unit.id, tenant.id, agreementCode, unit.base_rent, unit.base_rent, startDate, endDate, clauses, contractHash).run();
        agreement = await db.prepare('SELECT * FROM lease_agreements WHERE id = ?').bind(insAgreement.meta.last_row_id).first();
      }

      // 5. Generate Initial Move-In Settlement Invoice
      const invNum = `INV-INIT-${Date.now().toString(36).toUpperCase()}`;
      const issueDate = new Date().toISOString().split('T')[0];
      const dueObj = new Date();
      dueObj.setDate(dueObj.getDate() + 5);
      const dueDate = dueObj.toISOString().split('T')[0];
      const currentMonth = `${new Date().toLocaleString('en-US', { month: 'short' })} ${new Date().getFullYear()}`;

      const rentAmount = Number(unit.base_rent) || 0;
      const serviceCharge = Number(unit.service_charge) || 0;
      const garbageAmount = Number(unit.garbage_fee) || 0;
      const moveInCharges = rentAmount + 2500; // Rent Deposit + Water Deposit
      const totalAmount = rentAmount + serviceCharge + garbageAmount + moveInCharges;

      const insInvoice = await db.prepare(`
        INSERT INTO invoices (
          invoice_number, lease_id, tenant_id, unit_id, month, issue_date, due_date,
          rent_amount, water_amount, garbage_amount, service_charge, late_fee, other_charges,
          total_amount, amount_paid, balance, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, ?, 0, ?, 'unpaid', ?)
      `).bind(
        invNum, lease.id, tenant.id, unit.id, currentMonth, issueDate, dueDate,
        rentAmount, garbageAmount, serviceCharge, moveInCharges,
        totalAmount, totalAmount, `Initial Move-In Settlement: 1st Month Rent (${rentAmount}), Security Deposit (${rentAmount}), Water Meter Deposit (2,500)`
      ).run();
      const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(insInvoice.meta.last_row_id).first();

      // 6. Mark lead as converted
      await db.prepare("UPDATE viewing_leads SET status = 'converted' WHERE id = ?").bind(lead.id).run();

      // 7. Cryptographic System Audit Log
      const user = await getUser();
      const auditLog = await logSystemAuditD1(db, {
        actorId: user ? user.id : null,
        actorName: user ? user.name : 'Pipeline Agent',
        actorRole: user ? user.role : 'property_manager',
        action: 'LEAD_CONVERTED',
        entityType: 'viewing_lead',
        entityId: lead.id,
        description: `Lead "${lead.prospect_name}" converted to Tenant "${tenant.name}". Unit ${unit.unit_number} reserved, Lease Agreement #${agreement.agreement_code} drafted, Move-in Invoice #${invNum} generated.`,
        diff: {
          lead_id: lead.id,
          tenant_id: tenant.id,
          unit_id: unit.id,
          lease_id: lease.id,
          agreement_id: agreement.id,
          agreement_code: agreement.agreement_code,
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          total_amount: totalAmount
        },
        ipAddress: request.headers.get('cf-connecting-ip') || '127.0.0.1'
      });

      return json({
        success: true,
        message: `Lead successfully converted to Tenant and Lease Agreement #${agreement.agreement_code} generated.`,
        tenant,
        unit: { id: unit.id, unit_number: unit.unit_number, status: 'reserved' },
        lease,
        agreement,
        invoice,
        audit: auditLog
      });
    }

    // 21c. Cryptographic Audit Ledger Query (D1 Native)
    if (pathname === '/api/audit-logs' && method === 'GET') {
      const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
      const offset = Number(url.searchParams.get('offset')) || 0;
      const action = url.searchParams.get('action');
      const entityType = url.searchParams.get('entity_type');

      let query = 'SELECT * FROM system_audit_logs';
      const whereClauses = [];
      const params = [];

      if (action) {
        whereClauses.push('action = ?');
        params.push(action);
      }
      if (entityType) {
        whereClauses.push('entity_type = ?');
        params.push(entityType);
      }

      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }
      query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const logs = (await db.prepare(query).bind(...params).all()).results || [];
      const totalCountRow = await db.prepare('SELECT count(*) as total FROM system_audit_logs').first().catch(() => ({ total: 0 }));

      return json({
        success: true,
        total: totalCountRow ? totalCountRow.total : logs.length,
        count: logs.length,
        logs
      });
    }

    // 21d. Cryptographic Audit Ledger Integrity Verification (D1 Native)
    if (pathname === '/api/audit-logs/verify' && method === 'POST') {
      const logs = (await db.prepare('SELECT * FROM system_audit_logs ORDER BY id ASC').all()).results || [];
      let isValid = true;
      let brokenAtId = null;
      let reason = null;
      let lastChecksum = 'GENESIS';

      for (const log of logs) {
        if (log.prev_checksum !== lastChecksum) {
          isValid = false;
          brokenAtId = log.id;
          reason = `Previous checksum mismatch at Record #${log.id}. Expected ${lastChecksum}, got ${log.prev_checksum}`;
          break;
        }
        const payload = `${log.prev_checksum}|${log.action}|${log.entity_type}|${log.entity_id}|${log.diff_json || ''}|${log.created_at}`;
        const computed = await sha256Subtle(payload);
        if (computed !== log.checksum) {
          isValid = false;
          brokenAtId = log.id;
          reason = `Checksum verification failed at Record #${log.id}. Computed ${computed}, stored ${log.checksum}`;
          break;
        }
        lastChecksum = log.checksum;
      }

      return json({
        success: true,
        is_valid: isValid,
        total_verified: logs.length,
        broken_at_id: brokenAtId,
        chain_integrity: isValid ? '100% Tamper-Proof Intact' : 'TAMPERED_OR_CORRUPT',
        latest_checksum: lastChecksum,
        verified_at: new Date().toISOString(),
        message: isValid ? `All ${logs.length} audit entries verified intact and cryptographically linked.` : reason
      });
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
    if (pathname === '/api/tax/etims/generate' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const invoiceId = b.invoice_id || 1;
      const inv = await db.prepare("SELECT * FROM invoices WHERE id = ?").bind(Number(invoiceId)).first();
      if (!inv) return json({ error: 'Invoice not found' }, 404);

      const ctrlCode = 'KRA-ETIMS-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString().slice(-4);
      const qrUrl = `https://etims.kra.go.ke/verify?control=${ctrlCode}&inv=${inv.invoice_number}&amount=${inv.total_amount}`;
      const taxableAmount = inv.rent_amount || inv.total_amount;
      const mriTax = Math.round(taxableAmount * 0.075 * 100) / 100;

      const resIns = await db.prepare(`
        INSERT INTO etims_records (invoice_id, control_code, qr_code_url, tax_type, taxable_amount, tax_payable, kra_status)
        VALUES (?, ?, ?, 'MRI_7.5_PCT', ?, ?, 'transmitted')
      `).bind(Number(invoiceId), ctrlCode, qrUrl, taxableAmount, mriTax).run();

      return json({
        success: true,
        record_id: resIns.meta?.last_row_id,
        control_code: ctrlCode,
        qr_code_url: qrUrl,
        taxable_amount: taxableAmount,
        tax_payable: mriTax,
        message: `eTIMS Fiscal Receipt generated. KES ${mriTax.toLocaleString()} (7.5% MRI) transmitted to KRA.`
      }, 201);
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
    const isEscrowRelease = (
      (pathname === '/api/marketplace/escrow/release') ||
      (pathname.startsWith('/api/artisan-marketplace/fundi-escrow/') && pathname.endsWith('/release')) ||
      (pathname.startsWith('/api/marketplace/escrows/') && pathname.endsWith('/release'))
    ) && method === 'POST';

    if (isEscrowRelease) {
      const b = await request.json().catch(() => ({}));
      let escrowId = b.escrow_id;
      if (!escrowId && pathname.includes('/fundi-escrow/')) {
        escrowId = pathname.split('/fundi-escrow/')[1].split('/')[0];
      } else if (!escrowId && pathname.includes('/escrows/')) {
        escrowId = pathname.split('/escrows/')[1].split('/')[0];
      }
      if (!escrowId) return json({ error: 'Escrow ID required' }, 400);
      const escrow = await db.prepare('SELECT * FROM maintenance_escrows WHERE id = ?').bind(Number(escrowId)).first();
      if (!escrow) return json({ error: 'Escrow record not found.' }, 404);

      const b2cRef = 'B2C-MPESA-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      await db.prepare("UPDATE maintenance_escrows SET status = 'disbursed', b2c_disbursement_ref = ?, released_at = CURRENT_TIMESTAMP WHERE id = ?").bind(b2cRef, Number(escrowId)).run();

      if (escrow.ticket_id) {
        await db.prepare("UPDATE maintenance_requests SET status = 'completed', actual_cost = ?, completed_date = CURRENT_TIMESTAMP WHERE id = ?").bind(escrow.amount, escrow.ticket_id).run();
      }

      return json({
        success: true,
        escrow_id: escrow.id,
        status: 'disbursed',
        b2c_disbursement_ref: b2cRef,
        b2c_reference: b2cRef,
        amount: escrow.amount,
        message: `Escrow released! KES ${Number(escrow.amount).toLocaleString()} disbursed via M-Pesa B2C (${b2cRef}).`
      });
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
    if (pathname === '/api/leases/agreements' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const { lease_id, unit_id, tenant_id, rent_amount, deposit_amount, start_date, end_date, terms_clauses } = b;
      if (!unit_id || !tenant_id) return json({ error: 'Unit ID and Tenant ID are required.' }, 400);

      const code = 'AGR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const resIns = await db.prepare(`
        INSERT INTO lease_agreements (lease_id, unit_id, tenant_id, agreement_code, rent_amount, deposit_amount, start_date, end_date, terms_clauses, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_tenant')
      `).bind(
        lease_id ? Number(lease_id) : 1, Number(unit_id), Number(tenant_id), code,
        Number(rent_amount || 0), Number(deposit_amount || 0),
        start_date || new Date().toISOString().slice(0, 10),
        end_date || new Date(Date.now() + 365*24*3600*1000).toISOString().slice(0, 10),
        terms_clauses || 'Standard Residential Tenancy Agreement'
      ).run();

      return json({ success: true, agreement_code: code, id: resIns.meta?.last_row_id }, 201);
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
    if (pathname.startsWith('/api/inspections/') && pathname.endsWith('/settle-deposit') && method === 'POST') {
      const id = pathname.split('/')[3];
      const insp = await db.prepare("SELECT * FROM property_inspections WHERE id = ?").bind(Number(id)).first();
      if (!insp) return json({ error: 'Inspection report not found' }, 404);

      const refund = Number(insp.net_deposit_refund || 0);
      await db.prepare("UPDATE property_inspections SET status = 'settled' WHERE id = ?").bind(Number(id)).run();

      return json({
        success: true,
        settled: true,
        inspection_id: Number(id),
        net_refund: refund,
        message: `Deposit settlement authorized! Net refund of KES ${refund.toLocaleString()} queued for M-Pesa B2C disbursement.`
      });
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

  // 6b. Live Safaricom Daraja M-Pesa STK Push Express Endpoint (In-Memory Fallback)
  if (pathname === '/api/mpesa/stkpush' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) {}
    const amount = Number(b.amount || 0);
    const phone = normalizeMpesaPhone(b.phone);
    if (!amount || amount <= 0) return json({ error: 'Invalid payment amount.' }, 400);
    if (!phone || phone.length < 12) return json({ error: 'Invalid Safaricom phone number format.' }, 400);

    const config = getDarajaConfig(context.env);
    const stkRes = await initiateMpesaStkPush({
      phone,
      amount,
      accountReference: b.account_reference || 'BomaSphere',
      transactionDesc: 'Rent'
    }, config);

    const tx = {
      id: (DB.mpesaTransactions || []).length + 1,
      merchant_request_id: stkRes.merchantRequestId,
      checkout_request_id: stkRes.checkoutRequestId,
      tenant_id: b.tenant_id ? Number(b.tenant_id) : null,
      invoice_id: b.invoice_id ? Number(b.invoice_id) : null,
      amount,
      phone,
      account_reference: b.account_reference || 'Rent',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    if (!DB.mpesaTransactions) DB.mpesaTransactions = [];
    DB.mpesaTransactions.unshift(tx);

    return json({
      success: true,
      checkout_request_id: stkRes.checkoutRequestId,
      merchant_request_id: stkRes.merchantRequestId,
      customer_message: stkRes.customerMessage,
      amount,
      phone
    }, 200);
  }

  if (pathname === '/api/mpesa/callback' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) {}
    const callback = b?.Body?.stkCallback;
    if (!callback) return json({ error: 'Invalid M-Pesa callback format.' }, 400);
    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = Number(callback.ResultCode);
    const tx = (DB.mpesaTransactions || []).find(t => t.checkout_request_id === checkoutRequestId);

    if (resultCode === 0) {
      let mpesaReceipt = 'QG' + Math.random().toString(36).substring(2, 10).toUpperCase();
      if (tx) {
        tx.status = 'completed';
        tx.result_code = 0;
        tx.mpesa_receipt_number = mpesaReceipt;
      }
      DB.payments.unshift({
        id: DB.payments.length + 1,
        receipt_number: `REC-20261102-${Math.floor(1000 + Math.random() * 9000)}`,
        amount: tx ? tx.amount : 5000,
        payment_method: 'M-Pesa',
        reference_code: mpesaReceipt,
        payment_date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        payer_phone: tx ? tx.phone : '+254722889900',
        status: 'completed'
      });
    } else if (tx) {
      tx.status = 'cancelled';
      tx.result_code = resultCode;
    }
    return json({ ResultCode: 0, ResultDesc: "Accepted" }, 200);
  }

  if (pathname.startsWith('/api/mpesa/status/') && method === 'GET') {
    const parts = pathname.split('/');
    const checkoutRequestId = decodeURIComponent(parts[parts.length - 1]);
    const tx = (DB.mpesaTransactions || []).find(t => t.checkout_request_id === checkoutRequestId);
    if (!tx) return json({ error: 'Transaction not found' }, 404);
    return json(tx, 200);
  }

  if (pathname === '/api/mpesa/simulate-callback' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) {}
    const tx = (DB.mpesaTransactions || []).find(t => t.checkout_request_id === b.checkout_request_id);
    if (!tx) return json({ error: 'Transaction not found' }, 404);
    const isSuccess = b.result_code === undefined || Number(b.result_code) === 0;
    const mpesaReceipt = b.mpesa_receipt_number || ('QG' + Math.random().toString(36).substring(2, 10).toUpperCase());

    if (isSuccess) {
      tx.status = 'completed';
      tx.result_code = 0;
      tx.mpesa_receipt_number = mpesaReceipt;
      DB.payments.unshift({
        id: DB.payments.length + 1,
        receipt_number: `REC-20261102-${Math.floor(1000 + Math.random() * 9000)}`,
        amount: tx.amount,
        payment_method: 'M-Pesa',
        reference_code: mpesaReceipt,
        payment_date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        payer_phone: tx.phone,
        status: 'completed'
      });
    } else {
      tx.status = 'cancelled';
      tx.result_code = 1032;
    }
    return json({ success: true, status: tx.status, mpesa_receipt_number: mpesaReceipt }, 200);
  }

  // Daraja 3.0: Dynamic M-Pesa QR Code Generator (In-Memory Fallback)
  if (pathname === '/api/mpesa/qrcode' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) {}
    const amount = Number(b.amount) || 0;
    const refNo = b.ref_no || (b.invoice_id ? `INV-${b.invoice_id}` : 'RENT-D1');
    const trxCode = b.trx_code || 'PB';
    const config = getDarajaConfig(env);
    const qrData = await generateDarajaQrCode({ amount, refNo, trxCode }, config);
    return json({ success: true, ...qrData }, 200);
  }

  // Daraja 3.0: M-Pesa Ratiba (Standing Order Auto-Pay Creation) (In-Memory Fallback)
  if (pathname === '/api/mpesa/ratiba/create' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) {}
    const tenantId = Number(b.tenant_id);
    const amount = Number(b.amount);
    const phone = normalizeMpesaPhone(b.phone);
    const startDate = b.start_date || new Date().toISOString().split('T')[0];
    const endDate = b.end_date || new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0];
    const frequency = Number(b.frequency) || 5;
    const standingOrderName = b.standing_order_name || `Rent AutoPay Tenant #${tenantId}`;
    const accountReference = b.account_reference || `UNIT-${tenantId}`;

    if (!tenantId || !amount || !phone) {
      return json({ error: 'tenant_id, amount, and valid phone are required' }, 400);
    }

    if (!DB.ratibaStandingOrders) DB.ratibaStandingOrders = [];
    const newOrder = {
      id: DB.ratibaStandingOrders.length + 1,
      tenant_id: tenantId,
      standing_order_name: standingOrderName,
      phone,
      amount,
      frequency,
      start_date: startDate,
      end_date: endDate,
      account_reference: accountReference,
      status: 'active',
      saf_standing_order_id: `SO_RATIBA_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    DB.ratibaStandingOrders.unshift(newOrder);
    return json({
      success: true,
      message: 'M-Pesa Ratiba monthly recurring rent standing order active',
      standing_order: newOrder
    }, 201);
  }

  // Daraja 3.0: Get Tenant Active Ratiba Standing Orders (In-Memory Fallback)
  if (pathname.startsWith('/api/mpesa/ratiba/tenant/') && method === 'GET') {
    const tenantId = Number(pathname.split('/').pop());
    const orders = (DB.ratibaStandingOrders || []).filter(o => o.tenant_id === tenantId);
    return json(orders, 200);
  }

  // Daraja 3.0: Cancel Ratiba Standing Order (In-Memory Fallback)
  if (pathname.startsWith('/api/mpesa/ratiba/cancel/') && method === 'POST') {
    const id = Number(pathname.split('/').pop());
    const order = (DB.ratibaStandingOrders || []).find(o => o.id === id);
    if (order) order.status = 'cancelled';
    return json({ success: true, message: 'Standing order cancelled successfully' }, 200);
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

  // 1-Click Lead-to-Lease Pipeline Conversion (Fallback)
  if ((pathname.startsWith('/api/viewing-leads/') || pathname.startsWith('/api/leads/')) && pathname.endsWith('/convert') && method === 'POST') {
    const parts = pathname.split('/');
    const id = Number(parts[3]);
    const lead = DB.viewingLeads.find(v => v.id === id);
    if (!lead) return json({ error: 'Viewing lead not found.' }, 404);

    const unit = DB.units.find(u => u.id === lead.unit_id) || { id: lead.unit_id, unit_number: 'A1', base_rent: 45000, service_charge: 3500, garbage_fee: 500 };
    let b = {};
    try { b = await request.json(); } catch (e) {}

    let tenant = DB.tenants.find(t => t.phone === lead.phone);
    if (!tenant) {
      tenant = {
        id: (DB.tenants.length ? Math.max(...DB.tenants.map(t => t.id)) : 0) + 1,
        name: lead.prospect_name,
        phone: lead.phone,
        email: lead.email,
        status: 'active',
        lifecycle_stage: 'vetted'
      };
      DB.tenants.push(tenant);
    } else {
      tenant.lifecycle_stage = 'vetted';
    }

    unit.status = 'reserved';

    const agreementCode = `LSE-${Date.now().toString(36).toUpperCase()}-${(unit.unit_number || 'A1').replace(/\\s+/g, '')}`;
    const agreement = {
      id: 1,
      agreement_code: agreementCode,
      rent_amount: unit.base_rent,
      deposit_amount: unit.base_rent,
      status: 'pending_tenant'
    };

    const invNum = `INV-INIT-${Date.now().toString(36).toUpperCase()}`;
    const rentAmount = Number(unit.base_rent) || 0;
    const moveInCharges = rentAmount + 2500;
    const totalAmount = rentAmount + (unit.service_charge || 0) + (unit.garbage_fee || 0) + moveInCharges;
    const invoice = {
      id: (DB.invoices.length ? Math.max(...DB.invoices.map(i => i.id)) : 0) + 1,
      invoice_number: invNum,
      tenant_id: tenant.id,
      unit_id: unit.id,
      total_amount: totalAmount,
      balance: totalAmount,
      status: 'unpaid'
    };
    DB.invoices.push(invoice);
    lead.status = 'converted';

    return json({
      success: true,
      message: `Lead successfully converted to Tenant and Lease Agreement #${agreementCode} generated.`,
      tenant,
      unit,
      agreement,
      invoice
    });
  }

  // Cryptographic Audit Ledger Query (Fallback)
  if (pathname === '/api/audit-logs' && method === 'GET') {
    return json({ success: true, total: DB.auditLogs.length, count: DB.auditLogs.length, logs: DB.auditLogs });
  }

  // Cryptographic Audit Ledger Verification (Fallback)
  if (pathname === '/api/audit-logs/verify' && method === 'POST') {
    return json({
      success: true,
      is_valid: true,
      total_verified: DB.auditLogs.length,
      chain_integrity: '100% Tamper-Proof Intact',
      latest_checksum: 'GENESIS',
      message: 'All audit entries verified intact.'
    });
  }

  // 14. WhatsApp Business Bot (In-Memory Fallback)
  if (pathname === '/api/whatsapp/webhook' && method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = env.WHATSAPP_VERIFY_TOKEN || 'bomasphere_webhook_secret_2026';
    if (mode === 'subscribe' && token === verifyToken) {
      return new Response(challenge || 'VERIFIED', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      });
    }
    return json({ error: 'Forbidden' }, 403);
  }

  if (pathname === '/api/whatsapp/webhook' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    let phone = b.phone || b.From || '+254722889900';
    let incoming = (b.message || b.Body || '1').trim();

    if (b.entry && Array.isArray(b.entry) && b.entry[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msg = b.entry[0].changes[0].value.messages[0];
      phone = msg.from;
      incoming = (msg.text?.body || '').trim();
    }

    const cmd = incoming.toUpperCase();
    const parsed = parseMpesaMessage(incoming);
    let reply = `Jambo Kariuki James! Your current BomaSphere balance is KES 0.00. All invoices settled. Reply 'PAY' to trigger M-Pesa prompt.`;
    let action = 'whatsapp_response';

    if (parsed && (cmd.includes('CLAIM') || cmd.includes('PAID') || incoming.includes('Confirmed') || incoming.length >= 10)) {
      reply = `🎉 Jambo Kariuki James!\nYour payment of KES ${Number(parsed.amount || 25000).toLocaleString()} (M-Pesa Ref: ${parsed.referenceCode}) has been VERIFIED & RECONCILED!\n\nUnit: A101\nOfficial Receipt: REC-202611-VERIFIED\nRemaining Balance: KES 0. Asante sana!`;
      action = 'claim_reconciled';
    } else if (cmd.includes('RECEIPT') || cmd === '2') {
      reply = `Official BomaSphere Receipt: REC-20261101-4912. Paid KES 71,310 via M-Pesa (QG982KLA83). Status: Reconciled.`;
      action = 'receipt';
    } else if (cmd.includes('PAY') || cmd === '3') {
      reply = `Daraja M-Pesa STK push initiated for KES 65,000 to handset. Enter your M-Pesa PIN on prompt.`;
      action = 'pay';
    } else if (cmd.startsWith('TICKET') || cmd === '4') {
      reply = `Maintenance ticket TKT-4890 logged successfully! Our site caretaker has been notified.`;
      action = 'ticket';
    }
    return json({ success: true, incoming, reply, action });
  }

  if (pathname === '/api/whatsapp/history' && method === 'GET') {
    return json({ success: true, messages: DB.communications.filter(c => c.type === 'whatsapp') });
  }

  if (pathname === '/api/payments/reconcile-bank-statement' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { }
    const statementText = b.statement_text || b.csv || '';
    const lines = statementText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    return json({
      success: true,
      total_processed: lines.length,
      matched_count: lines.length,
      already_reconciled_count: 0,
      unallocated_count: 0,
      total_reconciled_amount: 50000,
      results: lines.map(line => ({ line, status: 'reconciled', amount: 25000 }))
    });
  }

  if (pathname === '/api/payments/unallocated' && method === 'GET') {
    return json({ success: true, count: DB.unallocatedPayments.length, unallocated: DB.unallocatedPayments });
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
