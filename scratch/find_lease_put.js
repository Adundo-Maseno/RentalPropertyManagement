const fs = require('fs');
const c = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');
const target = "pathname.startsWith('/api/leases/')";
let idx = 0;
while ((idx = c.indexOf(target, idx)) !== -1) {
  console.log(c.substring(idx - 10, idx + 400));
  idx += 30;
}
