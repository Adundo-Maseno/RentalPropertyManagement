const fs = require('fs');

const serverJs = fs.readFileSync('server.js', 'utf8');
const catchallJs = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');

const expectedRoutes = [
  // Auth
  { method: 'POST', path: '/api/auth/login' },
  { method: 'GET', path: '/api/auth/me' },
  { method: 'POST', path: '/api/auth/logout' },
  // Dashboard & Stats
  { method: 'GET', path: '/api/stats' },
  // Properties
  { method: 'GET', path: '/api/properties' },
  { method: 'POST', path: '/api/properties' },
  // Units
  { method: 'GET', path: '/api/units' },
  { method: 'POST', path: '/api/units' },
  // Tenants
  { method: 'GET', path: '/api/tenants' },
  { method: 'POST', path: '/api/tenants' },
  // Leases
  { method: 'GET', path: '/api/leases' },
  { method: 'POST', path: '/api/leases' },
  // Invoices
  { method: 'GET', path: '/api/invoices' },
  { method: 'POST', path: '/api/invoices' },
  { method: 'POST', path: '/api/invoices/generate-monthly' },
  // Payments
  { method: 'GET', path: '/api/payments' },
  { method: 'POST', path: '/api/payments' },
  // Water readings
  { method: 'GET', path: '/api/water-readings' },
  { method: 'POST', path: '/api/water-readings' },
  // Maintenance
  { method: 'GET', path: '/api/maintenance' },
  { method: 'POST', path: '/api/maintenance' },
  { method: 'PUT', path: '/api/maintenance/' },
  // Communications
  { method: 'GET', path: '/api/communications' },
  { method: 'POST', path: '/api/communications/broadcast' },
  { method: 'POST', path: '/api/communications/send' },
  // Expenses
  { method: 'GET', path: '/api/expenses' },
  { method: 'POST', path: '/api/expenses' },
  // Users
  { method: 'GET', path: '/api/users' },
  { method: 'POST', path: '/api/users' },
  { method: 'DELETE', path: '/api/users/' },
  // Reports
  { method: 'GET', path: '/api/reports/landlord-statement' },
  { method: 'GET', path: '/api/reports/diaspora-roi' },
  // IoT
  { method: 'GET', path: '/api/iot/devices' },
  { method: 'GET', path: '/api/iot/leak-alerts' },
  { method: 'POST', path: '/api/iot/valve-toggle' },
  // Marketplace
  { method: 'GET', path: '/api/marketplace/fundis' },
  { method: 'GET', path: '/api/marketplace/escrows' },
  { method: 'POST', path: '/api/marketplace/escrow/release' },
  // Tenant Vetting
  { method: 'GET', path: '/api/tenant-vetting' },
  { method: 'POST', path: '/api/tenant-vetting/analyze' },
  // Tax / eTIMS
  { method: 'GET', path: '/api/tax/etims-summary' },
  { method: 'POST', path: '/api/tax/etims/generate' },
  // WhatsApp
  { method: 'POST', path: '/api/whatsapp/webhook' },
  // Public Vacancies & Viewing
  { method: 'GET', path: '/api/public/vacancies' },
  { method: 'POST', path: '/api/public/book-viewing' },
  // Digital Leases
  { method: 'GET', path: '/api/leases/agreements' },
  { method: 'POST', path: '/api/leases/agreements' },
  { method: 'POST', path: '/api/leases/agreements/' },
  // Inspections
  { method: 'GET', path: '/api/inspections' },
  { method: 'POST', path: '/api/inspections' },
  { method: 'POST', path: '/api/inspections/' },
  // Visitor Passes
  { method: 'GET', path: '/api/visitor-passes' },
  { method: 'POST', path: '/api/visitor-passes' },
  { method: 'POST', path: '/api/visitor-passes/validate' },
  // Amenities
  { method: 'GET', path: '/api/amenities' },
  { method: 'GET', path: '/api/amenity-bookings' },
  { method: 'POST', path: '/api/amenity-bookings' },
  // Reset
  { method: 'POST', path: '/api/reset-seed' }
];

console.log('Auditing', expectedRoutes.length, 'defined routes across server.js and catchall.js...\n');

let missingCount = 0;
for (const r of expectedRoutes) {
  const inServer = serverJs.includes(r.path) && serverJs.includes(r.method);
  const inCatchall = catchallJs.includes(r.path) && catchallJs.includes(r.method);

  if (!inServer || !inCatchall) {
    missingCount++;
    console.log(`❌ [MISSING] ${r.method} ${r.path} -> inServer: ${inServer}, inCatchall: ${inCatchall}`);
  }
}

if (missingCount === 0) {
  console.log('✅ ALL', expectedRoutes.length, 'routes exist in both server.js and catchall.js!');
} else {
  console.log(`\nFound ${missingCount} missing route handlers.`);
}
