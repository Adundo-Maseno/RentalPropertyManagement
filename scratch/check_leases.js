const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const db = new DatabaseSync(path.join(__dirname, '../bomasphere.db'));

const leases = db.prepare('SELECT l.id, l.unit_id, l.tenant_id, l.status, u.unit_number, t.name as tenant_name FROM leases l JOIN units u ON l.unit_id = u.id JOIN tenants t ON l.tenant_id = t.id').all();
console.log('Total Leases in DB:', leases.length);
leases.forEach(l => console.log(`Lease ${l.id}: Unit ${l.unit_number} (Unit ID ${l.unit_id}) -> Tenant ${l.tenant_name} (Status: ${l.status})`));

