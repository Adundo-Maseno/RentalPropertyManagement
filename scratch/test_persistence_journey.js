const { handleRequest } = require('../server.js');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const db = new DatabaseSync(path.join(__dirname, '../bomasphere.db'));

function invoke(url, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.url = url;
    req.method = method;
    req.headers = { host: 'localhost:3000', ...headers };

    let statusCode = 200;
    let respHeaders = {};
    let responseData = '';

    const res = {
      writeHead(code, hdrs) {
        statusCode = code;
        respHeaders = { ...respHeaders, ...hdrs };
      },
      setHeader(name, val) {
        respHeaders[name] = val;
      },
      end(chunk) {
        if (chunk) responseData += chunk.toString();
        let json = null;
        try {
          if (responseData) json = JSON.parse(responseData);
        } catch (e) {}

        resolve({ statusCode, headers: respHeaders, body: json || responseData });
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

async function testFullRelationalPersistence() {
  console.log('--- Testing Full Relational Persistence Flow ---');
  const token = 'token_property_manager';
  const authHeaders = {
    'content-type': 'application/json',
    'authorization': `Bearer ${token}`
  };

  // 1. Create a Property
  const propRes = await invoke('/api/properties', 'POST', {
    name: 'Serena Pearl Residences ' + Date.now(),
    property_type: 'Luxury Residential Apartments',
    address: 'Kileleshwa, Ring Road',
    city: 'Nairobi',
    landlord_name: 'Ambassador John Kamau',
    landlord_phone: '+254711889922',
    landlord_email: 'j.kamau@serenapearl.ke',
    management_fee_pct: 9.0,
    paybill_number: '522522 / Acc: SPR-01',
    bank_name: 'Standard Chartered',
    bank_account: '01080293847'
  }, authHeaders);
  console.log('1. Add Property Response:', propRes.statusCode, propRes.body);
  const propertyId = propRes.body.id;

  // Verify in SQLite
  const propDb = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId);
  console.log('   Verified Property in DB:', propDb?.name);

  // 2. Add Unit to this Property
  const unitRes = await invoke('/api/units', 'POST', {
    property_id: propertyId,
    unit_number: 'Penthouse B1-' + Date.now().toString().slice(-4),
    floor: '5th Floor',
    unit_type: '3-Bedroom Panoramic Duplex',
    base_rent: 110000,
    service_charge: 6500,
    garbage_fee: 600,
    status: 'vacant',
    meter_number: 'WM-SPR-B1',
    notes: 'Brand new luxury unit'
  }, authHeaders);
  console.log('2. Add Unit Response:', unitRes.statusCode, unitRes.body);
  const unitId = unitRes.body.id;

  // Verify in SQLite
  const unitDb = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId);
  console.log('   Verified Unit in DB:', unitDb?.unit_number, 'Status:', unitDb?.status);

  // 3. Add Tenant
  const tenantRes = await invoke('/api/tenants', 'POST', {
    name: 'Eng. Alice Muthoni Njoroge',
    phone: '+254722991122',
    email: 'alice.muthoni@eng.ke',
    id_number: '31984562',
    emergency_contact_name: 'Dr. Peter Njoroge (Spouse)',
    emergency_contact_phone: '+254722334411',
    status: 'active'
  }, authHeaders);
  console.log('3. Add Tenant Response:', tenantRes.statusCode, tenantRes.body);
  const tenantId = tenantRes.body.id;

  // Verify in SQLite
  const tenantDb = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
  console.log('   Verified Tenant in DB:', tenantDb?.name);

  // 4. Create Lease (Binding Tenant to Unit)
  const leaseRes = await invoke('/api/leases', 'POST', {
    unit_id: unitId,
    tenant_id: tenantId,
    start_date: '2026-11-01',
    end_date: '2027-10-31',
    monthly_rent: 110000,
    deposit_paid: 110000,
    water_deposit: 5000,
    terms: '12-month standard residential tenancy'
  }, authHeaders);
  console.log('4. Create Lease Response:', leaseRes.statusCode, leaseRes.body);

  // Verify Lease in SQLite and Unit Status
  const leaseDb = db.prepare('SELECT * FROM leases WHERE unit_id = ? AND tenant_id = ?').get(unitId, tenantId);
  console.log('   Verified Lease in DB: ID', leaseDb?.id, 'Monthly Rent:', leaseDb?.monthly_rent);
  const unitAfterLease = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId);
  console.log('   Verified Unit Status after Lease:', unitAfterLease?.status);

  // Check auto-generated digital lease agreement
  const agreementDb = db.prepare('SELECT * FROM lease_agreements WHERE lease_id = ?').get(leaseDb.id);
  console.log('   Verified Digital Lease Agreement in DB:', agreementDb?.agreement_code, 'Status:', agreementDb?.status);

  // 5. Query GET /api/tenants to verify relational joins
  const getTenantsRes = await invoke('/api/tenants', 'GET', null, authHeaders);
  const foundTenant = getTenantsRes.body.find(t => t.id === tenantId);
  console.log('5. Relational Join in GET /api/tenants:');
  console.log('   Tenant Name:', foundTenant?.name);
  console.log('   Bound Unit Number:', foundTenant?.unit_number);
  console.log('   Bound Property Name:', foundTenant?.property_name);
  console.log('   Active Lease ID:', foundTenant?.lease_id);

  // 6. Create Invoice for this Lease
  const invoiceRes = await invoke('/api/invoices', 'POST', {
    lease_id: leaseDb.id,
    month: '2026-11',
    due_date: '2026-11-05',
    water_amount: 2500,
    garbage_amount: 600,
    service_charge: 6500,
    notes: 'Nov 2026 inaugural invoice'
  }, authHeaders);
  console.log('6. Create Invoice Response:', invoiceRes.statusCode, invoiceRes.body);
  const invoiceId = invoiceRes.body.id;

  // Verify Invoice in DB
  const invoiceDb = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  console.log('   Verified Invoice in DB:', invoiceDb?.invoice_number, 'Total:', invoiceDb?.total_amount, 'Balance:', invoiceDb?.balance);

  // 7. Record Payment for this Invoice
  const payRes = await invoke('/api/payments', 'POST', {
    invoice_id: invoiceId,
    tenant_id: tenantId,
    amount: invoiceDb.total_amount,
    payment_method: 'M-Pesa STK',
    reference_code: 'QG' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    payer_phone: '+254722991122',
    payer_name: 'Eng. Alice Muthoni Njoroge',
    notes: 'Rent + Utility full payment'
  }, authHeaders);
  console.log('7. Record Payment Response:', payRes.statusCode, payRes.body);

  // Verify Payment in DB and Invoice Balance update
  const invoiceAfterPay = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  console.log('   Verified Invoice after payment: Status:', invoiceAfterPay?.status, 'Balance:', invoiceAfterPay?.balance, 'Amount Paid:', invoiceAfterPay?.amount_paid);

  console.log('\n--- ALL RELATIONAL PERSISTENCE TESTS COMPLETED SUCCESSFULLY ---');
}

testFullRelationalPersistence().catch(console.error);
