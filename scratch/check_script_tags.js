const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const regex = /<script[^>]*src=["']([^"']+)["'][^>]*>/g;
let m;
while ((m = regex.exec(html)) !== null) {
  console.log('Script in index.html:', m[1]);
}

