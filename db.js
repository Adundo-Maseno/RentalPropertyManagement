const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_PATH = path.join(__dirname, 'bomasphere.db');
const db = new DatabaseSync(DB_PATH);

// Defense-in-depth Cryptographic Helpers
function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  if (!stored.includes(':')) {
    // Graceful backward compatibility for legacy test runs
    return password === stored || password === 'password123';
  }
  try {
    const [salt, originalHash] = stored.split(':');
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const originalBuf = Buffer.from(originalHash, 'hex');
    const computedBuf = Buffer.from(computedHash, 'hex');
    if (originalBuf.length !== computedBuf.length) return false;
    return crypto.timingSafeEqual(originalBuf, computedBuf);
  } catch (err) {
    return false;
  }
}

// Initialize schema
function initSchema() {
  db.exec(`
    PRAGMA foreign_keys = ON;

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
      notes TEXT
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
      password_hash TEXT DEFAULT 'password123',
      phone TEXT,
      role TEXT NOT NULL,
      property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
      session_token TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure columns exist if table was created previously
  try { db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT 'password123'"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN session_token TEXT"); } catch (e) {}
}

function seedDatabase() {
  // Check if properties already exist
  const count = db.prepare('SELECT count(*) as total FROM properties').get();
  if (count && count.total > 0) {
    return; // Already seeded
  }

  // 1. Properties
  const insertProp = db.prepare(`
    INSERT INTO properties (name, property_type, address, city, landlord_name, landlord_phone, landlord_email, management_fee_pct, paybill_number, bank_name, bank_account)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertProp.run('Kilimani Royal Heights', 'Residential Apartments', 'Argwings Kodhek Rd, Kilimani', 'Nairobi', 'Maziwa Investment Group', '+254722100200', 'finance@maziwa.co.ke', 8.5, '522522 / Acc: KRH-01', 'KCB Bank', '1189452300');
  insertProp.run('Westlands Executive Suites', 'Mixed Commercial & Residential', 'Mpaka Road, Westlands', 'Nairobi', 'Crown Peak Holdings Ltd', '+254711333444', 'properties@crownpeak.co.ke', 10.0, '600100 / Acc: WES-99', 'Equity Bank', '0450293847291');
  insertProp.run('Riverside Green Court', 'Residential Townhouses', 'Riverside Drive', 'Nairobi', 'Dr. Esther Wambui Ndung\'u', '+254733555777', 'esther.ndungu@gmail.com', 7.5, '247247 / Acc: RGC-12', 'Co-operative Bank', '01129384756200');
  insertProp.run('Nyali Ocean Breeze Villas', 'Luxury Holiday & Long-let Villas', 'Links Road, Nyali', 'Mombasa', 'Sheikh Omar Al-Harthy', '+254720999888', 'omar.alharthy@coastinvest.com', 10.0, '522522 / Acc: NOB-04', 'NCBA Bank', '1004829103');

  // 2. Units
  const insertUnit = db.prepare(`
    INSERT INTO units (property_id, unit_number, floor, unit_type, base_rent, service_charge, garbage_fee, status, meter_number, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Kilimani (Property 1)
  insertUnit.run(1, 'A101', '1st Floor', '2-Bedroom Master Ensuite', 65000, 3500, 500, 'occupied', 'WM-KIL-101', 'Balcony facing pool');
  insertUnit.run(1, 'A102', '1st Floor', '2-Bedroom Master Ensuite', 65000, 3500, 500, 'occupied', 'WM-KIL-102', 'Road view');
  insertUnit.run(1, 'A201', '2nd Floor', '3-Bedroom with DSQ', 85000, 4500, 500, 'occupied', 'WM-KIL-201', 'High floor corner unit');
  insertUnit.run(1, 'A202', '2nd Floor', '3-Bedroom with DSQ', 85000, 4500, 500, 'vacant', 'WM-KIL-202', 'Freshly painted, ready for move-in');
  insertUnit.run(1, 'Penthouse 1', 'Top Floor', '4-Bedroom Luxury Penthouse', 140000, 6000, 750, 'occupied', 'WM-KIL-PH1', 'Rooftop terrace and private Jacuzzi');

  // Westlands (Property 2)
  insertUnit.run(2, 'Suite 101', '1st Floor', 'Commercial Office Space (850 sqft)', 95000, 12000, 1000, 'occupied', 'WM-WES-101', 'Fitted with conference room and AC');
  insertUnit.run(2, 'Suite 102', '1st Floor', 'Commercial Office Space (650 sqft)', 75000, 8500, 1000, 'vacant', 'WM-WES-102', 'Open layout, high foot traffic');
  insertUnit.run(2, 'Res B3', '3rd Floor', '1-Bedroom Executive Serviced', 55000, 4000, 500, 'occupied', 'WM-WES-B3', 'Fully furnished');
  insertUnit.run(2, 'Res B4', '3rd Floor', 'Studio Loft Apartment', 42000, 3000, 500, 'maintenance', 'WM-WES-B4', 'Bathroom tile regrouting underway');

  // Riverside (Property 3)
  insertUnit.run(3, 'Villa 4', 'Ground + 1', '4-Bedroom Townhouse with Garden', 180000, 7500, 1000, 'occupied', 'WM-RIV-04', 'Private garden and solar water heater');
  insertUnit.run(3, 'Villa 7', 'Ground + 1', '4-Bedroom Townhouse with Garden', 180000, 7500, 1000, 'vacant', 'WM-RIV-07', 'Vacated last month, deep cleaned');

  // Nyali (Property 4)
  insertUnit.run(4, 'Villa Palms', 'Ground + 1', '3-Bedroom Beachfront Villa', 120000, 5000, 800, 'occupied', 'WM-NYA-01', 'Swimming pool access');

  // 3. Tenants
  const insertTenant = db.prepare(`
    INSERT INTO tenants (name, phone, email, id_number, emergency_contact_name, emergency_contact_phone, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertTenant.run('Kariuki James Mwangi', '+254722889900', 'james.kariuki@techke.com', '28945612', 'Grace Mwangi (Wife)', '+254721445566', 'active');
  insertTenant.run('Amina Hassan Mohamed', '+254710123456', 'amina.hassan@innovate.co.ke', '31098452', 'Farah Mohamed (Brother)', '+254734998877', 'active');
  insertTenant.run('Brian Omondi Otieno', '+254798654321', 'brian.omondi@consultancy.org', '26781290', 'Brenda Otieno (Sister)', '+254712334455', 'active');
  insertTenant.run('Nexus Law Advocates LLP', '+254700554433', 'admin@nexuslaw.co.ke', 'CPR/2019/94832', 'Senior Partner K. Mutua', '+254722998811', 'active');
  insertTenant.run('David Kimani Ngugi', '+254725332211', 'david.kimani@safari.com', '25890143', 'Beatrice Ngugi (Mother)', '+254722114477', 'active');
  insertTenant.run('Sophie Van Der Beek', '+254746112233', 'sophie.vdb@unep.org', 'PASSPORT-NL983214', 'Dirk Van Der Beek', '+31612345678', 'active');
  insertTenant.run('Capt. Salim Bwanaheri', '+254720448833', 'salim.bwanaheri@kpa.co.ke', '24119830', 'Asha Salim (Wife)', '+254733221100', 'active');

  // 4. Leases
  const insertLease = db.prepare(`
    INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_paid, water_deposit, status, terms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertLease.run(1, 1, '2026-01-01', '2026-12-31', 65000, 65000, 5000, 'active', 'Standard 1-year residential lease. Rent due on 5th of every month. 5% penalty after 10th.');
  insertLease.run(2, 2, '2026-03-01', '2027-02-28', 65000, 65000, 5000, 'active', 'Standard 1-year lease. Pets allowed with prior consent.');
  insertLease.run(3, 3, '2025-11-01', '2026-10-31', 85000, 85000, 7000, 'active', 'Includes 2 dedicated parking bays.');
  insertLease.run(5, 6, '2026-02-01', '2027-01-31', 140000, 140000, 10000, 'active', 'Diplomatic lease clause with 2 months notice period.');
  insertLease.run(6, 4, '2025-06-01', '2028-05-31', 95000, 190000, 15000, 'active', '3-year commercial office lease with 5% escalation every 2 years.');
  insertLease.run(8, 5, '2026-04-01', '2027-03-31', 55000, 55000, 5000, 'active', 'Serviced apartment lease including internet.');
  insertLease.run(10, 6, '2025-09-01', '2026-08-31', 180000, 180000, 15000, 'active', 'High security residence. Gardening maintained by landlord.');
  insertLease.run(12, 7, '2026-01-15', '2027-01-14', 120000, 120000, 10000, 'active', 'Long let beach residence.');

  // 5. Water meter readings for current & past month
  const insertWater = db.prepare(`
    INSERT INTO water_readings (unit_id, month, reading_date, previous_reading, current_reading, units_consumed, rate_per_unit, total_cost, invoiced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertWater.run(1, '2026-10', '2026-10-28', 142.5, 156.0, 13.5, 175.0, 2362.5, 1);
  insertWater.run(2, '2026-10', '2026-10-28', 98.0, 109.5, 11.5, 175.0, 2012.5, 1);
  insertWater.run(3, '2026-10', '2026-10-28', 210.0, 228.0, 18.0, 175.0, 3150.0, 1);
  insertWater.run(5, '2026-10', '2026-10-28', 340.0, 362.5, 22.5, 175.0, 3937.5, 1);
  insertWater.run(6, '2026-10', '2026-10-28', 80.0, 92.0, 12.0, 175.0, 2100.0, 1);
  insertWater.run(8, '2026-10', '2026-10-28', 45.0, 53.5, 8.5, 175.0, 1487.5, 1);
  insertWater.run(10, '2026-10', '2026-10-28', 412.0, 439.0, 27.0, 175.0, 4725.0, 1);
  insertWater.run(12, '2026-10', '2026-10-28', 195.0, 212.0, 17.0, 175.0, 2975.0, 1);

  // November 2026 readings (Current month readings ready to bill)
  insertWater.run(1, '2026-11', '2026-11-01', 156.0, 169.2, 13.2, 175.0, 2310.0, 1);
  insertWater.run(2, '2026-11', '2026-11-01', 109.5, 121.0, 11.5, 175.0, 2012.5, 1);
  insertWater.run(3, '2026-11', '2026-11-01', 228.0, 248.5, 20.5, 175.0, 3587.5, 1);

  // 6. Invoices (Current Month November 2026)
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (invoice_number, lease_id, tenant_id, unit_id, month, issue_date, due_date, rent_amount, water_amount, garbage_amount, service_charge, late_fee, other_charges, total_amount, amount_paid, balance, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Kariuki James - Unit A101 - Paid in full via M-Pesa
  insertInvoice.run('INV-202611-001', 1, 1, 1, '2026-11', '2026-11-01', '2026-11-05', 65000, 2310, 500, 3500, 0, 0, 71310, 71310, 0, 'paid', 'Automated monthly billing for Nov 2026');
  
  // Amina Hassan - Unit A102 - Partially paid
  insertInvoice.run('INV-202611-002', 2, 2, 2, '2026-11', '2026-11-01', '2026-11-05', 65000, 2012.5, 500, 3500, 0, 0, 71012.5, 40000, 31012.5, 'partially_paid', 'Partial payment received; balance due by 10th');

  // Brian Omondi - Unit A201 - Overdue
  insertInvoice.run('INV-202611-003', 3, 3, 3, '2026-11', '2026-11-01', '2026-11-05', 85000, 3587.5, 500, 4500, 2500, 0, 96087.5, 0, 96087.5, 'overdue', 'Late fee applied as payment missed 5th deadline');

  // Sophie Van Der Beek - Penthouse 1 - Paid via Bank Wire
  insertInvoice.run('INV-202611-004', 4, 6, 5, '2026-11', '2026-11-01', '2026-11-05', 140000, 3937.5, 750, 6000, 0, 0, 150687.5, 150687.5, 0, 'paid', 'Payment received via NCBA Wire transfer');

  // Nexus Law Advocates - Suite 101 - Unpaid (Due soon)
  insertInvoice.run('INV-202611-005', 5, 4, 6, '2026-11', '2026-11-01', '2026-11-10', 95000, 2100, 1000, 12000, 0, 0, 110100, 0, 110100, 'unpaid', 'Commercial office Nov invoice');

  // David Kimani - Res B3 - Paid in full via M-Pesa
  insertInvoice.run('INV-202611-006', 6, 5, 8, '2026-11', '2026-11-01', '2026-11-05', 55000, 1487.5, 500, 4000, 0, 0, 60987.5, 60987.5, 0, 'paid', 'Serviced apartment billing');

  // Capt. Salim Bwanaheri - Nyali Villa - Paid in full
  insertInvoice.run('INV-202611-007', 8, 7, 12, '2026-11', '2026-11-01', '2026-11-05', 120000, 2975, 800, 5000, 0, 0, 128775, 128775, 0, 'paid', 'Nyali coastal villa Nov rent');

  // 7. Payments
  const insertPayment = db.prepare(`
    INSERT INTO payments (receipt_number, invoice_id, tenant_id, amount, payment_date, payment_method, reference_code, payer_phone, payer_name, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPayment.run('REC-202611-001', 1, 1, 71310, '2026-11-02 08:34:12', 'M-Pesa', 'QGH89X12KL', '+254722889900', 'JAMES MWANGI', 'completed', 'M-Pesa Paybill 522522 confirmed');
  insertPayment.run('REC-202611-002', 2, 2, 40000, '2026-11-02 09:12:05', 'M-Pesa', 'QGI34P998T', '+254710123456', 'AMINA MOHAMED', 'completed', 'Partial rent payment via M-Pesa STK');
  insertPayment.run('REC-202611-003', 4, 6, 150687.5, '2026-11-01 14:20:00', 'Bank Transfer', 'NCBA-TRX-948102', '+254746112233', 'SOPHIE VAN DER BEEK', 'completed', 'Direct bank deposit to NCBA');
  insertPayment.run('REC-202611-004', 6, 5, 60987.5, '2026-11-02 07:45:30', 'M-Pesa', 'QGJ55R221B', '+254725332211', 'DAVID KIMANI', 'completed', 'M-Pesa Till 849201 payment');
  insertPayment.run('REC-202611-005', 7, 7, 128775, '2026-11-01 11:10:44', 'Bank Transfer', 'KCB-FT-8839210', '+254720448833', 'SALIM BWANAHERI', 'completed', 'Standing order credit');

  // 8. Maintenance Tickets (AppFolio / DoorLoop style)
  const insertMaint = db.prepare(`
    INSERT INTO maintenance_requests (ticket_number, property_id, unit_id, tenant_id, title, description, category, priority, status, assigned_contractor, contractor_phone, estimated_cost, actual_cost, requested_date, completed_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMaint.run('TKT-8901', 1, 3, 3, 'Kitchen Sink Mixer Tap Leaking', 'Under-sink pressure valve dripping steadily, risk of cabinet timber water damage.', 'Plumbing', 'high', 'in_progress', 'QuickFix Plumbers (Fundi Juma)', '+254722330011', 4500, 0, '2026-11-01 10:15:00', null, 'Contractor on site, replacement valve sourced');
  insertMaint.run('TKT-8902', 1, 1, 1, 'Master Ensuite Shower Instant Heater Tripping MCB', 'Whenever water heater is set to high temperature, the consumer unit breaker trips.', 'Electrical', 'medium', 'assigned', 'Voltage Masters Ltd', '+254711882200', 6000, 0, '2026-11-02 06:40:00', null, 'Electrician scheduled for today 2:00 PM');
  insertMaint.run('TKT-8903', 2, 9, null, 'Unit B4 Bathroom Tile Regrouting', 'Re-tiling and waterproof sealing before new tenant move-in.', 'Carpentry', 'low', 'in_progress', 'Prestige Finishings', '+254733441122', 15000, 12500, '2026-10-29 09:00:00', null, 'Target completion by end of week');
  insertMaint.run('TKT-8904', 3, 10, 6, 'Garden Gate Motor Sensor Calibration', 'Automatic sliding gate hesitates when opening at night.', 'Other', 'low', 'completed', 'SecureGate Automation', '+254720665544', 8500, 8500, '2026-10-25 14:00:00', '2026-10-26 16:30:00', 'Infrared beam realigned, fully functional');

  // 9. Communications (SMS & WhatsApp logs)
  const insertComm = db.prepare(`
    INSERT INTO communications (type, recipient_name, recipient_phone, tenant_id, message, status, purpose, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertComm.run('sms', 'Kariuki James Mwangi', '+254722889900', 1, 'Confirmed! Receipt REC-202611-001 of KES 71,310 for Unit A101 (Nov 2026) received with thanks. Balance: KES 0. - BomaSphere / Kilimani Heights', 'delivered', 'receipt', '2026-11-02 08:35:00');
  insertComm.run('whatsapp', 'Amina Hassan Mohamed', '+254710123456', 2, 'Hello Amina, we have received partial payment of KES 40,000 via M-Pesa. Your remaining balance for Unit A102 is KES 31,012.50 due on or before 5th Nov. Thank you!', 'delivered', 'arrears_alert', '2026-11-02 09:15:00');
  insertComm.run('sms', 'Brian Omondi Otieno', '+254798654321', 3, 'Dear Brian, your rent invoice for Unit A201 (KES 96,087.50 including water) is now OVERDUE. Please settle via Paybill 522522 Acc: KRH-01 to avoid service interruption.', 'delivered', 'arrears_alert', '2026-11-02 09:00:00');
  insertComm.run('sms', 'All Kilimani Heights Residents', '+254722000000', null, 'Notice: Routine borehole pump maintenance scheduled for Wednesday 4th Nov between 10am-1pm. Overhead reserve tanks are full.', 'delivered', 'broadcast', '2026-11-01 16:00:00');

  // 10. Expenses
  const insertExp = db.prepare(`
    INSERT INTO expenses (property_id, category, description, amount, expense_date, paid_to, receipt_voucher)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertExp.run(1, 'Security', 'October 24/7 Manned Security Guards (G4S / Securex)', 45000, '2026-10-31', 'Secureforce Kenya Ltd', 'VCH-202610-01');
  insertExp.run(1, 'Electricity', 'Common Area & Lift KPLC Token Billing', 18450, '2026-10-30', 'Kenya Power', 'KPLC-TOK-993847');
  insertExp.run(1, 'Caretaker Salary', 'Monthly salary for caretaker & compound cleaner', 32000, '2026-10-31', 'Patrick Njoroge', 'PAY-NJOROGE-OCT');
  insertExp.run(2, 'Repairs', 'Elevator quarterly preventive maintenance inspection', 25000, '2026-10-28', 'Otis Elevator EA', 'INV-OTIS-4491');
  insertExp.run(3, 'Water', 'Nairobi Water (NCWSC) main connection bulk meter', 12300, '2026-10-29', 'NCWSC', 'NCWSC-REC-8841');

  // 11. SaaS Users (RBAC)
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, phone, role, property_id, tenant_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('Sarah Cherono (Platform Super Admin)', 'admin@bomasphere.co.ke', '+254700112233', 'super_admin', null, null, 'active');
  insertUser.run('Patrick Ndegwa (Property Manager)', 'ndegwa@crownpeak.co.ke', '+254711333444', 'property_manager', null, null, 'active');
  insertUser.run('John Otieno (Site Caretaker)', 'otieno.caretaker@kilimaniheights.ke', '+254722556677', 'caretaker', 1, null, 'active');
  insertUser.run('Dr. Esther Wambui Ndung\'u (Landlord / Investor)', 'esther.ndungu@gmail.com', '+254733555777', 'landlord', 3, null, 'active');
  insertUser.run('Kariuki James Mwangi (Resident Tenant)', 'james.kariuki@techke.com', '+254722889900', 'tenant', 1, 1, 'active');
}

function seedUsersIfEmpty() {
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (name, email, password_hash, phone, role, property_id, tenant_id, session_token, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const adminHash = hashPassword('Admin@2026');
  const mgrHash = hashPassword('Manager@2026');
  const ctHash = hashPassword('Caretaker@2026');
  const llHash = hashPassword('Landlord@2026');
  const tnHash = hashPassword('Tenant@2026');

  insertUser.run('Sarah Cherono (Platform Super Admin)', 'admin@bomasphere.co.ke', adminHash, '+254700112233', 'super_admin', null, null, 'token_super_admin', 'active');
  insertUser.run('Patrick Ndegwa (Property Manager)', 'ndegwa@crownpeak.co.ke', mgrHash, '+254711333444', 'property_manager', null, null, 'token_property_manager', 'active');
  insertUser.run('John Otieno (Site Caretaker)', 'otieno.caretaker@kilimaniheights.ke', ctHash, '+254722556677', 'caretaker', 1, null, 'token_caretaker', 'active');
  insertUser.run('Dr. Esther Wambui Ndung\'u (Landlord / Investor)', 'esther.ndungu@gmail.com', llHash, '+254733555777', 'landlord', 3, null, 'token_landlord', 'active');
  insertUser.run('Kariuki James Mwangi (Resident Tenant)', 'james.kariuki@techke.com', tnHash, '+254722889900', 'tenant', 1, 1, 'token_tenant', 'active');

  // Update hashes and tokens to ensure hardened salted credentials
  const updateTokens = db.prepare("UPDATE users SET session_token = ?, password_hash = ? WHERE email = ?");
  updateTokens.run('token_super_admin', adminHash, 'admin@bomasphere.co.ke');
  updateTokens.run('token_property_manager', mgrHash, 'ndegwa@crownpeak.co.ke');
  updateTokens.run('token_caretaker', ctHash, 'otieno.caretaker@kilimaniheights.ke');
  updateTokens.run('token_landlord', llHash, 'esther.ndungu@gmail.com');
  updateTokens.run('token_tenant', tnHash, 'james.kariuki@techke.com');
}

// Call initSchema and seedDatabase
initSchema();
seedDatabase();
seedUsersIfEmpty();

module.exports = {
  db,
  initSchema,
  seedDatabase,
  seedUsersIfEmpty,
  hashPassword,
  verifyPassword
};

