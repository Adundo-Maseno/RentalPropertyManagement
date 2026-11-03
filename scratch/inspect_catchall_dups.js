const fs = require('fs');
const c = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');
const lines = c.split('\n');
console.log('--- Lines 1365-1455 ---');
for (let i = 1365; i < Math.min(lines.length, 1455); i++) {
  console.log((i+1) + ': ' + lines[i]);
}
