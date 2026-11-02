const https = require('https');

const routes = [
  "/api/stats",
  "/api/properties",
  "/api/units",
  "/api/tenants",
  "/api/invoices",
  "/api/payments",
  "/api/water-readings",
  "/api/maintenance",
  "/api/communications",
  "/api/expenses",
  "/api/users",
  "/api/leases/agreements",
  "/api/inspections",
  "/api/visitor-passes",
  "/api/amenities",
  "/api/amenity-bookings",
  "/api/reports/diaspora-roi",
  "/api/reports/landlord-statement?property_id=1&month=2026-11",
  "/api/iot/devices",
  "/api/iot/leak-alerts",
  "/api/marketplace/fundis",
  "/api/marketplace/escrows",
  "/api/tenant-vetting",
  "/api/public/vacancies"
];

async function check() {
  for (const r of routes) {
    await new Promise((resolve) => {
      https.get("https://rentalpropertymanagement.pages.dev" + r, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          console.log(`${res.statusCode} -> ${r} (len: ${data.length})`);
          if (res.statusCode !== 200) {
            console.log(`   Response: ${data.substring(0, 100)}`);
          }
          resolve();
        });
      }).on("error", (e) => {
        console.error(`ERR -> ${r}: ${e.message}`);
        resolve();
      });
    });
  }
}

check();

