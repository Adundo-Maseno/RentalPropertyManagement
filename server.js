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
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'",
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
  const rand = crypto.randomInt(1000, 10000);
  return `REC-${dateStr}-${rand}`;
}

function generateInvoiceNumber(monthStr) {
  const mClean = (monthStr || new Date().toISOString().slice(0, 7)).replace(/-/g, '');
  const rand = crypto.randomInt(100, 1000);
  return `INV-${mClean}-${rand}`;
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

function generateSecureToken(prefix = 'bs_sess') {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
}

// ==========================================
// REAL RBAC AUTHENTICATION & SESSION GUARDS
// ==========================================
function getAuthUser(req) {
  const authHeader = req.headers['authorization'] || '';
  const tokenHeader = req.headers['x-auth-token'] || '';
  let token = tokenHeader;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) return null;
  return db.prepare("SELECT * FROM users WHERE session_token = ? AND status = 'active'").get(token) || null;
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
      const clientIp = req.socket.remoteAddress || '127.0.0.1';
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
      const stmt = db.prepare(`
        INSERT INTO properties (name, property_type, address, city, landlord_name, landlord_phone, landlord_email, management_fee_pct, paybill_number, bank_name, bank_account)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        b.name, b.property_type || 'Residential Multi-Family', b.address || '', b.city || 'Nairobi',
        b.landlord_name || '', b.landlord_phone || '', b.landlord_email || '',
        b.management_fee_pct || 10.0, b.paybill_number || '', b.bank_name || '', b.bank_account || ''
      );
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
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
      const stmt = db.prepare(`
        INSERT INTO units (property_id, unit_number, floor, unit_type, base_rent, service_charge, garbage_fee, status, meter_number, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        b.property_id, b.unit_number, b.floor || 'Ground', b.unit_type || '1-Bedroom',
        b.base_rent, b.service_charge || 0, b.garbage_fee || 0,
        b.status || 'vacant', b.meter_number || '', b.notes || ''
      );
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
    }

    if (pathname.startsWith('/api/units/') && method === 'PUT') {
      const unitId = pathname.split('/')[3];
      const b = await parseBody(req);
      const stmt = db.prepare(`
        UPDATE units SET 
          unit_number = COALESCE(?, unit_number),
          unit_type = COALESCE(?, unit_type),
          base_rent = COALESCE(?, base_rent),
          service_charge = COALESCE(?, service_charge),
          garbage_fee = COALESCE(?, garbage_fee),
          status = COALESCE(?, status),
          meter_number = COALESCE(?, meter_number),
          notes = COALESCE(?, notes)
        WHERE id = ?
      `);
      stmt.run(b.unit_number, b.unit_type, b.base_rent, b.service_charge, b.garbage_fee, b.status, b.meter_number, b.notes, unitId);
      return sendJSON(res, 200, { success: true });
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
        b.name, b.phone, b.email || '', b.id_number || '',
        b.emergency_contact_name || '', b.emergency_contact_phone || '', b.status || 'active'
      );
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
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
      const b = await parseBody(req);
      const insertLease = db.prepare(`
        INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_paid, water_deposit, status, terms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = insertLease.run(
        b.unit_id, b.tenant_id, b.start_date, b.end_date,
        b.monthly_rent, b.deposit_paid || b.monthly_rent, b.water_deposit || 5000,
        'active', b.terms || 'Standard residential lease agreement'
      );

      // Mark unit as occupied
      db.prepare("UPDATE units SET status = 'occupied' WHERE id = ?").run(b.unit_id);

      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid });
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
      const rent = Number(b.rent_amount || 0);
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
        invNum, b.lease_id, b.tenant_id, b.unit_id, b.month,
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

      // Insert payment record
      const insertPayment = db.prepare(`
        INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
      `);
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

          db.prepare(`
            UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?
          `).run(newPaid, newBalance, newStatus, inv.id);

          updatedInvoice = { id: inv.id, balance: newBalance, status: newStatus };
        }
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
        b.unit_id, b.month || new Date().toISOString().slice(0, 7),
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
      const stmt = db.prepare(`
        INSERT INTO maintenance_requests (
          ticket_number, property_id, unit_id, tenant_id, title, description,
          category, priority, status, assigned_contractor, contractor_phone,
          estimated_cost, actual_cost, requested_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, ?)
      `);
      const info = stmt.run(
        ticketNum, b.property_id, b.unit_id, b.tenant_id || null,
        b.title, b.description, b.category || 'General', b.priority || 'medium',
        b.status || 'open', b.assigned_contractor || '', b.contractor_phone || '',
        b.estimated_cost || 0, b.notes || ''
      );
      return sendJSON(res, 201, { success: true, id: info.lastInsertRowid, ticket_number: ticketNum });
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
      stmt.run(b.status, b.assigned_contractor, b.contractor_phone, b.estimated_cost, b.actual_cost, completedDate, b.notes, ticketId);
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

      return sendJSON(res, 200, { success: true, count, recipients_reached: count });
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
        b.property_id, b.category || 'Repairs', b.description, Number(b.amount),
        b.expense_date || new Date().toISOString().slice(0, 10),
        b.paid_to || '', b.receipt_voucher || `VCH-${crypto.randomInt(1000, 10000)}`
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
      stmt.run(b.name, b.email, b.phone, b.role, b.property_id, b.status, userId);
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
        res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
        res.end('404 Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType, ...SECURITY_HEADERS, ...extraHeaders });
        res.end(content);
      }
    });

  } catch (err) {
    console.error('API Error:', err);
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
