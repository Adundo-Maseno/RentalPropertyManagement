const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');
const idx = s.indexOf('isEscrowRelease');
console.log(s.substring(idx - 100, idx + 800));
