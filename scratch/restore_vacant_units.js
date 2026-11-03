const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const db = new DatabaseSync(path.join(__dirname, '../bomasphere.db'));

// Terminate test leases 9, 13, 20
db.prepare("UPDATE leases SET status = 'terminated' WHERE id IN (9, 13, 20)").run();
// Mark Units 4, 7, 11 as vacant
db.prepare("UPDATE units SET status = 'vacant' WHERE id IN (4, 7, 11)").run();

console.log('Vacant units restored:');
const vacant = db.prepare("SELECT u.id, u.unit_number, u.status, p.name FROM units u JOIN properties p ON u.property_id = p.id WHERE u.status = 'vacant'").all();
console.log(vacant);

