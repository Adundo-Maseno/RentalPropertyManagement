const fs = require('fs');
const c = fs.readFileSync('functions/api/[[catchall]].js', 'utf8');

const regex = /\|\|\s*DB\.[a-zA-Z0-9_]+\[0\]/g;
let m;
while ((m = regex.exec(c)) !== null) {
  const lineNum = c.substring(0, m.index).split('\n').length;
  console.log(`Line ${lineNum}: ${c.substring(m.index - 50, m.index + 40).replace(/\r?\n/g, ' ')}`);
}
