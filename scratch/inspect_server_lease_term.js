const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');
const idx = s.indexOf('/api/leases/');
console.log(s.substring(idx - 60, idx + 600));
