const fs = require('fs');
const c = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');
const idx = c.indexOf('// 18. Digital Lease Agreements & E-Signatures');
console.log(c.substring(idx, idx + 800));
