const fs = require('fs');
const c = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');
const idx = c.indexOf('corsHeaders');
console.log(c.substring(idx - 20, idx + 400));
