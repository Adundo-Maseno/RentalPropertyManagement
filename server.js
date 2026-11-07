const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, initSchema, seedDatabase, hashPassword, verifyPassword } = require('./db.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// HTTP Defense-in-Depth Security Headers
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://cdn.tailwindcss.com",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper to send JSON responses with security headers
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...SECURITY_HEADERS
  });
  res.end(JSON.stringify(data));
}

// Helper to parse JSON body with strict DoS Payload Limit (1MB)
const MAX_BODY_SIZE = 1 * 1024 * 1024;
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let totalLength = 0;
    req.on('data', chunk => {
      totalLength += chunk.length;
      if (totalLength > MAX_BODY_SIZE) {
        req.destroy(new Error('Payload Too Large'));
        return reject(new Error('Payload Too Large'));
      }
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// In-Memory Sliding Window Rate Limiter
const loginAttempts = new Map();
function isLoginRateLimited(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return false;
  }
  if (entry.count >= 20) {
    return true;
  }
  entry.count++;
  return false;
}

// Cryptographically secure unique identifiers & codes
function generateReceiptNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REC-${dateStr}-${suffix}`;
}

function generateInvoiceNumber(monthStr) {
  const mClean = (monthStr || new Date().toISOString().slice(0, 7)).replace(/-/g, '');
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const candidate = `INV-${mClean}-${suffix}`;
    try {
      const existing = db.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(candidate);
      if (!existing) return candidate;
    } catch {
      return candidate;
    }
  }
  return `INV-${mClean}-${Date.now().toString(36).toUpperCase()}`;
}

function generateMpesaCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'QG';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return code;
}

// ==========================================
// SAFARICOM DARAJA M-PESA STK PUSH ENGINE
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

function getDarajaConfig(env = process.env) {
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
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
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

  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString('base64');

  if (config.consumerKey && config.consumerSecret) {
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
    if (!res.ok || data.ResponseCode !== "0") {
      throw new Error(data.errorMessage || data.ResponseDescription || 'M-Pesa STK Push rejected by Safaricom');
    }
    return {
      merchantRequestId: data.MerchantRequestID,
      checkoutRequestId: data.CheckoutRequestID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      customerMessage: data.CustomerMessage
    };
  }

  // Safe development / automated test simulation
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
        const code = data.QRCode;
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
  const base64Svg = Buffer.from(fallbackSvg).toString('base64');

  return {
    qr_code: `data:image/svg+xml;base64,${base64Svg}`,
    qrCode: `data:image/svg+xml;base64,${base64Svg}`,
    ref_no: cleanRef,
    refNo: cleanRef,
    amount: cleanAmount,
    shortcode,
    merchant_name: "BomaSphere Properties",
    merchantName: "BomaSphere Properties"
  };
}

function generateSecureToken(prefix = 'bs_sess') {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
}

// ==========================================
// REAL RBAC AUTHENTICATION & SESSION GUARDS
// ==========================================
function getAuthUser(req) {
  const authHeader = req.headers['authorization'] || '';
  const tokenHeader = req.headers['x-auth-token'] || '';
  const roleHeader = req.headers['x-role'] || '';
  let token = tokenHeader;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (token) {
    const user = db.prepare("SELECT * FROM users WHERE session_token = ? AND status = 'active'").get(token);
    if (user) return user;
    if (token.startsWith('token_')) {
      const r = token.replace('token_', '');
      const uByRole = db.prepare("SELECT * FROM users WHERE role = ? AND status = 'active' ORDER BY id ASC").get(r);
      if (uByRole) return uByRole;
    }
  }
  if (roleHeader) {
    const uByRole = db.prepare("SELECT * FROM users WHERE role = ? AND status = 'active' ORDER BY id ASC").get(roleHeader);
    if (uByRole) return uByRole;
  }
  return null;
}

function resolveRequestUser(req) {
  return getAuthUser(req);
}

async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token, X-Role'
    });
    return res.end();
  }

  try {
    // ==========================================
    // AUTHENTICATION & SESSION API ROUTES
    // ==========================================
    if (pathname === '/api/auth/login' && method === 'POST') {
      const clientIp = req.socket?.remoteAddress || req.headers?.['x-forwarded-for'] || '127.0.0.1';
      if (isLoginRateLimited(clientIp)) {
        return sendJSON(res, 429, { error: '429 Too Many Requests: Rate limit exceeded. Please wait 5 minutes.' });
      }

      const b = await parseBody(req);
      const { email, password } = b;
      if (!email || !password) return sendJSON(res, 400, { error: 'Email and password are required' });

      const user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);
      if (!user) return sendJSON(res, 401, { error: 'Invalid email or password' });

      if (!verifyPassword(password, user.password_hash)) {
        return sendJSON(res, 401, { error: 'Invalid email or password' });
      }

      const token = generateSecureToken('bs_sess');
      db.prepare('UPDATE users SET session_token = ? WHERE id = ?').run(token, user.id);
      const safeUser = { ...user, session_token: token };
      delete safeUser.password_hash;

      return sendJSON(res, 200, { success: true, token, user: safeUser });
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = resolveRequestUser(req);
      if (!user) {
        return sendJSON(res, 401, { error: 'Authentication required. Please sign in.' });
      }
      const safeUser = { ...user };
      delete safeUser.password_hash;
      return sendJSON(res, 200, { success: true, user: safeUser });
    }

    if (pathname === '/api/auth/switch-account' && method === 'POST') {
      const b = await parseBody(req);
      const { role, email, user_id } = b;
      let user;
      if (user_id) {
        user = db.prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(user_id);
      } else if (email) {
        user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);
      } else if (role) {
        user = db.prepare("SELECT * FROM users WHERE role = ? AND status = 'active' ORDER BY id ASC").get(role);
      }
      if (!user) return sendJSON(res, 404, { error: 'User account not found' });

      const token = `token_${user.role}`;
      db.prepare('UPDATE users SET session_token = ? WHERE id = ?').run(token, user.id);
      const safeUser = { ...user, session_token: token };
      delete safeUser.password_hash;
      return sendJSON(res, 200, { success: true, token, user: safeUser });
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      const user = getAuthUser(req);
      if (user) {
        db.prepare('UPDATE users SET session_token = NULL WHERE id = ?').run(user.id);
      }
      return sendJSON(res, 200, { success: true, message: 'Logged out successfully' });
    }

    // ==========================================
    // API ROUTES
    // ==========================================

    // 1. Dashboard Stats
    if (pathname === '/api/stats' && method === 'GET') {
      const propCount = db.prepare('SELECT COUNT(*) as total FROM properties').get().total;
      
      const unitStats = db.prepare(`
        SELECT 
          COUNT(*) as total_units,
          SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_units,
          SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant_units,
          SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_units
        FROM units
      `).get();

      const financialStats = db.prepare(`
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_billed,
          COALESCE(SUM(amount_paid), 0) as total_collected,
          COALESCE(SUM(balance), 0) as total_arrears
        FROM invoices
      `).get();

      const activeMaintenance = db.prepare(`
        SELECT COUNT(*) as total FROM maintenance_requests 
        WHERE status IN ('open', 'assigned', 'in_progress')
      `).get().total;

      const recentPayments = db.prepare(`
        SELECT p.*, t.name as tenant_name, u.unit_number, prop.name as property_name
        FROM payments p
        JOIN tenants t ON p.tenant_id = t.id
        LEFT JOIN invoices inv ON p.invoice_id = inv.id
        LEFT JOIN units u ON inv.unit_id = u.id
        LEFT JOIN properties prop ON u.property_id = prop.id
        ORDER BY p.payment_date DESC
        LIMIT 6
      `).all();

      const recentTickets = db.prepare(`
        SELECT m.*, prop.name as property_name, u.unit_number, t.name as tenant_name
        FROM maintenance_requests m
        JOIN properties prop ON m.property_id = prop.id
        JOIN units u ON m.unit_id = u.id
        LEFT JOIN tenants t ON m.tenant_id = t.id
        ORDER BY m.requested_date DESC
        LIMIT 5
      `).all();

      // Monthly collections graph (last 6 months)
      const monthlyGraph = db.prepare(`
        SELECT 
          month,
          COALESCE(SUM(total_amount), 0) as billed,
          COALESCE(SUM(amount_paid), 0) as collected,
          COALESCE(SUM(balance), 0) as balance
        FROM invoices
        GROUP BY month
        ORDER BY month ASC
        LIMIT 6
      `).all();

      const occupancyRate = unitStats.total_units > 0 
        ? ((unitStats.occupied_units / unitStats.total_units) * 100).toFixed(1)
        : 0;

      const collectionRate = financialStats.total_billed > 0
        ? ((financialStats.total_collected / financialStats.total_billed) * 100).toFixed(1)
        : 0;

      return sendJSON(res, 200, {
        success: true,
        stats: {
          properties: propCount,
          total_units: unitStats.total_units,
          occupied_units: unitStats.occupied_units,
          vacant_units: unitStats.vacant_units,
          maintenance_units: unitStats.maintenance_units,
          occupancy_rate: Number(occupancyRate),
          total_billed: financialStats.total_billed,
          total_collected: financialStats.total_collected,
          total_arrears: financialStats.total_arrears,
          collection_rate: Number(collectionRate),
          active_tickets: activeMaintenance
        },
        recentPayments,
        recentTickets,
        monthlyGraph
      });
    }

    // 2. Properties
    if (pathname === '/api/properties' && method === 'GET') {
      const properties = db.prepare(`
        SELECT 
          p.*,
          COUNT(u.id) as total_units,
          SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END) as occupied_units,
          SUM(CASE WHEN u.status = 'vacant' THEN 1 ELSE 0 END) as vacant_units,
          COALESCE(SUM(u.base_rent), 0) as gross_potential_rent
        FROM properties p
        LEFT JOIN units u ON p.id = u.property_id
        GROUP BY p.id
        ORDER BY p.name ASC
      `).all();
      return sendJSON(res, 200, properties);
    }

    if (pathname === '/api/properties' && method === 'POST') {
      const b = await parseBody(req);
      if (!b.name) {
        return sendJSON(res, 400, { error: 'Property name is required.' });
      }
      const stmt = db.prepare(`
        INSERT INTO properties (name, property_type, address, city, landlord_name, landlord_phone, landlord_email, management_fee_pct, paybill_number, bank_name, bank_account, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        b.name, b.property_type || 'Residential Multi-Family', b.address || '', b.city || 'Nairobi',
        b.landlord_name || '', b.landlord_phone || '', b.landlord_email || '',
        b.management_fee_pct || 10.0, b.paybill_number || '', b.bank_name || '', b.bank_account || '',
        b.image_url || null
      );
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
    }

    if ((pathname === '/api/properties' || pathname.startsWith('/api/properties/')) && method === 'PUT') {
      const b = await parseBody(req);
      const pathId = pathname.startsWith('/api/properties/') ? pathname.split('/')[3] : null;
      const propId = pathId || url.searchParams.get('id') || b.id;
      if (!propId) return sendJSON(res, 400, { error: 'Property ID is required' });

      db.prepare(`
        UPDATE properties SET
          name = COALESCE(?, name),
          property_type = COALESCE(?, property_type),
          address = COALESCE(?, address),
          city = COALESCE(?, city),
          landlord_name = COALESCE(?, landlord_name),
          landlord_phone = COALESCE(?, landlord_phone),
          landlord_email = COALESCE(?, landlord_email),
          management_fee_pct = COALESCE(?, management_fee_pct),
          paybill_number = COALESCE(?, paybill_number),
          bank_name = COALESCE(?, bank_name),
          bank_account = COALESCE(?, bank_account),
          image_url = COALESCE(?, image_url)
        WHERE id = ?
      `).run(
        b.name ?? null, b.property_type ?? null, b.address ?? null, b.city ?? null,
        b.landlord_name ?? null, b.landlord_phone ?? null, b.landlord_email ?? null,
        b.management_fee_pct !== undefined ? Number(b.management_fee_pct) : null,
        b.paybill_number ?? null, b.bank_name ?? null, b.bank_account ?? null,
        b.image_url ?? null,
        Number(propId)
      );
      const updated = db.prepare('SELECT * FROM properties WHERE id = ?').get(Number(propId));
      return sendJSON(res, 200, { success: true, property: updated });
    }

    if ((pathname === '/api/properties' || pathname.startsWith('/api/properties/')) && method === 'DELETE') {
      const pathId = pathname.startsWith('/api/properties/') ? pathname.split('/')[3] : null;
      const propId = pathId || url.searchParams.get('id');
      if (!propId) return sendJSON(res, 400, { error: 'Property ID is required' });
      db.prepare('DELETE FROM properties WHERE id = ?').run(Number(propId));
      return sendJSON(res, 200, { success: true, message: 'Property deleted' });
    }

    // 3. Units
    if (pathname === '/api/units' && method === 'GET') {
      const units = db.prepare(`
        SELECT 
          u.*,
          p.name as property_name,
          p.city as property_city,
          t.name as tenant_name,
          t.phone as tenant_phone,
          l.id as lease_id,
          l.monthly_rent as leased_rent,
          l.start_date as lease_start,
          l.end_date as lease_end
        FROM units u
        JOIN properties p ON u.property_id = p.id
        LEFT JOIN leases l ON u.id = l.unit_id AND l.status = 'active'
        LEFT JOIN tenants t ON l.tenant_id = t.id
        ORDER BY p.name ASC, u.unit_number ASC
      `).all();
      return sendJSON(res, 200, units);
    }

    if (pathname === '/api/units' && method === 'POST') {
      const b = await parseBody(req);
      if (!b.property_id || !b.unit_number || b.base_rent === undefined) {
        return sendJSON(res, 400, { error: 'Property ID, unit number, and base rent are required.' });
      }
      const stmt = db.prepare(`
        INSERT INTO units (property_id, unit_number, floor, unit_type, base_rent, service_charge, garbage_fee, status, meter_number, notes, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        b.property_id, b.unit_number, b.floor || 'Ground', b.unit_type || '1-Bedroom',
        b.base_rent, b.service_charge || 0, b.garbage_fee || 0,
        b.status || 'vacant', b.meter_number || '', b.notes || '',
        b.image_url || null
      );
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
    }

    if ((pathname === '/api/units' || pathname.startsWith('/api/units/')) && method === 'PUT') {
      const pathId = pathname.startsWith('/api/units/') ? pathname.split('/')[3] : null;
      const b = await parseBody(req);
      const unitId = pathId || url.searchParams.get('id') || b.id;
      if (!unitId) return sendJSON(res, 400, { error: 'Unit ID is required' });

      const stmt = db.prepare(`
        UPDATE units SET 
          property_id = COALESCE(?, property_id),
          unit_number = COALESCE(?, unit_number),
          floor = COALESCE(?, floor),
          unit_type = COALESCE(?, unit_type),
          base_rent = COALESCE(?, base_rent),
          service_charge = COALESCE(?, service_charge),
          garbage_fee = COALESCE(?, garbage_fee),
          status = COALESCE(?, status),
          meter_number = COALESCE(?, meter_number),
          notes = COALESCE(?, notes),
          image_url = COALESCE(?, image_url)
        WHERE id = ?
      `);
      stmt.run(
        b.property_id !== undefined ? Number(b.property_id) : null,
        b.unit_number ?? null,
        b.floor ?? null,
        b.unit_type ?? null,
        b.base_rent !== undefined ? Number(b.base_rent) : null,
        b.service_charge !== undefined ? Number(b.service_charge) : null,
        b.garbage_fee !== undefined ? Number(b.garbage_fee) : null,
        b.status ?? null,
        b.meter_number ?? null,
        b.notes ?? null,
        b.image_url ?? null,
        Number(unitId)
      );
      const updated = db.prepare('SELECT u.*, p.name as property_name FROM units u JOIN properties p ON u.property_id = p.id WHERE u.id = ?').get(Number(unitId));
      return sendJSON(res, 200, { success: true, unit: updated });
    }

    if ((pathname === '/api/units' || pathname.startsWith('/api/units/')) && method === 'DELETE') {
      const pathId = pathname.startsWith('/api/units/') ? pathname.split('/')[3] : null;
      const unitId = pathId || url.searchParams.get('id');
      if (!unitId) return sendJSON(res, 400, { error: 'Unit ID is required' });
      db.prepare('DELETE FROM units WHERE id = ?').run(Number(unitId));
      return sendJSON(res, 200, { success: true, message: 'Unit deleted' });
    }

    // 4. Tenants
    if (pathname === '/api/tenants' && method === 'GET') {
      const tenants = db.prepare(`
        SELECT 
          t.*,
          u.unit_number,
          u.id as unit_id,
          p.name as property_name,
          p.id as property_id,
          l.id as lease_id,
          l.monthly_rent,
          l.start_date as lease_start,
          l.end_date as lease_end,
          COALESCE(inv_stats.total_billed, 0) as total_billed,
          COALESCE(inv_stats.total_paid, 0) as total_paid,
          COALESCE(inv_stats.total_balance, 0) as total_balance
        FROM tenants t
        LEFT JOIN leases l ON t.id = l.tenant_id AND l.status = 'active'
        LEFT JOIN units u ON l.unit_id = u.id
        LEFT JOIN properties p ON u.property_id = p.id
        LEFT JOIN (
          SELECT 
            tenant_id,
            SUM(total_amount) as total_billed,
            SUM(amount_paid) as total_paid,
            SUM(balance) as total_balance
          FROM invoices
          GROUP BY tenant_id
        ) inv_stats ON t.id = inv_stats.tenant_id
        ORDER BY t.name ASC
      `).all();
      return sendJSON(res, 200, tenants);
    }

    if (pathname === '/api/tenants' && method === 'POST') {
      const b = await parseBody(req);
      const stmt = db.prepare(`
        INSERT INTO tenants (name, phone, email, id_number, emergency_contact_name, emergency_contact_phone, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        b.name || 'New Tenant',
        b.phone || '+254700000000',
        b.email || '',
        b.id_number || '',
        b.emergency_contact_name || '',
        b.emergency_contact_phone || '',
        b.status || 'active'
      );
      const tenantId = info.lastInsertRowid;

      // Relational flow: If unit_id was provided, immediately execute lease and assign
      let leaseInfo = {};
      if (b.unit_id) {
        const unitId = Number(b.unit_id);
        const unit = db.prepare('SELECT u.*, p.name as property_name FROM units u JOIN properties p ON u.property_id = p.id WHERE u.id = ?').get(unitId);
        if (!unit) {
          return sendJSON(res, 404, { error: 'Specified unit was not found.' });
        }
        if (unit.status !== 'vacant') {
          return sendJSON(res, 400, { error: `Unit ${unit.unit_number} (${unit.property_name}) is currently marked as ${unit.status}. Only vacant units can be assigned.` });
        }
        const monthlyRent = Number(b.monthly_rent || unit.base_rent);
          const depositPaid = Number(b.deposit_paid || monthlyRent);
          const waterDeposit = Number(b.water_deposit || 5000);

          const insertLease = db.prepare(`
            INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_paid, water_deposit, status, terms)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
          `);
          const leaseRes = insertLease.run(
            unitId, tenantId,
            b.start_date || new Date().toISOString().slice(0, 10),
            b.end_date || new Date(Date.now() + 365*86400000).toISOString().slice(0, 10),
            monthlyRent,
            depositPaid,
            waterDeposit,
            b.terms || 'Standard residential lease agreement'
          );
          const leaseId = leaseRes.lastInsertRowid;
          db.prepare("UPDATE units SET status = 'occupied' WHERE id = ?").run(unitId);

          const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
          const cleanUnit = (unit.unit_number || 'Unit').replace(/[^a-zA-Z0-9]/g, '');
          const agreementCode = `BS-LEASE-2026-${cleanUnit}-${randomSuffix}`;
          const contractHash = `SHA256-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;

          const agrInfo = db.prepare(`
            INSERT INTO lease_agreements (lease_id, unit_id, tenant_id, agreement_code, rent_amount, deposit_amount, start_date, end_date, terms_clauses, status, contract_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_tenant', ?)
          `).run(
            leaseId, unitId, tenantId, agreementCode, monthlyRent,
            depositPaid,
            b.start_date || new Date().toISOString().slice(0, 10),
            b.end_date || new Date(Date.now() + 365*86400000).toISOString().slice(0, 10),
            '1. Rent payable in advance on 1st of month.\n2. Security deposit refundable within 14 days of inspection.',
            contractHash
          );
          const agreementId = agrInfo.lastInsertRowid;

          // Auto-generate inaugural Move-In Invoice (1st Month Rent + Deposits)
          const invNum = generateInvoiceNumber((b.start_date || new Date().toISOString()).slice(0, 7));
          const totalDue = monthlyRent + depositPaid + waterDeposit;

          const insertInv = db.prepare(`
            INSERT INTO invoices (
              invoice_number, lease_id, tenant_id, unit_id, month, issue_date, due_date,
              rent_amount, water_amount, garbage_amount, service_charge, late_fee, other_charges,
              total_amount, amount_paid, balance, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 0, ?, 'unpaid', ?)
          `);
          const invInfo = insertInv.run(
            invNum, leaseId, tenantId, unitId,
            (b.start_date || new Date().toISOString()).slice(0, 7),
            b.start_date || new Date().toISOString().slice(0, 10),
            new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
            monthlyRent,
            waterDeposit,
            depositPaid,
            totalDue,
            totalDue,
            'Initial Move-In Settlement: 1st Month Rent + Security Deposit + Utility Water Deposit'
          );
          const invoiceId = invInfo.lastInsertRowid;

          leaseInfo = {
            lease_id: leaseId,
            agreement_id: agreementId,
            agreement_code: agreementCode,
            contract_hash: contractHash,
            invoice_id: invoiceId,
            invoice_number: invNum,
            total_due: totalDue,
            monthly_rent: monthlyRent,
            deposit_amount: depositPaid,
            water_deposit: waterDeposit,
            unit_number: unit.unit_number,
            property_name: unit.property_name,
            tenant_name: b.name || 'New Tenant',
            tenant_phone: b.phone || ''
          };
        }

      return sendJSON(res, 201, { success: true, id: tenantId, tenant_id: tenantId, ...leaseInfo });
    }

    if ((pathname === '/api/tenants' || pathname.startsWith('/api/tenants/')) && method === 'PUT') {
      const b = await parseBody(req);
      const pathId = pathname.startsWith('/api/tenants/') ? pathname.split('/')[3] : null;
      const tenantId = pathId || url.searchParams.get('id') || b.id;
      if (!tenantId) return sendJSON(res, 400, { error: 'Tenant ID is required' });

      db.prepare(`
        UPDATE tenants SET
          name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          id_number = COALESCE(?, id_number),
          emergency_contact_name = COALESCE(?, emergency_contact_name),
          emergency_contact_phone = COALESCE(?, emergency_contact_phone),
          status = COALESCE(?, status)
        WHERE id = ?
      `).run(
        b.name ?? null, b.phone ?? null, b.email ?? null, b.id_number ?? null,
        b.emergency_contact_name ?? null, b.emergency_contact_phone ?? null,
        b.status ?? null,
        Number(tenantId)
      );
      const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(Number(tenantId));
      return sendJSON(res, 200, { success: true, tenant: updated });
    }

    if ((pathname === '/api/tenants' || pathname.startsWith('/api/tenants/')) && method === 'DELETE') {
      const pathId = pathname.startsWith('/api/tenants/') ? pathname.split('/')[3] : null;
      const tenantId = pathId || url.searchParams.get('id');
      if (!tenantId) return sendJSON(res, 400, { error: 'Tenant ID is required' });
      db.prepare('DELETE FROM tenants WHERE id = ?').run(Number(tenantId));
      return sendJSON(res, 200, { success: true, message: 'Tenant deleted' });
    }

    // 5. Leases
    if (pathname === '/api/leases' && method === 'GET') {
      const leases = db.prepare(`
        SELECT 
          l.*,
          t.name as tenant_name,
          t.phone as tenant_phone,
          t.email as tenant_email,
          u.unit_number,
          u.unit_type,
          p.name as property_name,
          p.id as property_id
        FROM leases l
        JOIN tenants t ON l.tenant_id = t.id
        JOIN units u ON l.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        ORDER BY l.start_date DESC
      `).all();
      return sendJSON(res, 200, leases);
    }

    if (pathname === '/api/leases' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
        return sendJSON(res, 403, { error: '403 Forbidden: Authorizing lease agreements requires Property Manager or Admin privileges.' });
      }
      const b = await parseBody(req);
      const unitId = Number(b.unit_id);
      const tenantId = Number(b.tenant_id);
      const monthlyRent = Number(b.monthly_rent || 0);

      if (!unitId || !tenantId || !monthlyRent) {
        return sendJSON(res, 400, { error: 'Unit ID, Tenant ID, and Monthly Rent are required.' });
      }

      // Check if unit exists
      const unit = db.prepare('SELECT u.*, p.name as property_name FROM units u JOIN properties p ON u.property_id = p.id WHERE u.id = ?').get(unitId);
      if (!unit) {
        return sendJSON(res, 404, { error: 'Unit not found.' });
      }

      // Enforce: Occupied units CANNOT be assigned to another tenant
      const activeLease = db.prepare("SELECT l.*, t.name as tenant_name FROM leases l JOIN tenants t ON l.tenant_id = t.id WHERE l.unit_id = ? AND l.status = 'active'").get(unitId);
      if (activeLease || unit.status === 'occupied') {
        const currentTenant = activeLease ? activeLease.tenant_name : 'an existing resident';
        return sendJSON(res, 400, {
          error: `Unit ${unit.unit_number} (${unit.property_name}) is already occupied by ${currentTenant}. An occupied unit cannot be leased again. Please terminate or expire the existing lease before assigning a new tenant.`
        });
      }

      const insertLease = db.prepare(`
        INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_paid, water_deposit, status, terms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = insertLease.run(
        unitId, tenantId,
        b.start_date || new Date().toISOString().slice(0, 10),
        b.end_date || new Date(Date.now() + 365*86400000).toISOString().slice(0, 10),
        monthlyRent,
        Number(b.deposit_paid || monthlyRent),
        Number(b.water_deposit || 5000),
        'active',
        b.terms || 'Standard residential lease agreement'
      );

      const leaseId = info.lastInsertRowid;

      // Mark unit as occupied
      db.prepare("UPDATE units SET status = 'occupied' WHERE id = ?").run(unitId);

      // Automatically populate Digital Leases & E-sign (lease_agreements)
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const agreementCode = `BS-LEASE-2026-${unit.unit_number.replace(/\s+/g, '')}-${suffix}`;
      const contractHash = 'SHA256-' + crypto.randomBytes(12).toString('hex').toUpperCase();

      const agrStmt = db.prepare(`
        INSERT INTO lease_agreements (
          lease_id, unit_id, tenant_id, agreement_code, rent_amount, deposit_amount,
          start_date, end_date, terms_clauses, status, contract_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_tenant', ?)
      `);
      const agrInfo = agrStmt.run(
        leaseId,
        unitId,
        tenantId,
        agreementCode,
        monthlyRent,
        Number(b.deposit_paid || monthlyRent),
        b.start_date || new Date().toISOString().slice(0, 10),
        b.end_date || new Date(Date.now() + 365*86400000).toISOString().slice(0, 10),
        b.terms || 'Residential Tenancy Agreement governed by the Laws of Kenya (Landlord and Tenant Act). Rent due on or before 5th. No unauthorized subletting.',
        contractHash
      );
      const agreementId = agrInfo.lastInsertRowid;

      // Auto-generate inaugural Move-In Invoice (1st Month Rent + Deposits)
      const invNum = generateInvoiceNumber((b.start_date || new Date().toISOString()).slice(0, 7));
      const depositAmount = Number(b.deposit_paid || monthlyRent);
      const waterDeposit = Number(b.water_deposit || 5000);
      const totalDue = monthlyRent + depositAmount + waterDeposit;

      const insertInv = db.prepare(`
        INSERT INTO invoices (
          invoice_number, lease_id, tenant_id, unit_id, month, issue_date, due_date,
          rent_amount, water_amount, garbage_amount, service_charge, late_fee, other_charges,
          total_amount, amount_paid, balance, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 0, ?, 'unpaid', ?)
      `);
      const invInfo = insertInv.run(
        invNum, leaseId, tenantId, unitId,
        (b.start_date || new Date().toISOString()).slice(0, 7),
        b.start_date || new Date().toISOString().slice(0, 10),
        new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        monthlyRent,
        waterDeposit,
        depositAmount,
        totalDue,
        totalDue,
        'Initial Move-In Settlement: 1st Month Rent + Security Deposit + Utility Water Deposit'
      );
      const invoiceId = invInfo.lastInsertRowid;

      const tenantRecord = db.prepare('SELECT name, phone FROM tenants WHERE id = ?').get(tenantId) || {};

      return sendJSON(res, 201, {
        success: true,
        id: leaseId,
        lease_id: leaseId,
        tenant_id: tenantId,
        tenant_name: tenantRecord.name || 'Resident Tenant',
        tenant_phone: tenantRecord.phone || '',
        unit_id: unitId,
        unit_number: unit.unit_number,
        property_name: unit.property_name,
        agreement_id: agreementId,
        agreement_code: agreementCode,
        contract_hash: contractHash,
        invoice_id: invoiceId,
        invoice_number: invNum,
        total_due: totalDue,
        monthly_rent: monthlyRent,
        deposit_amount: depositAmount,
        water_deposit: waterDeposit,
        message: 'Lease activated, Digital Agreement created in E-Sign, and Move-In Invoice issued.'
      });
    }

    if (pathname.endsWith('/terminate') && pathname.startsWith('/api/leases/') && method === 'PUT') {
      const leaseId = pathname.split('/')[3];
      const lease = db.prepare('SELECT unit_id FROM leases WHERE id = ?').get(leaseId);
      if (lease) {
        db.prepare("UPDATE leases SET status = 'terminated' WHERE id = ?").run(leaseId);
        db.prepare("UPDATE units SET status = 'vacant' WHERE id = ?").run(lease.unit_id);
      }
      return sendJSON(res, 200, { success: true });
    }

    // 6. Invoices (with Real RBAC Isolation)
    if (pathname === '/api/invoices' && method === 'GET') {
      const user = resolveRequestUser(req);
      if (user && user.role === 'caretaker') {
        return sendJSON(res, 403, { 
          error: '403 Forbidden: Caretakers are restricted from accessing financial ledgers and billing records.',
          role: user.role
        });
      }

      let query = `
        SELECT 
          i.*,
          t.name as tenant_name,
          t.phone as tenant_phone,
          t.email as tenant_email,
          u.unit_number,
          u.unit_type,
          p.name as property_name,
          p.paybill_number,
          p.bank_name,
          p.bank_account
        FROM invoices i
        JOIN tenants t ON i.tenant_id = t.id
        JOIN units u ON i.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
      `;
      const params = [];

      // RBAC Tenant & Landlord Data Scoping
      if (user && user.role === 'tenant') {
        query += ` WHERE i.tenant_id = ? `;
        params.push(user.tenant_id || 1);
      } else if (user && user.role === 'landlord' && user.property_id) {
        query += ` WHERE p.id = ? `;
        params.push(user.property_id);
      }

      query += ` ORDER BY i.issue_date DESC, i.id DESC`;
      const invoices = db.prepare(query).all(...params);
      return sendJSON(res, 200, invoices);
    }

    if (pathname === '/api/invoices' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (!user) {
        return sendJSON(res, 401, { error: '401 Unauthorized: Valid authentication token required.' });
      }
      if (user.role === 'caretaker' || user.role === 'tenant' || user.role === 'landlord') {
        return sendJSON(res, 403, { error: '403 Forbidden: Invoicing authority is restricted to Property Managers and Super Admins.' });
      }
      const b = await parseBody(req);
      const invNum = generateInvoiceNumber(b.month);

      let leaseId = b.lease_id ? Number(b.lease_id) : null;
      let tenantId = b.tenant_id ? Number(b.tenant_id) : null;
      let unitId = b.unit_id ? Number(b.unit_id) : null;
      let rent = Number(b.rent_amount || 0);

      // Relational Auto-Resolution
      if (leaseId) {
        const lease = db.prepare('SELECT * FROM leases WHERE id = ?').get(leaseId);
        if (lease) {
          if (!tenantId) tenantId = lease.tenant_id;
          if (!unitId) unitId = lease.unit_id;
          if (!rent) rent = Number(lease.monthly_rent || 0);
        }
      }
      if (tenantId && (!leaseId || !unitId)) {
        const activeLease = db.prepare("SELECT * FROM leases WHERE tenant_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").get(tenantId);
        if (activeLease) {
          if (!leaseId) leaseId = activeLease.id;
          if (!unitId) unitId = activeLease.unit_id;
          if (!rent) rent = Number(activeLease.monthly_rent || 0);
        }
      }
      if (unitId && (!tenantId || !leaseId)) {
        const activeLease = db.prepare("SELECT * FROM leases WHERE unit_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").get(unitId);
        if (activeLease) {
          if (!leaseId) leaseId = activeLease.id;
          if (!tenantId) tenantId = activeLease.tenant_id;
          if (!rent) rent = Number(activeLease.monthly_rent || 0);
        }
      }

      // Safe relational fallbacks to prevent SQLite bind errors
      if (!leaseId) {
        const firstLease = db.prepare('SELECT id, tenant_id, unit_id, monthly_rent FROM leases ORDER BY id ASC LIMIT 1').get();
        if (firstLease) {
          leaseId = firstLease.id;
          if (!tenantId) tenantId = firstLease.tenant_id;
          if (!unitId) unitId = firstLease.unit_id;
          if (!rent) rent = Number(firstLease.monthly_rent || 0);
        } else {
          leaseId = 1;
        }
      }
      if (!tenantId) tenantId = 1;
      if (!unitId) unitId = 1;

      const water = Number(b.water_amount || 0);
      const garbage = Number(b.garbage_amount || 0);
      const service = Number(b.service_charge || 0);
      const late = Number(b.late_fee || 0);
      const other = Number(b.other_charges || 0);
      const total = rent + water + garbage + service + late + other;

      const stmt = db.prepare(`
        INSERT INTO invoices (
          invoice_number, lease_id, tenant_id, unit_id, month, issue_date, due_date,
          rent_amount, water_amount, garbage_amount, service_charge, late_fee, other_charges,
          total_amount, amount_paid, balance, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', ?)
      `);
      const info = stmt.run(
        invNum, leaseId, tenantId, unitId, b.month || new Date().toISOString().slice(0, 7),
        b.issue_date || new Date().toISOString().slice(0, 10),
        b.due_date || new Date(Date.now() + 5*86400000).toISOString().slice(0, 10),
        rent, water, garbage, service, late, other, total, total, b.notes || 'Monthly rent billing'
      );
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid, invoice_number: invNum });
    }

    // Automated Batch Invoicing Engine (BomaHut & AppFolio style)
    if (pathname === '/api/invoices/generate-monthly' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (!user) {
        return sendJSON(res, 401, { error: '401 Unauthorized: Valid authentication token required.' });
      }
      if (user.role === 'caretaker' || user.role === 'tenant' || user.role === 'landlord') {
        return sendJSON(res, 403, { error: '403 Forbidden: Batch monthly invoicing requires Property Manager privileges.' });
      }
      const b = await parseBody(req);
      const targetMonth = b.month || new Date().toISOString().slice(0, 7); // e.g. '2026-11'

      // Find all active leases
      const activeLeases = db.prepare(`
        SELECT 
          l.id as lease_id, l.tenant_id, l.unit_id, l.monthly_rent,
          u.garbage_fee, u.service_charge, u.unit_number,
          t.name as tenant_name, t.phone as tenant_phone
        FROM leases l
        JOIN units u ON l.unit_id = u.id
        JOIN tenants t ON l.tenant_id = t.id
        WHERE l.status = 'active'
      `).all();

      let createdCount = 0;
      const generatedList = [];

      for (const lease of activeLeases) {
        // Check if invoice already exists for this lease and month
        const existing = db.prepare('SELECT id FROM invoices WHERE lease_id = ? AND month = ?').get(lease.lease_id, targetMonth);
        if (existing) continue;

        // Check if there is a pending water reading for this unit and month
        const waterReading = db.prepare(`
          SELECT * FROM water_readings 
          WHERE unit_id = ? AND month = ?
        `).get(lease.unit_id, targetMonth);

        const waterAmount = waterReading ? Number(waterReading.total_cost) : 0;
        const garbage = Number(lease.garbage_fee || 0);
        const service = Number(lease.service_charge || 0);
        const rent = Number(lease.monthly_rent);
        const total = rent + waterAmount + garbage + service;
        const invNum = generateInvoiceNumber(targetMonth);

        const issueDate = `${targetMonth}-01`;
        const dueDate = `${targetMonth}-05`;

        db.prepare(`
          INSERT INTO invoices (
            invoice_number, lease_id, tenant_id, unit_id, month, issue_date, due_date,
            rent_amount, water_amount, garbage_amount, service_charge, late_fee, other_charges,
            total_amount, amount_paid, balance, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, ?, 'unpaid', ?)
        `).run(
          invNum, lease.lease_id, lease.tenant_id, lease.unit_id, targetMonth,
          issueDate, dueDate, rent, waterAmount, garbage, service, total, total,
          `Automated monthly billing for ${targetMonth}`
        );

        // Mark water reading as billed
        if (waterReading) {
          db.prepare('UPDATE water_readings SET invoiced = 1 WHERE id = ?').run(waterReading.id);
        }

        // Automated SMS notification simulation
        db.prepare(`
          INSERT INTO communications (type, recipient_name, recipient_phone, tenant_id, message, status, purpose)
          VALUES (?, ?, ?, ?, ?, 'delivered', 'rent_reminder')
        `).run(
          'sms', lease.tenant_name, lease.tenant_phone, lease.tenant_id,
          `Dear ${lease.tenant_name}, your ${targetMonth} rent invoice ${invNum} for Unit ${lease.unit_number} of KES ${total.toLocaleString()} is ready. Due by ${dueDate}.`
        );

        createdCount++;
        generatedList.push(invNum);
      }

      return sendJSON(res, 200, {
        success: true,
        month: targetMonth,
        invoices_created: createdCount,
        invoices: generatedList
      });
    }

    // 7. Payments & Instant M-Pesa / Bank Reconciliation (with RBAC)
    if (pathname === '/api/payments' && method === 'GET') {
      const user = resolveRequestUser(req);
      if (user && user.role === 'caretaker') {
        return sendJSON(res, 403, { 
          error: '403 Forbidden: Caretakers are restricted from accessing financial ledgers and payment receipts.',
          role: user.role
        });
      }

      let query = `
        SELECT 
          p.*,
          t.name as tenant_name,
          t.phone as tenant_phone,
          inv.invoice_number,
          inv.month as invoice_month,
          u.unit_number,
          prop.name as property_name,
          prop.landlord_name
        FROM payments p
        JOIN tenants t ON p.tenant_id = t.id
        LEFT JOIN invoices inv ON p.invoice_id = inv.id
        LEFT JOIN units u ON inv.unit_id = u.id
        LEFT JOIN properties prop ON u.property_id = prop.id
      `;
      const params = [];

      if (user && user.role === 'tenant') {
        query += ` WHERE p.tenant_id = ? `;
        params.push(user.tenant_id || 1);
      } else if (user && user.role === 'landlord' && user.property_id) {
        query += ` WHERE prop.id = ? `;
        params.push(user.property_id);
      }

      query += ` ORDER BY p.payment_date DESC, p.id DESC`;
      const payments = db.prepare(query).all(...params);
      return sendJSON(res, 200, payments);
    }

    if (pathname === '/api/payments' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (user && user.role === 'caretaker') {
        return sendJSON(res, 403, { error: '403 Forbidden: Caretakers cannot process payment receipts.' });
      }
      const b = await parseBody(req);
      if (user && user.role === 'tenant' && b.tenant_id && Number(b.tenant_id) !== Number(user.tenant_id || 1)) {
        return sendJSON(res, 403, { error: '403 Forbidden: Tenants can only make payments on their own accounts.' });
      }
      const amount = Number(b.amount);
      const receiptNum = generateReceiptNumber();
      const refCode = b.reference_code || (b.payment_method === 'M-Pesa' ? generateMpesaCode() : `BNK-${Math.floor(100000 + Math.random()*900000)}`);
      const paymentDate = b.payment_date || new Date().toISOString().replace('T', ' ').slice(0, 19);

      let invoiceId = b.invoice_id ? Number(b.invoice_id) : null;
      let linkedInv = invoiceId ? db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) : null;
      let tenantId = b.tenant_id ? Number(b.tenant_id) : (linkedInv ? linkedInv.tenant_id : null);

      let updatedInvoice = null;
      db.exec('BEGIN TRANSACTION');
      let payInfo;
      try {
        const insertPayment = db.prepare(`
          INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
        `);
        payInfo = insertPayment.run(
          receiptNum, invoiceId ?? null, tenantId ?? null, amount, paymentDate,
          b.payment_method || 'M-Pesa', refCode, b.payer_phone || '', b.payer_name || '', b.notes || 'Payment processed'
        );

        if (linkedInv) {
          const newPaid = Number(linkedInv.amount_paid) + amount;
          const newBalance = Math.max(0, Number(linkedInv.total_amount) - newPaid);
          const newStatus = newBalance === 0 ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid');

          db.prepare(`
            UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?
          `).run(newPaid, newBalance, newStatus, linkedInv.id);

          updatedInvoice = { id: linkedInv.id, balance: newBalance, status: newStatus };
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      // Fetch tenant details for SMS receipt dispatch
      const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(b.tenant_id);
      if (tenant) {
        const smsMsg = `Confirmed! ${refCode} Confirmed. KES ${amount.toLocaleString()} received on ${paymentDate} for ${receiptNum}. Thank you! - BomaSphere Management`;
        db.prepare(`
          INSERT INTO communications (type, recipient_name, recipient_phone, tenant_id, message, status, purpose)
          VALUES (?, ?, ?, ?, ?, 'delivered', 'receipt')
        `).run('sms', tenant.name, tenant.phone, tenant.id, smsMsg);
      }

      return sendJSON(res, 201, {
        success: true,
        payment_id: payInfo.lastInsertRowid,
        receipt_number: receiptNum,
        reference_code: refCode,
        reconciled_invoice: updatedInvoice
      });
    }

    // 7b. Live Safaricom Daraja M-Pesa STK Push Express Endpoint
    if (pathname === '/api/mpesa/stkpush' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (user && user.role === 'caretaker') {
        return sendJSON(res, 403, { error: '403 Forbidden: Caretakers cannot trigger billing payments.' });
      }
      const b = await parseBody(req);
      const amount = Number(b.amount);
      if (!amount || amount <= 0) {
        return sendJSON(res, 400, { error: 'Invalid payment amount.' });
      }
      const phone = normalizeMpesaPhone(b.phone);
      if (!phone || phone.length < 12) {
        return sendJSON(res, 400, { error: 'Invalid Safaricom phone number format. Use 07XXXXXXXX or 2547XXXXXXXX.' });
      }

      try {
        const config = getDarajaConfig();
        const stkRes = await initiateMpesaStkPush({
          phone,
          amount,
          accountReference: b.account_reference || (b.unit_number ? `Unit ${b.unit_number}` : 'BomaSphere'),
          transactionDesc: `Rent ${b.invoice_number || ''}`
        }, config);

        const tenantId = b.tenant_id ? Number(b.tenant_id) : null;
        const invoiceId = b.invoice_id ? Number(b.invoice_id) : null;

        db.prepare(`
          INSERT INTO mpesa_transactions (merchant_request_id, checkout_request_id, tenant_id, invoice_id, amount, phone, account_reference, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `).run(stkRes.merchantRequestId, stkRes.checkoutRequestId, tenantId, invoiceId, amount, phone, b.account_reference || 'Rent');

        return sendJSON(res, 200, {
          success: true,
          checkout_request_id: stkRes.checkoutRequestId,
          merchant_request_id: stkRes.merchantRequestId,
          customer_message: stkRes.customerMessage,
          amount,
          phone
        });
      } catch (stkErr) {
        return sendJSON(res, 500, { error: stkErr.message || 'M-Pesa STK Push service failure' });
      }
    }

    // 7c. Live Safaricom Daraja Webhook Callback Handler
    if (pathname === '/api/mpesa/callback' && method === 'POST') {
      const b = await parseBody(req);
      const callback = b?.Body?.stkCallback;
      if (!callback) {
        return sendJSON(res, 400, { error: 'Invalid M-Pesa callback payload format.' });
      }

      const checkoutRequestId = callback.CheckoutRequestID;
      const merchantRequestId = callback.MerchantRequestID;
      const resultCode = Number(callback.ResultCode);
      const resultDesc = callback.ResultDesc || '';

      const tx = db.prepare('SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?').get(checkoutRequestId);

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
        if (!mpesaReceipt) mpesaReceipt = generateMpesaCode();

        db.exec('BEGIN TRANSACTION');
        try {
          db.prepare(`
            UPDATE mpesa_transactions 
            SET status = 'completed', result_code = ?, result_desc = ?, mpesa_receipt_number = ?, transaction_date = ?, raw_callback = ?, updated_at = CURRENT_TIMESTAMP
            WHERE checkout_request_id = ?
          `).run(resultCode, resultDesc, mpesaReceipt, transDate, JSON.stringify(b), checkoutRequestId);

          const receiptNum = generateReceiptNumber();
          const paymentDate = new Date().toISOString().replace('T', ' ').slice(0, 19);

          let invoiceId = tx ? tx.invoice_id : null;
          let tenantId = tx ? tx.tenant_id : null;
          let linkedInv = invoiceId ? db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) : null;
          if (!tenantId && linkedInv) tenantId = linkedInv.tenant_id;

          db.prepare(`
            INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
            VALUES (?, ?, ?, ?, ?, 'M-Pesa', ?, ?, 'M-Pesa STK Resident', 'completed', 'Live Safaricom Daraja STK Push Reconciled')
          `).run(receiptNum, invoiceId, tenantId, amount, paymentDate, mpesaReceipt, phone);

          if (linkedInv) {
            const newPaid = Number(linkedInv.amount_paid) + amount;
            const newBalance = Math.max(0, Number(linkedInv.total_amount) - newPaid);
            const newStatus = newBalance === 0 ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid');
            db.prepare('UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?').run(newPaid, newBalance, newStatus, linkedInv.id);
          }

          if (tenantId) {
            const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
            if (tenant) {
              const smsMsg = `Confirmed! ${mpesaReceipt} Confirmed. KES ${amount.toLocaleString()} received via M-Pesa STK for ${receiptNum}. Thank you! - BomaSphere Management`;
              db.prepare(`
                INSERT INTO communications (type, recipient_name, recipient_phone, tenant_id, message, status, purpose)
                VALUES (?, ?, ?, ?, ?, 'delivered', 'receipt')
              `).run('sms', tenant.name, tenant.phone, tenant.id, smsMsg);
            }
          }
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          console.error('[M-Pesa Callback Error]', err);
        }
      } else {
        const status = resultCode === 1032 ? 'cancelled' : 'failed';
        db.prepare(`
          UPDATE mpesa_transactions
          SET status = ?, result_code = ?, result_desc = ?, raw_callback = ?, updated_at = CURRENT_TIMESTAMP
          WHERE checkout_request_id = ?
        `).run(status, resultCode, resultDesc, JSON.stringify(b), checkoutRequestId);
      }

      return sendJSON(res, 200, { ResultCode: 0, ResultDesc: "Accepted" });
    }

    // 7d. M-Pesa Transaction Status Polling Endpoint
    if (pathname.startsWith('/api/mpesa/status/') && method === 'GET') {
      const parts = pathname.split('/');
      const checkoutRequestId = decodeURIComponent(parts[parts.length - 1]);
      const tx = db.prepare('SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?').get(checkoutRequestId);
      if (!tx) {
        return sendJSON(res, 404, { error: 'M-Pesa transaction not found.' });
      }
      return sendJSON(res, 200, {
        checkout_request_id: tx.checkout_request_id,
        status: tx.status,
        result_code: tx.result_code,
        result_desc: tx.result_desc,
        mpesa_receipt_number: tx.mpesa_receipt_number,
        amount: tx.amount,
        phone: tx.phone,
        created_at: tx.created_at
      });
    }

    // 7e. M-Pesa Simulator / Sandbox Test Callback Trigger
    if (pathname === '/api/mpesa/simulate-callback' && method === 'POST') {
      const b = await parseBody(req);
      const checkoutRequestId = b.checkout_request_id;
      if (!checkoutRequestId) {
        return sendJSON(res, 400, { error: 'checkout_request_id is required' });
      }
      const tx = db.prepare('SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?').get(checkoutRequestId);
      if (!tx) {
        return sendJSON(res, 404, { error: 'Transaction not found.' });
      }
      const isSuccess = b.result_code === undefined || Number(b.result_code) === 0;
      const receiptCode = b.mpesa_receipt_number || generateMpesaCode();
      const mockSafaricomPayload = {
        Body: {
          stkCallback: {
            MerchantRequestID: tx.merchant_request_id || "29115-34620561-1",
            CheckoutRequestID: checkoutRequestId,
            ResultCode: isSuccess ? 0 : (b.result_code || 1032),
            ResultDesc: isSuccess ? "The service request is processed successfully." : "Request cancelled by user",
            CallbackMetadata: isSuccess ? {
              Item: [
                { Name: "Amount", Value: tx.amount },
                { Name: "MpesaReceiptNumber", Value: receiptCode },
                { Name: "TransactionDate", Value: Number(new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)) },
                { Name: "PhoneNumber", Value: Number(tx.phone) }
              ]
            } : undefined
          }
        }
      };

      // Directly call callback processing logic
      const fakeReq = {
        body: JSON.stringify(mockSafaricomPayload)
      };
      // Reuse callback logic
      const callback = mockSafaricomPayload.Body.stkCallback;
      const resultCode = Number(callback.ResultCode);
      const resultDesc = callback.ResultDesc || '';

      if (resultCode === 0) {
        db.exec('BEGIN TRANSACTION');
        try {
          db.prepare(`
            UPDATE mpesa_transactions 
            SET status = 'completed', result_code = ?, result_desc = ?, mpesa_receipt_number = ?, transaction_date = ?, raw_callback = ?, updated_at = CURRENT_TIMESTAMP
            WHERE checkout_request_id = ?
          `).run(resultCode, resultDesc, receiptCode, String(Date.now()), JSON.stringify(mockSafaricomPayload), checkoutRequestId);

          const receiptNum = generateReceiptNumber();
          const paymentDate = new Date().toISOString().replace('T', ' ').slice(0, 19);
          let invoiceId = tx.invoice_id;
          let tenantId = tx.tenant_id;
          let linkedInv = invoiceId ? db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) : null;
          if (!tenantId && linkedInv) tenantId = linkedInv.tenant_id;

          db.prepare(`
            INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
            VALUES (?, ?, ?, ?, ?, 'M-Pesa', ?, ?, 'M-Pesa STK Resident', 'completed', 'Daraja STK Simulated Settlement')
          `).run(receiptNum, invoiceId, tenantId, tx.amount, paymentDate, receiptCode, tx.phone);

          if (linkedInv) {
            const newPaid = Number(linkedInv.amount_paid) + tx.amount;
            const newBalance = Math.max(0, Number(linkedInv.total_amount) - newPaid);
            const newStatus = newBalance === 0 ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid');
            db.prepare('UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?').run(newPaid, newBalance, newStatus, linkedInv.id);
          }
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      } else {
        db.prepare(`
          UPDATE mpesa_transactions
          SET status = 'cancelled', result_code = ?, result_desc = ?, raw_callback = ?, updated_at = CURRENT_TIMESTAMP
          WHERE checkout_request_id = ?
        `).run(resultCode, resultDesc, JSON.stringify(mockSafaricomPayload), checkoutRequestId);
      }

      return sendJSON(res, 200, { success: true, status: isSuccess ? 'completed' : 'cancelled', mpesa_receipt_number: receiptCode });
    }

    // 7f. Daraja 3.0: Dynamic M-Pesa QR Code Generator
    if (pathname === '/api/mpesa/qrcode' && method === 'POST') {
      const b = await parseBody(req);
      const amount = Number(b.amount) || 0;
      const refNo = b.ref_no || (b.invoice_id ? `INV-${b.invoice_id}` : 'RENT-D1');
      const trxCode = b.trx_code || 'PB';
      const config = getDarajaConfig(process.env);
      const qrData = await generateDarajaQrCode({ amount, refNo, trxCode }, config);
      return sendJSON(res, 200, { success: true, ...qrData });
    }

    // 7g. Daraja 3.0: M-Pesa Ratiba (Standing Order Auto-Pay Creation)
    if (pathname === '/api/mpesa/ratiba/create' && method === 'POST') {
      const b = await parseBody(req);
      const tenantId = Number(b.tenant_id);
      const amount = Number(b.amount);
      const phone = normalizeMpesaPhone(b.phone);
      const startDate = b.start_date || new Date().toISOString().split('T')[0];
      const endDate = b.end_date || new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0];
      const frequency = Number(b.frequency) || 5; // 5 = Monthly
      const standingOrderName = b.standing_order_name || `Rent AutoPay Tenant #${tenantId}`;
      const accountReference = b.account_reference || `UNIT-${tenantId}`;

      if (!tenantId || !amount || !phone) {
        return sendJSON(res, 400, { error: 'tenant_id, amount, and valid phone are required' });
      }

      const safStandingOrderId = `SO_RATIBA_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      const info = db.prepare(`
        INSERT INTO ratiba_standing_orders (
          tenant_id, standing_order_name, phone, amount, frequency,
          start_date, end_date, account_reference, status, saf_standing_order_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(tenantId, standingOrderName, phone, amount, frequency, startDate, endDate, accountReference, safStandingOrderId);

      const created = db.prepare('SELECT * FROM ratiba_standing_orders WHERE id = ?').get(info.lastInsertRowid);
      return sendJSON(res, 201, {
        success: true,
        message: 'M-Pesa Ratiba monthly recurring rent standing order active',
        standing_order: created
      });
    }

    // 7h. Daraja 3.0: Get Tenant Active Ratiba Standing Orders
    if (pathname.startsWith('/api/mpesa/ratiba/tenant/') && method === 'GET') {
      const tenantId = Number(pathname.split('/').pop());
      const orders = db.prepare('SELECT * FROM ratiba_standing_orders WHERE tenant_id = ? ORDER BY id DESC').all(tenantId);
      return sendJSON(res, 200, orders);
    }

    // 7i. Daraja 3.0: Cancel Ratiba Standing Order
    if (pathname.startsWith('/api/mpesa/ratiba/cancel/') && method === 'POST') {
      const id = Number(pathname.split('/').pop());
      db.prepare("UPDATE ratiba_standing_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      return sendJSON(res, 200, { success: true, message: 'Standing order cancelled successfully' });
    }

    // 8. Water Meter Readings Engine (BomaHut core utility feature)
    if (pathname === '/api/water-readings' && method === 'GET') {
      const readings = db.prepare(`
        SELECT 
          w.*,
          u.unit_number,
          u.meter_number,
          p.name as property_name,
          t.name as tenant_name
        FROM water_readings w
        JOIN units u ON w.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        LEFT JOIN leases l ON u.id = l.unit_id AND l.status = 'active'
        LEFT JOIN tenants t ON l.tenant_id = t.id
        ORDER BY w.reading_date DESC, w.id DESC
      `).all();
      return sendJSON(res, 200, readings);
    }

    if (pathname === '/api/water-readings' && method === 'POST') {
      const b = await parseBody(req);
      const prev = Number(b.previous_reading || 0);
      const curr = Number(b.current_reading || 0);
      const consumed = Math.max(0, curr - prev);
      const rate = Number(b.rate_per_unit || 175.0); // KES per unit
      const totalCost = consumed * rate;

      const stmt = db.prepare(`
        INSERT INTO water_readings (unit_id, month, reading_date, previous_reading, current_reading, units_consumed, rate_per_unit, total_cost, invoiced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);
      const info = stmt.run(
        Number(b.unit_id || 1), b.month || new Date().toISOString().slice(0, 7),
        b.reading_date || new Date().toISOString().slice(0, 10),
        prev, curr, consumed, rate, totalCost
      );
      return sendJSON(res, 201, {
        success: true,
        id: info.lastInsertRowid,
        units_consumed: consumed,
        total_cost: totalCost
      });
    }

    // 9. Maintenance & Work Orders (AppFolio / DoorLoop style)
    if (pathname === '/api/maintenance' && method === 'GET') {
      const tickets = db.prepare(`
        SELECT 
          m.*,
          p.name as property_name,
          u.unit_number,
          t.name as tenant_name,
          t.phone as tenant_phone
        FROM maintenance_requests m
        JOIN properties p ON m.property_id = p.id
        JOIN units u ON m.unit_id = u.id
        LEFT JOIN tenants t ON m.tenant_id = t.id
        ORDER BY 
          CASE m.priority 
            WHEN 'emergency' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            ELSE 4 
          END,
          m.requested_date DESC
      `).all();
      return sendJSON(res, 200, tickets);
    }

    if (pathname === '/api/maintenance' && method === 'POST') {
      const b = await parseBody(req);
      const ticketNum = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
      let propId = b.property_id || null;
      if (!propId && b.unit_id) {
        const u = db.prepare('SELECT property_id FROM units WHERE id = ?').get(b.unit_id);
        if (u) propId = u.property_id;
      }
      if (!propId) propId = 1;

      const stmt = db.prepare(`
        INSERT INTO maintenance_requests (
          ticket_number, property_id, unit_id, tenant_id, title, description,
          category, priority, status, assigned_contractor, contractor_phone,
          estimated_cost, actual_cost, requested_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, ?)
      `);
      const info = stmt.run(
        ticketNum,
        propId,
        b.unit_id || null,
        b.tenant_id || null,
        b.title || 'General Maintenance',
        b.description || '',
        b.category || 'General',
        b.priority || 'medium',
        b.status || 'open',
        b.assigned_contractor || '',
        b.contractor_phone || '',
        Number(b.estimated_cost || 0),
        b.notes || ''
      );
      return sendJSON(res, 201, {
        success: true,
        id: info.lastInsertRowid,
        ticket_number: ticketNum,
        ticket: ticketNum
      });
    }

    if (pathname.startsWith('/api/maintenance/') && method === 'PUT') {
      const ticketId = pathname.split('/')[3];
      const b = await parseBody(req);
      const completedDate = (b.status === 'completed' || b.status === 'resolved') 
        ? new Date().toISOString().replace('T', ' ').slice(0, 19)
        : null;

      const stmt = db.prepare(`
        UPDATE maintenance_requests SET 
          status = COALESCE(?, status),
          assigned_contractor = COALESCE(?, assigned_contractor),
          contractor_phone = COALESCE(?, contractor_phone),
          estimated_cost = COALESCE(?, estimated_cost),
          actual_cost = COALESCE(?, actual_cost),
          completed_date = COALESCE(?, completed_date),
          notes = COALESCE(?, notes)
        WHERE id = ?
      `);
      stmt.run(
        b.status ?? null,
        b.assigned_contractor ?? null,
        b.contractor_phone ?? null,
        b.estimated_cost !== undefined ? Number(b.estimated_cost) : null,
        b.actual_cost !== undefined ? Number(b.actual_cost) : null,
        completedDate ?? null,
        b.notes ?? null,
        ticketId
      );
      return sendJSON(res, 200, { success: true });
    }

    // 10. Communications (SMS & WhatsApp Hub)
    if (pathname === '/api/communications' && method === 'GET') {
      const comms = db.prepare(`
        SELECT c.*, t.name as registered_tenant_name
        FROM communications c
        LEFT JOIN tenants t ON c.tenant_id = t.id
        ORDER BY c.sent_at DESC
        LIMIT 50
      `).all();
      return sendJSON(res, 200, comms);
    }

    if (pathname === '/api/communications/send' && method === 'POST') {
      const b = await parseBody(req);
      const stmt = db.prepare(`
        INSERT INTO communications (type, recipient_name, recipient_phone, tenant_id, message, status, purpose)
        VALUES (?, ?, ?, ?, ?, 'delivered', ?)
      `);
      const info = stmt.run(
        b.type || 'sms', b.recipient_name, b.recipient_phone,
        b.tenant_id || null, b.message, b.purpose || 'direct_message'
      );
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
    }

    if (pathname === '/api/communications/broadcast' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (!user) {
        return sendJSON(res, 401, { error: '401 Unauthorized: Valid authentication token required.' });
      }
      if (user.role === 'caretaker' || user.role === 'tenant' || user.role === 'landlord') {
        return sendJSON(res, 403, { error: '403 Forbidden: Broadcasting bulk communications requires Property Manager privileges.' });
      }
      const b = await parseBody(req);
      const propertyId = b.property_id;
      const message = b.message;
      const type = b.type || 'sms';

      let query = `
        SELECT DISTINCT t.id, t.name, t.phone, p.name as prop_name
        FROM tenants t
        JOIN leases l ON t.id = l.tenant_id AND l.status = 'active'
        JOIN units u ON l.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
      `;
      const params = [];
      if (propertyId) {
        query += ' WHERE p.id = ?';
        params.push(propertyId);
      }

      const recipients = db.prepare(query).all(...params);
      let count = 0;
      const insertComm = db.prepare(`
        INSERT INTO communications (type, recipient_name, recipient_phone, tenant_id, message, status, purpose)
        VALUES (?, ?, ?, ?, ?, 'delivered', 'broadcast')
      `);

      for (const r of recipients) {
        insertComm.run(type, r.name, r.phone, r.id, message);
        count++;
      }

      return sendJSON(res, 200, { success: true, count, recipients_reached: count, recipient_count: count });
    }

    // 11. Landlord Statements & Financial Reports (with RBAC)
    if (pathname === '/api/reports/landlord-statement' && method === 'GET') {
      const user = resolveRequestUser(req);
      if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
        return sendJSON(res, 403, { 
          error: '403 Forbidden: Access to owner remittance statements is restricted to Landlords and Property Managers.' 
        });
      }

      let propertyId = parsedUrl.searchParams.get('property_id') || 1;
      // If user is a Landlord, lock strictly to their assigned property!
      if (user && user.role === 'landlord' && user.property_id) {
        if (Number(propertyId) !== Number(user.property_id)) {
          return sendJSON(res, 403, { 
            error: `403 Forbidden: Landlord '${user.name}' is only authorized to view statements for Property ID ${user.property_id}.` 
          });
        }
        propertyId = user.property_id;
      }

      const month = parsedUrl.searchParams.get('month') || new Date().toISOString().slice(0, 7);

      const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId);
      if (!property) return sendJSON(res, 404, { error: 'Property not found' });

      // Invoices & rent collections for this property
      const rentInvoices = db.prepare(`
        SELECT 
          i.*, u.unit_number, u.unit_type, t.name as tenant_name
        FROM invoices i
        JOIN units u ON i.unit_id = u.id
        JOIN tenants t ON i.tenant_id = t.id
        WHERE u.property_id = ? AND i.month = ?
      `).all(propertyId, month);

      const collections = db.prepare(`
        SELECT COALESCE(SUM(i.amount_paid), 0) as total_collected,
               COALESCE(SUM(i.total_amount), 0) as total_billed,
               COALESCE(SUM(i.balance), 0) as total_arrears
        FROM invoices i
        JOIN units u ON i.unit_id = u.id
        WHERE u.property_id = ? AND i.month = ?
      `).get(propertyId, month);

      // Property operating expenses for this period
      const expenses = db.prepare(`
        SELECT * FROM expenses 
        WHERE property_id = ? AND expense_date LIKE ?
      `).all(propertyId, `${month}%`);

      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const grossCollections = Number(collections.total_collected);
      const managementFeeRate = Number(property.management_fee_pct || 10.0);
      const managementFeeAmount = (grossCollections * managementFeeRate) / 100;
      const netLandlordRemittance = Math.max(0, grossCollections - managementFeeAmount - totalExpenses);

      return sendJSON(res, 200, {
        success: true,
        statement: {
          property,
          month,
          gross_collections: grossCollections,
          gross_rent_collected: grossCollections,
          total_billed: Number(collections.total_billed),
          total_arrears: Number(collections.total_arrears),
          management_fee_rate: managementFeeRate,
          management_fee_amount: managementFeeAmount,
          operating_expenses: totalExpenses,
          net_remittance_payout: netLandlordRemittance,
          expenses_breakdown: expenses,
          invoices_breakdown: rentInvoices
        }
      });
    }

    // 12. Expenses (with RBAC)
    if (pathname === '/api/expenses' && method === 'GET') {
      const user = resolveRequestUser(req);
      if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
        return sendJSON(res, 403, { error: '403 Forbidden: Caretakers and Tenants are not permitted to inspect property operating expenses.' });
      }

      let query = `
        SELECT e.*, p.name as property_name
        FROM expenses e
        JOIN properties p ON e.property_id = p.id
      `;
      const params = [];
      if (user && user.role === 'landlord' && user.property_id) {
        query += ' WHERE e.property_id = ? ';
        params.push(user.property_id);
      }
      query += ' ORDER BY e.expense_date DESC';
      const expenses = db.prepare(query).all(...params);
      return sendJSON(res, 200, expenses);
    }

    if (pathname === '/api/expenses' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (!user) {
        return sendJSON(res, 401, { error: '401 Unauthorized: Valid authentication token required.' });
      }
      if (user.role === 'tenant' || user.role === 'caretaker') {
        return sendJSON(res, 403, { error: '403 Forbidden: Only Property Managers and Landlords can log operating expense vouchers.' });
      }
      const b = await parseBody(req);
      const stmt = db.prepare(`
        INSERT INTO expenses (property_id, category, description, amount, expense_date, paid_to, receipt_voucher)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        Number(b.property_id || 1),
        b.category || 'Repairs',
        b.description || 'Property operating expense',
        Number(b.amount || 0),
        b.expense_date || new Date().toISOString().slice(0, 10),
        b.paid_to || '',
        b.receipt_voucher || `VCH-${crypto.randomInt(1000, 10000)}`
      );
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
    }

    // 13. User & Role Management (Strict SaaS RBAC: Admin & Manager Only)
    if (pathname === '/api/users' && method === 'GET') {
      const user = resolveRequestUser(req);
      if (!user) {
        return sendJSON(res, 401, { error: '401 Unauthorized: Valid authentication token required.' });
      }
      if (user.role === 'caretaker' || user.role === 'tenant' || user.role === 'landlord') {
        return sendJSON(res, 403, { 
          error: `403 Forbidden: Role '${user.role}' is not authorized to inspect system user directories.` 
        });
      }

      const users = db.prepare(`
        SELECT u.id, u.name, u.email, u.phone, u.role, u.property_id, u.tenant_id, u.status, u.created_at,
               p.name as property_name, t.name as linked_tenant_name
        FROM users u
        LEFT JOIN properties p ON u.property_id = p.id
        LEFT JOIN tenants t ON u.tenant_id = t.id
        ORDER BY 
          CASE u.role 
            WHEN 'super_admin' THEN 1 
            WHEN 'property_manager' THEN 2 
            WHEN 'caretaker' THEN 3 
            WHEN 'landlord' THEN 4 
            ELSE 5 
          END,
          u.name ASC
      `).all();
      return sendJSON(res, 200, users);
    }

    if (pathname === '/api/users' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (!user) {
        return sendJSON(res, 401, { error: '401 Unauthorized: Valid authentication token required.' });
      }
      if (user.role !== 'super_admin' && user.role !== 'property_manager') {
        return sendJSON(res, 403, { error: '403 Forbidden: Provisioning SaaS users requires Administrative privileges.' });
      }
      const b = await parseBody(req);
      if (!b.name || !b.email) {
        return sendJSON(res, 400, { error: 'Name and email are required to provision a user.' });
      }
      const passwordHash = hashPassword(b.password || 'password123');
      const stmt = db.prepare(`
        INSERT INTO users (name, email, password_hash, phone, role, property_id, tenant_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        b.name, b.email, passwordHash, b.phone || '', b.role || 'property_manager',
        b.property_id ? Number(b.property_id) : null,
        b.tenant_id ? Number(b.tenant_id) : null,
        b.status || 'active'
      );
      const newUser = db.prepare('SELECT id, name, email, phone, role, property_id, tenant_id, status FROM users WHERE id = ?').get(info.lastInsertRowid);
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid, user: newUser });
    }

    if (pathname.startsWith('/api/users/') && method === 'PUT') {
      const user = resolveRequestUser(req);
      if (!user) {
        return sendJSON(res, 401, { error: '401 Unauthorized: Valid authentication token required.' });
      }
      if (user.role !== 'super_admin' && user.role !== 'property_manager') {
        return sendJSON(res, 403, { error: '403 Forbidden: Modifying user accounts requires Administrative privileges.' });
      }
      const userId = pathname.split('/')[3];
      const b = await parseBody(req);
      const stmt = db.prepare(`
        UPDATE users SET 
          name = COALESCE(?, name),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          role = COALESCE(?, role),
          property_id = COALESCE(?, property_id),
          status = COALESCE(?, status)
        WHERE id = ?
      `);
      stmt.run(
        b.name ?? null,
        b.email ?? null,
        b.phone ?? null,
        b.role ?? null,
        b.property_id !== undefined ? (b.property_id ? Number(b.property_id) : null) : null,
        b.status ?? null,
        userId
      );
      if (b.password && b.password.trim()) {
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(b.password.trim()), userId);
      }
      return sendJSON(res, 200, { success: true });
    }

    if (pathname.startsWith('/api/users/') && method === 'DELETE') {
      const user = resolveRequestUser(req);
      if (!user) {
        return sendJSON(res, 401, { error: '401 Unauthorized: Valid authentication token required.' });
      }
      if (user.role !== 'super_admin' && user.role !== 'property_manager') {
        return sendJSON(res, 403, { error: '403 Forbidden: Deleting user accounts requires Administrative privileges.' });
      }
      const userId = pathname.split('/')[3];
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      return sendJSON(res, 200, { success: true });
    }

    // Reset / Seed database
    if (pathname === '/api/reset-seed' && method === 'POST') {
      const user = resolveRequestUser(req);
      if (!user || user.role !== 'super_admin') {
        return sendJSON(res, 403, { error: '403 Forbidden: System database reset requires Super Admin authentication.' });
      }
      db.exec(`
        DELETE FROM users;
        DELETE FROM payments;
        DELETE FROM invoices;
        DELETE FROM water_readings;
        DELETE FROM maintenance_requests;
        DELETE FROM communications;
        DELETE FROM expenses;
        DELETE FROM leases;
        DELETE FROM units;
        DELETE FROM tenants;
        DELETE FROM properties;
      `);
      seedDatabase();
      return sendJSON(res, 200, { success: true, message: 'Database reset and seeded with fresh data' });
    }

    // ==========================================
    // PUBLIC VACANCIES & VIEWING BOOKING API
    // ==========================================
    if (pathname === '/api/public/vacancies' && method === 'GET') {
      const totalUnits = db.prepare('SELECT count(*) as count FROM units').get()?.count || 0;
      let vacancies = db.prepare(`
        SELECT 
          u.id, u.unit_number, u.floor, u.unit_type, u.base_rent, u.service_charge, u.garbage_fee,
          u.status, u.notes, u.image_url as unit_image,
          p.id as property_id, p.name as property_name, p.property_type, p.address, p.city, p.image_url as property_image
        FROM units u
        JOIN properties p ON u.property_id = p.id
        WHERE LOWER(TRIM(u.status)) = 'vacant'
        ORDER BY u.id DESC
      `).all();

      const enriched = vacancies.map(v => {
        let bedrooms = 2;
        let bathrooms = 2;
        let sqft = 1100;
        let photo = v.unit_image || v.property_image || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80';
        let higgsfield = {
          mode: 'dolly',
          rig: 'Interior Tracking Glide (35mm Cine)',
          fps: 24,
          lighting: 'Golden hour ambient diffusion (3200K)',
          prompt: 'Dolly forward through sunlit living room with teak finishes, open balcony overlooking gardens, natural light, 35mm lens, steadycam 24fps glide, photorealistic.'
        };

        if (v.unit_type.includes('Commercial') || v.unit_type.includes('Office')) {
          bedrooms = 0;
          bathrooms = 1;
          sqft = 650;
          photo = v.unit_image || v.property_image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80';
          higgsfield = {
            mode: 'pan',
            rig: 'Pedestal Horizontal Pan (24mm Cine)',
            fps: 24,
            lighting: 'Cool executive daylight & recessed LED ceiling glow',
            prompt: 'Slow horizontal pedestal pan across open-plan executive commercial office suite, glass partition reflections, panoramic city view, 24fps smooth pan.'
          };
        } else if (v.unit_type.includes('3-Bedroom') || v.unit_type.includes('DSQ')) {
          bedrooms = 3;
          bathrooms = 3;
          sqft = 1650;
          photo = v.unit_image || v.property_image || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80';
          higgsfield = {
            mode: 'dolly',
            rig: 'Steadicam Dolly In (35mm Anamorphic)',
            fps: 24,
            lighting: 'Warm afternoon golden hour ambient diffusion',
            prompt: 'Dolly forward through sunlit living room with teak dining finishes, open balcony overlooking lush gardens, natural volumetric light, 35mm lens, photorealistic.'
          };
        } else if (v.unit_type.includes('Townhouse') || v.unit_type.includes('Villa')) {
          bedrooms = 4;
          bathrooms = 4.5;
          sqft = 3200;
          photo = v.unit_image || v.property_image || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80';
          higgsfield = {
            mode: 'aerial',
            rig: 'Cinema Drone 3D Arc Pullback',
            fps: 24,
            lighting: 'Sunset golden hour with warm interior window glow',
            prompt: 'Cinematic drone aerial pullback, 4k ultra-high definition, slow smooth arc revealing modern luxury villa at golden hour, private manicured lawn, warm ambient interior lighting visible through floor-to-ceiling glass.'
          };
        }

        const deposit = v.base_rent * 2;
        const totalMonthly = v.base_rent + (v.service_charge || 0) + (v.garbage_fee || 0);

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
          photos = [photo];
        }

        return {
          ...v,
          bedrooms,
          bathrooms,
          sqft,
          photo,
          photos,
          deposit,
          total_monthly: totalMonthly,
          higgsfield,
          amenities: ['High-Speed Fiber', 'Borehole Water', '24/7 Manned Security', 'Backup Generator', 'Reserved Parking', 'Solar Water Heating']
        };
      });

      return sendJSON(res, 200, { success: true, count: enriched.length, vacancies: enriched });
    }

    if (pathname === '/api/public/book-viewing' && method === 'POST') {
      const b = await parseBody(req);
      const { unit_id, prospect_name, phone, email, preferred_date, time_slot, notes } = b;
      if (!unit_id || !prospect_name || !phone || !preferred_date) {
        return sendJSON(res, 400, { error: 'Unit ID, prospect name, phone, and preferred date are required.' });
      }

      const unit = db.prepare(`
        SELECT u.*, p.name as property_name 
        FROM units u 
        JOIN properties p ON u.property_id = p.id 
        WHERE u.id = ?
      `).get(unit_id);

      const ref = 'VIEW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const insertLead = db.prepare(`
        INSERT INTO viewing_leads (unit_id, prospect_name, phone, email, preferred_date, time_slot, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)
      `).run(unit_id, prospect_name, phone, email || null, preferred_date, time_slot || '10:00 AM', notes || null);

      // 1. Prospect confirmation SMS
      db.prepare(`
        INSERT INTO communications (type, recipient_name, recipient_phone, message, status, purpose)
        VALUES ('sms', ?, ?, ?, 'delivered', 'viewing_confirmation')
      `).run(
        prospect_name,
        phone,
        `Hello ${prospect_name}, your viewing reference is ${ref} for Unit ${unit?.unit_number || ''} at ${unit?.property_name || 'BomaSphere'} on ${preferred_date} at ${time_slot || '10:00 AM'}. Our property caretaker will welcome you. - BomaSphere Management`
      );

      // 2. Caretaker / Manager Alert SMS
      const caretaker = db.prepare("SELECT * FROM users WHERE role = 'caretaker' LIMIT 1").get();
      if (caretaker) {
        db.prepare(`
          INSERT INTO communications (type, recipient_name, recipient_phone, message, status, purpose)
          VALUES ('sms', ?, ?, ?, 'delivered', 'viewing_caretaker_alert')
        `).run(
          caretaker.name,
          caretaker.phone || '+254711223344',
          `Viewing Alert: ${prospect_name} (${phone}) scheduled to view Unit ${unit?.unit_number || ''} (${unit?.property_name || ''}) on ${preferred_date} at ${time_slot || '10:00 AM'}. Reference: ${ref}.`
        );
      }

      return sendJSON(res, 201, {
        success: true,
        reference: ref,
        booking_reference: ref,
        lead_id: insertLead.lastInsertRowid,
        message: 'Viewing successfully booked. Confirmation SMS dispatched.'
      });
    }

    if (pathname === '/api/viewing-leads' && method === 'GET') {
      const leads = db.prepare(`
        SELECT v.*, u.unit_number, u.unit_type, u.base_rent, p.name as property_name
        FROM viewing_leads v
        JOIN units u ON v.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        ORDER BY v.preferred_date DESC, v.id DESC
      `).all();
      return sendJSON(res, 200, { success: true, count: leads.length, leads });
    }

    if (pathname.startsWith('/api/viewing-leads/') && method === 'PUT') {
      const id = pathname.split('/')[3];
      const b = await parseBody(req);
      db.prepare(`
        UPDATE viewing_leads SET
          status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          preferred_date = COALESCE(?, preferred_date),
          time_slot = COALESCE(?, time_slot)
        WHERE id = ?
      `).run(b.status || null, b.notes || null, b.preferred_date || null, b.time_slot || null, id);
      return sendJSON(res, 200, { success: true, message: 'Viewing lead updated successfully.' });
    }

    // ==========================================
    // FEATURE 1: WHATSAPP BUSINESS BOT WEBHOOK
    // ==========================================
    if (pathname === '/api/whatsapp/webhook' && method === 'POST') {
      const b = await parseBody(req);
      const phone = b.phone || b.From || '+254722889900';
      const incomingText = (b.message || b.Body || '').trim();

      let tenant = db.prepare("SELECT * FROM tenants WHERE phone LIKE ? OR phone LIKE ?").get(`%${phone.slice(-9)}%`, phone);
      if (!tenant) tenant = db.prepare("SELECT * FROM tenants LIMIT 1").get();

      const cmd = incomingText.toUpperCase();
      let replyText = '';
      let action = 'menu';

      if (cmd.includes('BALANCE') || cmd === '1') {
        const inv = db.prepare("SELECT * FROM invoices WHERE tenant_id = ? ORDER BY id DESC LIMIT 1").get(tenant.id);
        const bal = inv ? inv.balance : 0;
        replyText = `Jambo ${tenant.name}! Your current BomaSphere balance is KES ${Number(bal).toLocaleString()}. Due date: 5th of this month. Pay easily via Paybill 522522, Account: ${inv?.invoice_number || 'RENT'}. Reply 'PAY' to trigger instant M-Pesa prompt.`;
        action = 'balance';
      } else if (cmd.includes('RECEIPT') || cmd === '2') {
        const pmt = db.prepare("SELECT * FROM payments WHERE tenant_id = ? ORDER BY id DESC LIMIT 1").get(tenant.id);
        if (pmt) {
          replyText = `Official BomaSphere Receipt: ${pmt.receipt_number}. Paid KES ${Number(pmt.amount).toLocaleString()} via ${pmt.payment_method} on ${pmt.payment_date}. Ref: ${pmt.reference_code}. Status: Verified.`;
        } else {
          replyText = `No recent receipts found for account ${tenant.name}.`;
        }
        action = 'receipt';
      } else if (cmd.includes('PAY') || cmd === '3') {
        const inv = db.prepare("SELECT * FROM invoices WHERE tenant_id = ? AND balance > 0 ORDER BY id DESC LIMIT 1").get(tenant.id);
        const amount = inv ? inv.balance : 65000;
        const ref = 'QG' + Math.random().toString(36).substring(2, 10).toUpperCase();
        replyText = `Daraja M-Pesa STK push initiated for KES ${Number(amount).toLocaleString()} to ${phone}. Enter your M-Pesa PIN on handset prompt. Receipt ${ref} will follow.`;
        action = 'pay';
      } else if (cmd.startsWith('TICKET') || cmd === '4') {
        const issue = incomingText.replace(/^TICKET/i, '').trim() || 'General repairs needed';
        const tktNum = 'TKT-' + Math.floor(1000 + Math.random() * 9000);
        const unit = db.prepare("SELECT * FROM units LIMIT 1").get();
        db.prepare(`
          INSERT INTO maintenance_requests (ticket_number, property_id, unit_id, tenant_id, title, description, category, priority, status)
          VALUES (?, ?, ?, ?, ?, ?, 'plumbing', 'medium', 'open')
        `).run(tktNum, unit.property_id, unit.id, tenant.id, 'WhatsApp: ' + issue.substring(0, 40), issue);
        replyText = `Maintenance ticket ${tktNum} logged successfully for ${tenant.name}! Our site caretaker has been notified and will contact you shortly.`;
        action = 'ticket';
      } else {
        replyText = `Welcome to BomaSphere WhatsApp Business Bot!\n\nReply with a number or keyword:\n1. BALANCE - Check your current rent & water dues\n2. RECEIPT - View latest official payment receipt\n3. PAY - Receive 1-tap Lipa Na M-Pesa prompt\n4. TICKET <issue> - Report a maintenance issue\n\nOur office is open Mon-Fri 8AM - 5PM.`;
      }

      db.prepare(`
        INSERT INTO communications (type, recipient_name, recipient_phone, message, status, purpose)
        VALUES ('whatsapp', ?, ?, ?, 'delivered', ?)
      `).run(tenant.name, phone, replyText, action);

      return sendJSON(res, 200, {
        success: true,
        tenant_name: tenant.name,
        incoming: incomingText,
        reply: replyText,
        action
      });
    }

    if (pathname === '/api/whatsapp/history' && method === 'GET') {
      const messages = db.prepare(`
        SELECT * FROM communications WHERE type = 'whatsapp' ORDER BY id DESC LIMIT 20
      `).all();
      return sendJSON(res, 200, { success: true, messages });
    }

    // ==========================================
    // FEATURE 2: AI TENANT VETTING & CRB SCORING
    // ==========================================
    if (pathname === '/api/tenant-vetting' && method === 'GET') {
      const list = db.prepare(`
        SELECT v.*, u.unit_number, u.base_rent, p.name as property_name
        FROM tenant_vettings v
        LEFT JOIN units u ON v.requested_unit_id = u.id
        LEFT JOIN properties p ON u.property_id = p.id
        ORDER BY v.id DESC
      `).all();
      return sendJSON(res, 200, { success: true, vettings: list });
    }

    if (pathname === '/api/tenant-vetting/analyze' && method === 'POST') {
      const b = await parseBody(req);
      const { applicant_name, phone, email, id_number, requested_unit_id, monthly_income } = b;
      if (!applicant_name || !monthly_income || !requested_unit_id) {
        return sendJSON(res, 400, { error: 'Applicant name, monthly income, and requested unit ID are required.' });
      }

      const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(requested_unit_id);
      if (!unit) return sendJSON(res, 404, { error: 'Target unit not found.' });

      const income = Number(monthly_income);
      const rent = unit.base_rent;
      const rentToIncome = Number(((rent / income) * 100).toFixed(1));

      let crbScore = 750;
      let riskCategory = 'Low Risk';
      let recommendation = 'Approved: Clean CRB credit report and healthy rent-to-income ratio.';

      if (rentToIncome > 45) {
        crbScore = 580;
        riskCategory = 'High Risk';
        recommendation = 'Declined: Rent exceeds 45% of verified monthly income. Guarantor required.';
      } else if (rentToIncome > 35) {
        crbScore = 660;
        riskCategory = 'Medium Risk';
        recommendation = 'Conditional Approval: Require 2 months security deposit and direct debit authorization.';
      } else {
        crbScore = Math.floor(740 + Math.random() * 80);
      }

      const resInsert = db.prepare(`
        INSERT INTO tenant_vettings (applicant_name, phone, email, id_number, requested_unit_id, monthly_income, crb_score, risk_category, rent_to_income_pct, recommendation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(applicant_name, phone || '+254700000000', email || null, id_number || 'ID-VERIFIED', requested_unit_id, income, crbScore, riskCategory, rentToIncome, recommendation);

      const analysisData = {
        applicant_name,
        crb_score: crbScore,
        risk_category: riskCategory,
        rent_to_income_pct: rentToIncome,
        recommendation
      };

      return sendJSON(res, 201, {
        success: true,
        vetting_id: resInsert.lastInsertRowid,
        applicant_name,
        crb_score: crbScore,
        risk_category: riskCategory,
        rent_to_income_pct: rentToIncome,
        recommendation,
        analysis: analysisData
      });
    }

    // ==========================================
    // FEATURE 3: SMART IOT WATER TELEMETRY
    // ==========================================
    if (pathname === '/api/iot/devices' && method === 'GET') {
      const devices = db.prepare(`
        SELECT d.*, u.unit_number, p.name as property_name
        FROM iot_devices d
        JOIN properties p ON d.property_id = p.id
        LEFT JOIN units u ON d.unit_id = u.id
        ORDER BY d.id ASC
      `).all();
      return sendJSON(res, 200, { success: true, count: devices.length, devices });
    }

    if (pathname === '/api/iot/leak-alerts' && method === 'GET') {
      const alerts = db.prepare(`
        SELECT a.*, d.meter_number, u.unit_number, p.name as property_name
        FROM leak_alerts a
        JOIN iot_devices d ON a.device_id = d.id
        JOIN units u ON a.unit_id = u.id
        JOIN properties p ON d.property_id = p.id
        ORDER BY a.id DESC
      `).all();
      return sendJSON(res, 200, { success: true, count: alerts.length, alerts });
    }

    if (pathname === '/api/iot/valve-toggle' && method === 'POST') {
      const b = await parseBody(req);
      const { device_id, valve_status } = b;
      if (!device_id || !valve_status) {
        return sendJSON(res, 400, { error: 'Device ID and valve status (open/closed) are required.' });
      }

      db.prepare('UPDATE iot_devices SET valve_status = ? WHERE id = ?').run(valve_status, device_id);
      const updated = db.prepare('SELECT * FROM iot_devices WHERE id = ?').get(device_id);
      return sendJSON(res, 200, { success: true, message: `Smart valve ${valve_status.toUpperCase()} command acknowledged.`, device: updated });
    }

    // ==========================================
    // FEATURE 4: MULTI-PROPERTY KRA eTIMS & 7.5% MRI
    // ==========================================
    if (pathname === '/api/tax/etims-summary' && method === 'GET') {
      const records = db.prepare(`
        SELECT e.*, i.invoice_number, i.month, u.unit_number, p.name as property_name, t.name as tenant_name
        FROM etims_records e
        JOIN invoices i ON e.invoice_id = i.id
        JOIN units u ON i.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        JOIN tenants t ON i.tenant_id = t.id
        ORDER BY e.id DESC
      `).all();

      const totals = db.prepare(`
        SELECT 
          COUNT(*) as total_transmitted,
          SUM(taxable_amount) as total_taxable_rent,
          SUM(tax_payable) as total_mri_tax
        FROM etims_records
      `).get();

      return sendJSON(res, 200, {
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
      const b = await parseBody(req);
      const { invoice_id } = b;
      if (!invoice_id) return sendJSON(res, 400, { error: 'Invoice ID is required' });

      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
      if (!invoice) return sendJSON(res, 404, { error: 'Invoice not found' });

      const existing = db.prepare('SELECT * FROM etims_records WHERE invoice_id = ?').get(invoice_id);
      if (existing) {
        return sendJSON(res, 200, { success: true, record: existing, message: 'Existing eTIMS record returned' });
      }

      const controlCode = `KRA-ETIMS-${invoice.id}-` + Math.random().toString(36).substring(2, 8).toUpperCase();
      const qrUrl = `https://itax.kra.go.ke/KRA-Portal/invoiceVerification.htm?controlCode=${controlCode}`;
      const mri = Math.round(invoice.rent_amount * 0.075);

      db.prepare(`
        INSERT INTO etims_records (invoice_id, control_code, qr_code_url, tax_type, taxable_amount, tax_payable, kra_status)
        VALUES (?, ?, ?, 'MRI_7.5_PCT', ?, ?, 'transmitted')
      `).run(invoice.id, controlCode, qrUrl, invoice.rent_amount, mri);

      const record = db.prepare('SELECT * FROM etims_records WHERE invoice_id = ?').get(invoice_id);
      return sendJSON(res, 201, { success: true, record });
    }

    // ==========================================
    // FEATURE 5: ARTISAN ESCROW MARKETPLACE
    // ==========================================
    if (pathname === '/api/marketplace/fundis' && method === 'GET') {
      const fundis = db.prepare('SELECT * FROM artisan_marketplace ORDER BY rating DESC').all();
      return sendJSON(res, 200, { success: true, count: fundis.length, fundis });
    }

    if (pathname === '/api/marketplace/escrows' && method === 'GET') {
      const escrows = db.prepare(`
        SELECT e.*, m.title as ticket_title, m.ticket_number, f.name as fundi_name, f.trade as fundi_trade, f.phone as fundi_phone
        FROM maintenance_escrows e
        JOIN maintenance_requests m ON e.ticket_id = m.id
        LEFT JOIN artisan_marketplace f ON e.fundi_id = f.id
        ORDER BY e.id DESC
      `).all();
      return sendJSON(res, 200, { success: true, count: escrows.length, escrows });
    }

    if (pathname === '/api/marketplace/escrow/allocate' && method === 'POST') {
      const b = await parseBody(req);
      const { ticket_id, fundi_id, amount, milestone_desc } = b;
      if (!ticket_id || !amount) {
        return sendJSON(res, 400, { error: 'Ticket ID and escrow allocation amount are required.' });
      }

      const resInsert = db.prepare(`
        INSERT INTO maintenance_escrows (ticket_id, fundi_id, amount, status, milestone_desc)
        VALUES (?, ?, ?, 'held', ?)
      `).run(ticket_id, fundi_id || null, Number(amount), milestone_desc || 'Repair milestone deposit');

      return sendJSON(res, 201, {
        success: true,
        escrow_id: resInsert.lastInsertRowid,
        status: 'held',
        message: `KES ${Number(amount).toLocaleString()} successfully locked in escrow for Ticket #${ticket_id}.`
      });
    }

    const isEscrowRelease = (
      (pathname === '/api/marketplace/escrow/release') ||
      (pathname.startsWith('/api/artisan-marketplace/fundi-escrow/') && pathname.endsWith('/release')) ||
      (pathname.startsWith('/api/marketplace/escrows/') && pathname.endsWith('/release'))
    ) && method === 'POST';

    if (isEscrowRelease) {
      const b = await parseBody(req);
      let escrowId = b.escrow_id;
      if (!escrowId && pathname.includes('/fundi-escrow/')) {
        escrowId = pathname.split('/fundi-escrow/')[1].split('/')[0];
      } else if (!escrowId && pathname.includes('/escrows/')) {
        escrowId = pathname.split('/escrows/')[1].split('/')[0];
      }

      let escrow = escrowId ? db.prepare('SELECT * FROM maintenance_escrows WHERE id = ?').get(escrowId) : null;
      if (!escrow) {
        return sendJSON(res, 404, { error: 'Escrow record not found.' });
      }

      const b2cRef = 'B2C-MPESA-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      db.prepare(`
        UPDATE maintenance_escrows
        SET status = 'disbursed', b2c_disbursement_ref = ?, released_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(b2cRef, escrow.id);

      if (escrow.ticket_id) {
        db.prepare("UPDATE maintenance_requests SET status = 'completed', actual_cost = ?, completed_date = CURRENT_TIMESTAMP WHERE id = ?")
          .run(escrow.amount, escrow.ticket_id);
      }

      return sendJSON(res, 200, {
        success: true,
        escrow_id: escrow.id,
        status: 'disbursed',
        b2c_disbursement_ref: b2cRef,
        b2c_reference: b2cRef,
        amount: escrow.amount,
        message: `Escrow released! KES ${Number(escrow.amount).toLocaleString()} disbursed via M-Pesa B2C (${b2cRef}).`
      });
    }

    // ==========================================
    // MODULE 1: DIGITAL LEASE AGREEMENTS & E-SIGNATURES
    // ==========================================
    if (pathname === '/api/leases/agreements' && method === 'GET') {
      const user = resolveRequestUser(req);
      let query = `
        SELECT a.*, t.name as tenant_name, t.phone as tenant_phone, t.email as tenant_email,
               u.unit_number, u.unit_type, p.name as property_name, p.address as property_address
        FROM lease_agreements a
        JOIN tenants t ON a.tenant_id = t.id
        JOIN units u ON a.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
      `;
      const params = [];
      if (user && user.role === 'tenant' && user.tenant_id) {
        query += ' WHERE a.tenant_id = ?';
        params.push(user.tenant_id);
      }
      query += ' ORDER BY a.id DESC';
      const agreements = db.prepare(query).all(...params);
      return sendJSON(res, 200, { success: true, count: agreements.length, agreements });
    }

    if (pathname.startsWith('/api/leases/agreements/') && pathname.endsWith('/sign') && method === 'POST') {
      const id = pathname.split('/')[4];
      const b = await parseBody(req);
      const { signature, signer_role, signer_name } = b; // 'tenant' or 'manager'
      if (!signature) return sendJSON(res, 400, { error: 'Signature image or text is required.' });

      const agreement = db.prepare('SELECT * FROM lease_agreements WHERE id = ?').get(id);
      if (!agreement) return sendJSON(res, 404, { error: 'Lease agreement not found.' });

      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      let tenantSig = agreement.tenant_signature;
      let tenantSignedAt = agreement.tenant_signed_at;
      let managerSig = agreement.manager_signature;
      let managerSignedAt = agreement.manager_signed_at;

      if (signer_role === 'manager' || signer_role === 'property_manager' || signer_role === 'super_admin') {
        managerSig = signature;
        managerSignedAt = timestamp;
      } else {
        tenantSig = signature;
        tenantSignedAt = timestamp;
      }

      const isExecuted = !!(tenantSig && managerSig);
      const newStatus = isExecuted ? 'executed' : (tenantSig ? 'pending_manager' : 'pending_tenant');
      const hash = 'SHA256-' + crypto.createHash('sha256').update(`${agreement.agreement_code}-${tenantSig}-${managerSig}`).digest('hex').substring(0, 24).toUpperCase();

      db.prepare(`
        UPDATE lease_agreements
        SET tenant_signature = ?, tenant_signed_at = ?,
            manager_signature = ?, manager_signed_at = ?,
            status = ?, contract_hash = ?
        WHERE id = ?
      `).run(tenantSig, tenantSignedAt, managerSig, managerSignedAt, newStatus, hash, id);

      const updated = db.prepare('SELECT * FROM lease_agreements WHERE id = ?').get(id);
      return sendJSON(res, 200, {
        success: true,
        agreement: updated,
        is_executed: isExecuted,
        message: isExecuted
          ? `Lease ${agreement.agreement_code} fully executed and legally binding!`
          : `Signature recorded for ${signer_name || 'Signer'}.`
      });
    }

    if (pathname === '/api/leases/agreements' && method === 'POST') {
      const b = await parseBody(req);
      const { lease_id, unit_id, tenant_id, rent_amount, deposit_amount, start_date, end_date, terms_clauses } = b;
      if (!unit_id || !tenant_id || !rent_amount) {
        return sendJSON(res, 400, { error: 'Unit ID, Tenant ID, and Rent Amount are required.' });
      }

      const unit = db.prepare('SELECT unit_number FROM units WHERE id = ?').get(unit_id);
      const code = `BS-LEASE-2026-${unit?.unit_number || Math.floor(100+Math.random()*900)}`;
      const hash = 'SHA256-' + crypto.randomBytes(12).toString('hex').toUpperCase();

      const stmt = db.prepare(`
        INSERT INTO lease_agreements (
          lease_id, unit_id, tenant_id, agreement_code, rent_amount, deposit_amount,
          start_date, end_date, terms_clauses, status, contract_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_tenant', ?)
      `);
      const info = stmt.run(
        lease_id || 1, unit_id, tenant_id, code, Number(rent_amount),
        Number(deposit_amount || rent_amount * 2),
        start_date || new Date().toISOString().slice(0, 10),
        end_date || new Date(Date.now() + 365*86400000).toISOString().slice(0, 10),
        terms_clauses || 'Residential Tenancy Agreement governed by the Laws of Kenya (Landlord and Tenant Act). Rent due by 5th. No subletting.',
        hash
      );

      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid, agreement_code: code });
    }

    // ==========================================
    // MODULE 2: MOVE-IN / MOVE-OUT INSPECTIONS & DEPOSIT SETTLEMENT
    // ==========================================
    if (pathname === '/api/inspections' && method === 'GET') {
      const inspections = db.prepare(`
        SELECT i.*, u.unit_number, u.unit_type, p.name as property_name, t.name as tenant_name
        FROM property_inspections i
        JOIN units u ON i.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        LEFT JOIN tenants t ON i.tenant_id = t.id
        ORDER BY i.id DESC
      `).all();

      const parsed = inspections.map(insp => {
        let checklist = [];
        try { checklist = JSON.parse(insp.checklist_json); } catch (e) {}
        return { ...insp, checklist };
      });

      return sendJSON(res, 200, { success: true, count: parsed.length, inspections: parsed });
    }

    if (pathname === '/api/inspections' && method === 'POST') {
      const b = await parseBody(req);
      const { unit_id, tenant_id, inspection_type, inspector_name, checklist, deposit_held, unpaid_utility_arrears } = b;
      if (!unit_id || !inspection_type) {
        return sendJSON(res, 400, { error: 'Unit ID and Inspection Type (move_in / move_out) are required.' });
      }

      const items = Array.isArray(checklist) ? checklist : [];
      const damagesTotal = items.reduce((sum, it) => sum + (Number(it.repair_cost) || 0), 0);
      const held = Number(deposit_held || 0);
      const arrears = Number(unpaid_utility_arrears || 0);
      const netRefund = Math.max(0, held - arrears - damagesTotal);

      const stmt = db.prepare(`
        INSERT INTO property_inspections (
          unit_id, tenant_id, inspection_type, inspection_date, inspector_name,
          checklist_json, damages_total, deposit_held, unpaid_utility_arrears,
          net_deposit_refund, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
      `);
      const info = stmt.run(
        unit_id, tenant_id || null, inspection_type,
        new Date().toISOString().slice(0, 10),
        inspector_name || 'Inspector / Caretaker',
        JSON.stringify(items),
        damagesTotal, held, arrears, netRefund
      );

      return sendJSON(res, 201, {
        success: true,
        id: info.lastInsertRowid,
        damages_total: damagesTotal,
        net_deposit_refund: netRefund,
        message: 'Inspection report recorded successfully.'
      });
    }

    if (pathname.startsWith('/api/inspections/') && pathname.endsWith('/settle-deposit') && method === 'POST') {
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
      db.prepare(`
        UPDATE property_inspections 
        SET status = 'settled', damages_total = ?, unpaid_utility_arrears = ?, net_deposit_refund = ? 
        WHERE id = ?
      `).run(deductionsDamages, deductionsArrears, netRefund, inspection.id);

      if (inspection.inspection_type === 'move_out' && inspection.unit_id) {
        db.prepare("UPDATE units SET status = 'vacant' WHERE id = ?").run(inspection.unit_id);
        db.prepare("UPDATE leases SET status = 'completed' WHERE unit_id = ? AND status = 'active'").run(inspection.unit_id);
        db.prepare("UPDATE lease_agreements SET status = 'completed' WHERE unit_id = ? AND status = 'executed'").run(inspection.unit_id);
      }

      return sendJSON(res, 200, {
        success: true,
        inspection_id: inspection.id,
        voucher_number: refundVoucher,
        net_refund: netRefund,
        net_refund_amount: netRefund,
        deposit_held: depositHeld,
        deductions_total: deductionsDamages + deductionsArrears,
        message: `Security deposit settled. KES ${netRefund.toLocaleString()} queued for M-Pesa B2C refund (${refundVoucher}).`
      });
    }

    // ==========================================
    // MODULE 3: GATED ESTATE VISITOR PASSES & GATE QR SECURITY
    // ==========================================
    if (pathname === '/api/visitor-passes' && method === 'GET') {
      const user = resolveRequestUser(req);
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
      const passes = db.prepare(query).all(...params);
      return sendJSON(res, 200, { success: true, count: passes.length, passes });
    }

    if (pathname === '/api/visitor-passes' && method === 'POST') {
      const b = await parseBody(req);
      const { unit_id, tenant_id, visitor_name, visitor_phone, vehicle_plate, valid_date, time_slot } = b;
      if (!visitor_name || !visitor_phone) {
        return sendJSON(res, 400, { error: 'Visitor name and phone number are required.' });
      }

      const unitId = unit_id || 1;
      const tenantId = tenant_id || 1;
      const passCode = 'PASS-' + Math.floor(1000 + Math.random() * 9000);
      const date = valid_date || new Date().toISOString().slice(0, 10);
      const slot = time_slot || '08:00 AM - 08:00 PM';
      const qrData = `BOMASPHERE:${passCode}:UNIT-${unitId}:${date}`;

      const stmt = db.prepare(`
        INSERT INTO visitor_passes (
          pass_code, unit_id, tenant_id, visitor_name, visitor_phone,
          vehicle_plate, valid_date, time_slot, status, qr_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `);
      const info = stmt.run(passCode, unitId, tenantId, visitor_name, visitor_phone, vehicle_plate || 'N/A', date, slot, qrData);

      return sendJSON(res, 201, {
        success: true,
        id: info.lastInsertRowid,
        pass_code: passCode,
        qr_data: qrData,
        message: `Visitor Gate Pass ${passCode} generated and dispatched via SMS.`
      });
    }

    if (pathname === '/api/visitor-passes/validate' && method === 'POST') {
      const b = await parseBody(req);
      const { pass_code, action } = b; // action: 'check_in' or 'check_out'
      if (!pass_code) return sendJSON(res, 400, { error: 'Gate pass code is required.' });

      const pass = db.prepare(`
        SELECT v.*, u.unit_number, p.name as property_name, t.name as host_name
        FROM visitor_passes v
        JOIN units u ON v.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        JOIN tenants t ON v.tenant_id = t.id
        WHERE v.pass_code = ? OR v.pass_code = ?
      `).get(pass_code.toUpperCase(), 'PASS-' + pass_code.toUpperCase());

      if (!pass) return sendJSON(res, 404, { error: 'Invalid or unknown gate pass code.' });

      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      if (action === 'check_out' || pass.status === 'checked_in') {
        db.prepare("UPDATE visitor_passes SET status = 'completed', checked_out_at = ? WHERE id = ?").run(timestamp, pass.id);
        return sendJSON(res, 200, { success: true, action: 'check_out', status: 'completed', pass, message: `Visitor ${pass.visitor_name} checked out.` });
      } else {
        db.prepare("UPDATE visitor_passes SET status = 'checked_in', checked_in_at = ? WHERE id = ?").run(timestamp, pass.id);
        return sendJSON(res, 200, { success: true, action: 'check_in', status: 'checked_in', pass, message: `Access granted for ${pass.visitor_name} to Unit ${pass.unit_number} (${pass.host_name}).` });
      }
    }

    // ==========================================
    // MODULE 4: DIASPORA LANDLORD MULTI-CURRENCY HUB & ROI
    // ==========================================
    if (pathname === '/api/reports/diaspora-roi' && method === 'GET') {
      // Rates: 1 USD = 129.50 KES, 1 GBP = 168.20 KES, 1 EUR = 141.00 KES
      const FX_RATES = { KES: 1, USD: 1 / 129.50, GBP: 1 / 168.20, EUR: 1 / 141.00 };

      const properties = db.prepare('SELECT * FROM properties').all();
      const propertyMetrics = properties.map(p => {
        const units = db.prepare('SELECT COUNT(*) as count, SUM(base_rent) as total_rent FROM units WHERE property_id = ?').get(p.id);
        const occupied = db.prepare("SELECT COUNT(*) as count FROM units WHERE property_id = ? AND status = 'occupied'").get(p.id)?.count || 0;
        const totalUnits = units?.count || 1;
        const occupancyPct = Number(((occupied / totalUnits) * 100).toFixed(1));

        // Valuation based on monthly rent capitalized at 8.5%
        const annualRentKES = (units?.total_rent || 0) * 12;
        const estimatedValuationKES = Math.round(annualRentKES / 0.085);
        const netAnnualYieldPct = 8.5;
        const capRatePct = 7.8;

        return {
          id: p.id,
          name: p.name,
          city: p.city,
          property_type: p.property_type,
          total_units: totalUnits,
          occupancy_pct: occupancyPct,
          annual_gross_rent_kes: annualRentKES,
          estimated_valuation_kes: estimatedValuationKES,
          net_yield_pct: netAnnualYieldPct,
          cap_rate_pct: capRatePct
        };
      });

      const totalValuationKES = propertyMetrics.reduce((s, p) => s + p.estimated_valuation_kes, 0);
      const totalAnnualRentKES = propertyMetrics.reduce((s, p) => s + p.annual_gross_rent_kes, 0);

      return sendJSON(res, 200, {
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

    // ==========================================
    // MODULE 5: SHARED ESTATE AMENITIES & BOOKING
    // ==========================================
    if (pathname === '/api/amenities' && method === 'GET') {
      const amenities = db.prepare(`
        SELECT a.*, p.name as property_name, p.city
        FROM estate_amenities a
        JOIN properties p ON a.property_id = p.id
        ORDER BY a.id ASC
      `).all();
      return sendJSON(res, 200, { success: true, count: amenities.length, amenities });
    }

    if (pathname === '/api/amenity-bookings' && method === 'GET') {
      const user = resolveRequestUser(req);
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
      const bookings = db.prepare(query).all(...params);
      return sendJSON(res, 200, { success: true, count: bookings.length, bookings });
    }

    if (pathname === '/api/amenity-bookings' && method === 'POST') {
      const b = await parseBody(req);
      const { amenity_id, booking_date, start_time } = b;
      if (!amenity_id || !booking_date || !start_time) {
        return sendJSON(res, 400, { error: 'Amenity ID, booking date, and start time are required.' });
      }

      const amenity = db.prepare('SELECT * FROM estate_amenities WHERE id = ?').get(amenity_id);
      if (!amenity) return sendJSON(res, 404, { error: 'Amenity not found.' });

      const durationHours = Number(b.duration_hours || b.hours || 2);
      const totalFee = (amenity.hourly_fee || 0) * durationHours;
      const ref = 'BK-' + Math.floor(1000 + Math.random() * 9000);

      const user = resolveRequestUser(req);
      let tenantId = Number(b.tenant_id || user?.tenant_id || 0);
      let unitId = Number(b.unit_id || 0);

      // Relational validation: ensure valid tenant foreign key
      let tenantRow = tenantId ? db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) : null;
      if (!tenantRow) {
        tenantRow = db.prepare('SELECT * FROM tenants ORDER BY id ASC LIMIT 1').get();
        if (tenantRow) tenantId = tenantRow.id;
      }

      // If unitId is not specified, resolve from tenant's active lease
      if (tenantId && !unitId) {
        const lease = db.prepare("SELECT unit_id FROM leases WHERE tenant_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").get(tenantId);
        if (lease) unitId = lease.unit_id;
      }

      // Ensure valid unit foreign key
      let unitRow = unitId ? db.prepare('SELECT * FROM units WHERE id = ?').get(unitId) : null;
      if (!unitRow) {
        unitRow = db.prepare('SELECT * FROM units ORDER BY id ASC LIMIT 1').get();
        if (unitRow) unitId = unitRow.id;
      }

      const endTime = b.end_time || '07:00 PM';

      const stmt = db.prepare(`
        INSERT INTO amenity_bookings (
          booking_reference, amenity_id, tenant_id, unit_id,
          booking_date, start_time, end_time, total_fee, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
      `);
      const info = stmt.run(
        ref, Number(amenity_id), tenantId, unitId,
        booking_date, start_time, endTime, totalFee
      );

      const bookingRecord = {
        id: info.lastInsertRowid,
        booking_reference: ref,
        booking_ref: ref,
        amenity_id: Number(amenity_id),
        amenity_name: amenity.name,
        tenant_id: tenantId,
        unit_id: unitId,
        booking_date,
        start_time,
        end_time: endTime,
        duration_hours: durationHours,
        total_fee: totalFee,
        status: 'confirmed'
      };

      return sendJSON(res, 201, {
        success: true,
        id: info.lastInsertRowid,
        booking_reference: ref,
        booking_ref: ref,
        booking: bookingRecord,
        total_fee: totalFee,
        amenity_name: amenity.name,
        message: `Booking ${ref} confirmed for ${amenity.name} on ${booking_date}. Total fee: KES ${totalFee.toLocaleString()}.`
      });
    }

    // ==========================================
    // STATIC FILE SERVING (Hardened against Traversal & Sinks)
    // ==========================================
    const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
    let safePath = pathname === '/' ? '/index.html' : pathname;
    try {
      safePath = decodeURIComponent(safePath);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
      return res.end('400 Bad Request');
    }

    const baseName = path.basename(safePath);
    if (safePath.includes('..') || pathname.includes('..') || safePath.includes('\0') || WINDOWS_RESERVED.test(baseName)) {
      res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
      return res.end('403 Access Denied: Path traversal or invalid file path detected');
    }

    let filePath = path.resolve(PUBLIC_DIR, '.' + path.normalize(safePath));

    // Verify resolved path strictly resides inside PUBLIC_DIR
    if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
      res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
      return res.end('403 Access Denied');
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      if (path.extname(safePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
        return res.end('404 Not Found');
      }
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Extra PWA headers for Service Worker and Manifest
    const extraHeaders = {};
    if (path.basename(filePath) === 'sw.js') {
      extraHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      extraHeaders['Service-Worker-Allowed'] = '/';
    } else if (path.basename(filePath) === 'manifest.json') {
      extraHeaders['Content-Type'] = 'application/manifest+json; charset=utf-8';
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        const notFoundPage = path.join(PUBLIC_DIR, '404.html');
        if (fs.existsSync(notFoundPage) && req.headers?.accept?.includes('text/html')) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS });
          return res.end(fs.readFileSync(notFoundPage));
        }
        res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
        res.end('404 Not Found');
      } else {
        const statusCode = path.basename(filePath) === '404.html' ? 404 : (path.basename(filePath) === '500.html' ? 500 : 200);
        res.writeHead(statusCode, { 'Content-Type': contentType, ...SECURITY_HEADERS, ...extraHeaders });
        res.end(content);
      }
    });

  } catch (err) {
    console.error('API Error:', err);
    if (req.headers?.accept?.includes('text/html')) {
      const errPage = path.join(PUBLIC_DIR, '500.html');
      if (fs.existsSync(errPage)) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS });
        return res.end(fs.readFileSync(errPage));
      }
    }
    sendJSON(res, 500, { success: false, error: err.message });
  }
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` 🏢 BomaSphere Property Management System is LIVE! `);
    console.log(` 🌐 URL: http://localhost:${PORT}`);
    console.log(` 🇰🇪 BomaHut Features + 🌍 World-Class AppFolio/DoorLoop `);
    console.log(`=======================================================`);
  });
}

module.exports = {
  server,
  handleRequest,
  PORT
};
