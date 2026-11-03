const fs = require('fs');
const c = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');
const idx = c.indexOf('/api/communications/broadcast');
console.log(c.substring(idx - 60, idx + 500));
