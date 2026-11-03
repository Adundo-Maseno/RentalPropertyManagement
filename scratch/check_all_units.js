const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const db = new DatabaseSync(path.join(__dirname, '../bomasphere.db'));

const units = db.prepare('SELECT u.id, u.unit_number, u.status, p.name as property_name FROM units u JOIN properties p ON u.property_id = p.id').all();
console.log('Total Units in DB:', units.length);
units.forEach(u => console.log(`Unit ID ${u.id}: ${u.unit_number} (${u.property_name}) -> status: "${u.status}"`));
