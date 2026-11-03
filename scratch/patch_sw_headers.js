const fs = require('fs');

let sw = fs.readFileSync('public/sw.js', 'utf8');
sw = sw.replace("const CACHE_NAME = 'bomasphere-cache-v2.8';", "const CACHE_NAME = 'bomasphere-cache-v3.1';");
sw = sw.replace("'/app.js?v=2.8',", "'/app.js?v=3.1',");
fs.writeFileSync('public/sw.js', sw, 'utf8');
console.log('Updated public/sw.js');

let headers = fs.readFileSync('public/_headers', 'utf8');
const oldH = `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'`;
const newH = `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://cdn.tailwindcss.com`;

if (headers.includes(oldH)) {
  headers = headers.replace(oldH, newH);
  fs.writeFileSync('public/_headers', headers, 'utf8');
  console.log('Updated public/_headers');
}
