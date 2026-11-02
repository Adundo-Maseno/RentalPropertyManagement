const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');

// Create dist directory and copy all public assets for standard CI/CD presets
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

fs.cpSync(srcDir, distDir, { recursive: true });
console.log('✅ BomaSphere PMS build complete: synced public/ assets to dist/');

