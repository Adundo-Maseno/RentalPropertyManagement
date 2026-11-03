const fs = require('fs');
const c = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');
const target = "pathname.startsWith('/api/leases/') && method === 'PUT'";
const idx = c.indexOf(target);
console.log(JSON.stringify(c.substring(idx - 10, idx + 450)));
