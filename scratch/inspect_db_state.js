const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const db = new DatabaseSync(path.join(__dirname, '../bomasphere.db'));

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
console.log('--- ALL TABLES IN BOMASPHERE.DB ---');
tables.forEach(t => {
  const count = db.prepare(`SELECT count(*) as c FROM "${t.name}"`).get().c;
  console.log(`${t.name.padEnd(25)} : ${count} rows`);
});

