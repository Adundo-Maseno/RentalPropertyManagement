/**
 * Cloudflare Pages Functions - Full Edge API Router for BomaSphere PMS
 * Implements full RESTful API for BomaSphere Property Management System at the Global Edge
 */

// Edge In-Memory Database
const DB = {
  properties: [
    { id: 1, name: "Kilimani Royal Heights", property_type: "Residential Apartments", address: "Argwings Kodhek Rd, Kilimani", city: "Nairobi", landlord_name: "Maziwa Investment Group", landlord_phone: "+254722100200", landlord_email: "finance@maziwa.co.ke", management_fee_pct: 8.5, paybill_number: "522522 / Acc: KRH-01", bank_name: "KCB Bank", bank_account: "1189452300" },
    { id: 2, name: "Westlands Executive Suites", property_type: "Mixed Commercial & Residential", address: "Mpaka Road, Westlands", city: "Nairobi", landlord_name: "Crown Peak Holdings Ltd", landlord_phone: "+254711333444", landlord_email: "properties@crownpeak.co.ke", management_fee_pct: 10.0, paybill_number: "600100 / Acc: WES-99", bank_name: "Equity Bank", bank_account: "0450293847291" },
    { id: 3, name: "Riverside Green Court", property_type: "Residential Townhouses", address: "Riverside Drive", city: "Nairobi", landlord_name: "Dr. Esther Wambui Ndung'u", landlord_phone: "+254733555777", landlord_email: "esther.ndungu@gmail.com", management_fee_pct: 7.5, paybill_number: "247247 / Acc: RGC-12", bank_name: "Co-operative Bank", bank_account: "01129384756200" },
    { id: 4, name: "Nyali Ocean Breeze Villas", property_type: "Luxury Holiday & Long-let Villas", address: "Links Road, Nyali", city: "Mombasa", landlord_name: "Sheikh Omar Al-Harthy", landlord_phone: "+254720999888", landlord_email: "omar.alharthy@coastinvest.com", management_fee_pct: 10.0, paybill_number: "522522 / Acc: NOB-04", bank_name: "NCBA Bank", bank_account: "1004829103" }
  ],

  units: [
    { id: 1, property_id: 1, unit_number: "A101", floor: "1st Floor", unit_type: "2-Bedroom Master Ensuite", base_rent: 65000, service_charge: 3500, garbage_fee: 500, status: "occupied", meter_number: "WM-KIL-101", property_name: "Kilimani Royal Heights" },
    { id: 2, property_id: 1, unit_number: "A102", floor: "1st Floor", unit_type: "2-Bedroom Master Ensuite", base_rent: 65000, service_charge: 3500, garbage_fee: 500, status: "occupied", meter_number: "WM-KIL-102", property_name: "Kilimani Royal Heights" },
    { id: 3, property_id: 1, unit_number: "A201", floor: "2nd Floor", unit_type: "3-Bedroom with DSQ", base_rent: 85000, service_charge: 4500, garbage_fee: 500, status: "occupied", meter_number: "WM-KIL-201", property_name: "Kilimani Royal Heights" },
    { id: 4, property_id: 1, unit_number: "A202", floor: "2nd Floor", unit_type: "3-Bedroom with DSQ", base_rent: 85000, service_charge: 4500, garbage_fee: 500, status: "vacant", meter_number: "WM-KIL-202", property_name: "Kilimani Royal Heights" },
    { id: 5, property_id: 1, unit_number: "Penthouse 1", floor: "Top Floor", unit_type: "4-Bedroom Luxury Penthouse", base_rent: 140000, service_charge: 6000, garbage_fee: 750, status: "occupied", meter_number: "WM-KIL-PH1", property_name: "Kilimani Royal Heights" },
    { id: 6, property_id: 2, unit_number: "Suite 101", floor: "1st Floor", unit_type: "Commercial Office Space (850 sqft)", base_rent: 95000, service_charge: 12000, garbage_fee: 1000, status: "occupied", meter_number: "WM-WES-101", property_name: "Westlands Executive Suites" },
    { id: 7, property_id: 2, unit_number: "Suite 102", floor: "1st Floor", unit_type: "Commercial Office Space (650 sqft)", base_rent: 75000, service_charge: 8500, garbage_fee: 1000, status: "vacant", meter_number: "WM-WES-102", property_name: "Westlands Executive Suites" },
    { id: 8, property_id: 2, unit_number: "Res B3", floor: "3rd Floor", unit_type: "1-Bedroom Executive Serviced", base_rent: 55000, service_charge: 4000, garbage_fee: 500, status: "occupied", meter_number: "WM-WES-B3", property_name: "Westlands Executive Suites" },
    { id: 9, property_id: 2, unit_number: "Res B4", floor: "3rd Floor", unit_type: "Studio Loft Apartment", base_rent: 42000, service_charge: 3000, garbage_fee: 500, status: "maintenance", meter_number: "WM-WES-B4", property_name: "Westlands Executive Suites" },
    { id: 10, property_id: 3, unit_number: "Villa 4", floor: "Ground + 1", unit_type: "4-Bedroom Townhouse with Garden", base_rent: 180000, service_charge: 7500, garbage_fee: 1000, status: "occupied", meter_number: "WM-RIV-04", property_name: "Riverside Green Court" },
    { id: 11, property_id: 3, unit_number: "Villa 7", floor: "Ground + 1", unit_type: "4-Bedroom Townhouse with Garden", base_rent: 180000, service_charge: 7500, garbage_fee: 1000, status: "vacant", meter_number: "WM-RIV-07", property_name: "Riverside Green Court" },
    { id: 12, property_id: 4, unit_number: "Villa Palms", floor: "Ground + 1", unit_type: "3-Bedroom Beachfront Villa", base_rent: 120000, service_charge: 5000, garbage_fee: 800, status: "occupied", meter_number: "WM-NYA-01", property_name: "Nyali Ocean Breeze Villas" }
  ],

  tenants: [
    { id: 1, name: "Kariuki James Mwangi", phone: "+254722889900", email: "james.kariuki@techke.com", id_number: "28945612", emergency_contact_name: "Grace Mwangi (Wife)", emergency_contact_phone: "+254721445566", status: "active", unit_id: 1, unit_number: "A101", property_name: "Kilimani Royal Heights", balance: 0 },
    { id: 2, name: "Amina Hassan Mohamed", phone: "+254710123456", email: "amina.hassan@innovate.co.ke", id_number: "31098452", emergency_contact_name: "Farah Mohamed (Brother)", emergency_contact_phone: "+254734998877", status: "active", unit_id: 2, unit_number: "A102", property_name: "Kilimani Royal Heights", balance: 31012.5 },
    { id: 3, name: "Brian Omondi Otieno", phone: "+254798654321", email: "brian.omondi@consultancy.org", id_number: "26781290", emergency_contact_name: "Brenda Otieno (Sister)", emergency_contact_phone: "+254712334455", status: "active", unit_id: 3, unit_number: "A201", property_name: "Kilimani Royal Heights", balance: 96087.5 },
    { id: 4, name: "Nexus Law Advocates LLP", phone: "+254700554433", email: "admin@nexuslaw.co.ke", id_number: "CPR/2019/94832", emergency_contact_name: "Senior Partner K. Mutua", emergency_contact_phone: "+254722998811", status: "active", unit_id: 6, unit_number: "Suite 101", property_name: "Westlands Executive Suites", balance: 110100 },
    { id: 5, name: "David Kimani Ngugi", phone: "+254725332211", email: "david.kimani@safari.com", id_number: "25890143", emergency_contact_name: "Beatrice Ngugi (Mother)", emergency_contact_phone: "+254722114477", status: "active", unit_id: 8, unit_number: "Res B3", property_name: "Westlands Executive Suites", balance: 0 },
    { id: 6, name: "Sophie Van Der Beek", phone: "+254746112233", email: "sophie.vdb@unep.org", id_number: "PASSPORT-NL983214", emergency_contact_name: "Dirk Van Der Beek", emergency_contact_phone: "+31612345678", status: "active", unit_id: 5, unit_number: "Penthouse 1", property_name: "Kilimani Royal Heights", balance: 0 },
    { id: 7, name: "Capt. Salim Bwanaheri", phone: "+254720448833", email: "salim.bwanaheri@kpa.co.ke", id_number: "24119830", emergency_contact_name: "Asha Salim (Wife)", emergency_contact_phone: "+254733221100", status: "active", unit_id: 12, unit_number: "Villa Palms", property_name: "Nyali Ocean Breeze Villas", balance: 0 }
  ],

  invoices: [
    { id: 1, invoice_number: "INV-202611-001", lease_id: 1, tenant_id: 1, unit_id: 1, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 65000, water_amount: 2310, garbage_amount: 500, service_charge: 3500, late_fee: 0, other_charges: 0, total_amount: 71310, amount_paid: 71310, balance: 0, status: "paid", notes: "Automated monthly billing for Nov 2026", tenant_name: "Kariuki James Mwangi", tenant_phone: "+254722889900", unit_number: "A101", property_name: "Kilimani Royal Heights" },
    { id: 2, invoice_number: "INV-202611-002", lease_id: 2, tenant_id: 2, unit_id: 2, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 65000, water_amount: 2012.5, garbage_amount: 500, service_charge: 3500, late_fee: 0, other_charges: 0, total_amount: 71012.5, amount_paid: 40000, balance: 31012.5, status: "partially_paid", notes: "Partial payment received", tenant_name: "Amina Hassan Mohamed", tenant_phone: "+254710123456", unit_number: "A102", property_name: "Kilimani Royal Heights" },
    { id: 3, invoice_number: "INV-202611-003", lease_id: 3, tenant_id: 3, unit_id: 3, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 85000, water_amount: 3587.5, garbage_amount: 500, service_charge: 4500, late_fee: 2500, other_charges: 0, total_amount: 96087.5, amount_paid: 0, balance: 96087.5, status: "overdue", notes: "Late fee applied", tenant_name: "Brian Omondi Otieno", tenant_phone: "+254798654321", unit_number: "A201", property_name: "Kilimani Royal Heights" },
    { id: 4, invoice_number: "INV-202611-004", lease_id: 4, tenant_id: 6, unit_id: 5, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 140000, water_amount: 3937.5, garbage_amount: 750, service_charge: 6000, late_fee: 0, other_charges: 0, total_amount: 150687.5, amount_paid: 150687.5, balance: 0, status: "paid", notes: "NCBA Wire Transfer", tenant_name: "Sophie Van Der Beek", tenant_phone: "+254746112233", unit_number: "Penthouse 1", property_name: "Kilimani Royal Heights" },
    { id: 5, invoice_number: "INV-202611-005", lease_id: 5, tenant_id: 4, unit_id: 6, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-10", rent_amount: 95000, water_amount: 2100, garbage_amount: 1000, service_charge: 12000, late_fee: 0, other_charges: 0, total_amount: 110100, amount_paid: 0, balance: 110100, status: "unpaid", notes: "Commercial office Nov billing", tenant_name: "Nexus Law Advocates LLP", tenant_phone: "+254700554433", unit_number: "Suite 101", property_name: "Westlands Executive Suites" },
    { id: 6, invoice_number: "INV-202611-006", lease_id: 6, tenant_id: 5, unit_id: 8, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 55000, water_amount: 1487.5, garbage_amount: 500, service_charge: 4000, late_fee: 0, other_charges: 0, total_amount: 60987.5, amount_paid: 60987.5, balance: 0, status: "paid", notes: "Serviced apartment billing", tenant_name: "David Kimani Ngugi", tenant_phone: "+254725332211", unit_number: "Res B3", property_name: "Westlands Executive Suites" },
    { id: 7, invoice_number: "INV-202611-007", lease_id: 8, tenant_id: 7, unit_id: 12, month: "2026-11", issue_date: "2026-11-01", due_date: "2026-11-05", rent_amount: 120000, water_amount: 2975, garbage_amount: 800, service_charge: 5000, late_fee: 0, other_charges: 0, total_amount: 128775, amount_paid: 128775, balance: 0, status: "paid", notes: "Nyali coastal villa Nov rent", tenant_name: "Capt. Salim Bwanaheri", tenant_phone: "+254720448833", unit_number: "Villa Palms", property_name: "Nyali Ocean Breeze Villas" }
  ],

  payments: [
    { id: 1, receipt_number: "REC-20261101-4912", invoice_id: 1, tenant_id: 1, amount: 71310, payment_date: "2026-11-01 08:30:15", payment_method: "M-Pesa", reference_code: "QG982KLA83", payer_phone: "+254722889900", payer_name: "Kariuki James Mwangi", status: "completed", notes: "Rent payment via M-Pesa STK", tenant_name: "Kariuki James Mwangi", invoice_number: "INV-202611-001", unit_number: "A101", property_name: "Kilimani Royal Heights" },
    { id: 2, receipt_number: "REC-20261101-5129", invoice_id: 2, tenant_id: 2, amount: 40000, payment_date: "2026-11-01 09:14:02", payment_method: "M-Pesa", reference_code: "QGA77XNM21", payer_phone: "+254710123456", payer_name: "Amina Hassan Mohamed", status: "completed", notes: "Partial rent payment via M-Pesa", tenant_name: "Amina Hassan Mohamed", invoice_number: "INV-202611-002", unit_number: "A102", property_name: "Kilimani Royal Heights" },
    { id: 3, receipt_number: "REC-20261101-8834", invoice_id: 4, tenant_id: 6, amount: 150687.5, payment_date: "2026-11-01 11:45:00", payment_method: "Bank Transfer", reference_code: "NCBA-TXN-90283", payer_phone: "+254746112233", payer_name: "Sophie Van Der Beek", status: "completed", notes: "Wire transfer NCBA Bank", tenant_name: "Sophie Van Der Beek", invoice_number: "INV-202611-004", unit_number: "Penthouse 1", property_name: "Kilimani Royal Heights" },
    { id: 4, receipt_number: "REC-20261101-9921", invoice_id: 6, tenant_id: 5, amount: 60987.5, payment_date: "2026-11-01 14:20:10", payment_method: "M-Pesa", reference_code: "QGB33PRT90", payer_phone: "+254725332211", payer_name: "David Kimani Ngugi", status: "completed", notes: "Rent settlement", tenant_name: "David Kimani Ngugi", invoice_number: "INV-202611-006", unit_number: "Res B3", property_name: "Westlands Executive Suites" },
    { id: 5, receipt_number: "REC-20261101-3310", invoice_id: 7, tenant_id: 7, amount: 128775, payment_date: "2026-11-01 16:05:44", payment_method: "Cheque Deposit", reference_code: "CHQ-ABSA-8839", payer_phone: "+254720448833", payer_name: "Capt. Salim Bwanaheri", status: "completed", notes: "Absa cheque cleared", tenant_name: "Capt. Salim Bwanaheri", invoice_number: "INV-202611-007", unit_number: "Villa Palms", property_name: "Nyali Ocean Breeze Villas" }
  ],

  waterReadings: [
    { id: 1, unit_id: 1, month: "2026-11", reading_date: "2026-11-01", previous_reading: 156.0, current_reading: 169.2, units_consumed: 13.2, rate_per_unit: 175.0, total_cost: 2310.0, invoiced: 1, unit_number: "A101", meter_number: "WM-KIL-101", property_name: "Kilimani Royal Heights", tenant_name: "Kariuki James Mwangi" },
    { id: 2, unit_id: 2, month: "2026-11", reading_date: "2026-11-01", previous_reading: 109.5, current_reading: 121.0, units_consumed: 11.5, rate_per_unit: 175.0, total_cost: 2012.5, invoiced: 1, unit_number: "A102", meter_number: "WM-KIL-102", property_name: "Kilimani Royal Heights", tenant_name: "Amina Hassan Mohamed" },
    { id: 3, unit_id: 3, month: "2026-11", reading_date: "2026-11-01", previous_reading: 228.0, current_reading: 248.5, units_consumed: 20.5, rate_per_unit: 175.0, total_cost: 3587.5, invoiced: 1, unit_number: "A201", meter_number: "WM-KIL-201", property_name: "Kilimani Royal Heights", tenant_name: "Brian Omondi Otieno" },
    { id: 4, unit_id: 5, month: "2026-11", reading_date: "2026-11-01", previous_reading: 362.5, current_reading: 385.0, units_consumed: 22.5, rate_per_unit: 175.0, total_cost: 3937.5, invoiced: 1, unit_number: "Penthouse 1", meter_number: "WM-KIL-PH1", property_name: "Kilimani Royal Heights", tenant_name: "Sophie Van Der Beek" }
  ],

  maintenance: [
    { id: 1, ticket_number: "TKT-3941", unit_id: 1, tenant_id: 1, title: "Master Bathroom Shower Mixer Leaking", description: "Hot water valve leaking behind the tiling, causing dampness.", category: "plumbing", priority: "high", status: "in_progress", assigned_contractor: "Mwangi Plumbers Ltd (+254721998877)", contractor_phone: "+254721998877", estimated_cost: 4500, actual_cost: 0, reported_date: "2026-11-01 10:15:00", completed_date: null, notes: "Spare cartridges purchased from Industrial Area.", property_name: "Kilimani Royal Heights", unit_number: "A101", tenant_name: "Kariuki James Mwangi", tenant_phone: "+254722889900" },
    { id: 2, ticket_number: "TKT-4102", unit_id: 6, tenant_id: 4, title: "Office Server Room Split AC Servicing", description: "Inverter AC blinking error code E4, ambient temperature rising.", category: "electrical", priority: "medium", status: "assigned", assigned_contractor: "ChillTech HVAC Solutions (+254711223344)", contractor_phone: "+254711223344", estimated_cost: 8500, actual_cost: 0, reported_date: "2026-11-01 14:00:00", completed_date: null, notes: "Technician scheduled for 10 AM.", property_name: "Westlands Executive Suites", unit_number: "Suite 101", tenant_name: "Nexus Law Advocates LLP", tenant_phone: "+254700554433" }
  ],

  communications: [
    { id: 1, type: "sms", recipient_name: "Kariuki James Mwangi", recipient_phone: "+254722889900", tenant_id: 1, message: "Dear Kariuki James, your 2026-11 rent invoice INV-202611-001 of KES 71,310 is ready. Paybill: 522522, Acc: KRH-01.", status: "delivered", sent_at: "2026-11-01 07:00:00", purpose: "invoice_notification" },
    { id: 2, type: "sms", recipient_name: "Kariuki James Mwangi", recipient_phone: "+254722889900", tenant_id: 1, message: "Confirmed! QG982KLA83 Confirmed. KES 71,310 received for REC-20261101-4912. Thank you! - BomaSphere Management", status: "delivered", sent_at: "2026-11-01 08:30:16", purpose: "receipt" }
  ],

  expenses: [
    { id: 1, property_id: 1, category: "Repairs", description: "Borehole pump stator rewinding and electrical contactor replacement", amount: 18500, expense_date: "2026-11-01", paid_to: "Davis & Shirtliff Ltd", receipt_voucher: "VCH-202611-01", property_name: "Kilimani Royal Heights" },
    { id: 2, property_id: 1, category: "Security", description: "Monthly security guard patrol deployment (4 Day, 4 Night)", amount: 64000, expense_date: "2026-11-01", paid_to: "SecureGuard Kenya", receipt_voucher: "VCH-202611-02", property_name: "Kilimani Royal Heights" },
    { id: 3, property_id: 2, category: "Cleaning", description: "Common area floor polishing and high-level window washing", amount: 22000, expense_date: "2026-11-01", paid_to: "CleanPro Services", receipt_voucher: "VCH-202611-03", property_name: "Westlands Executive Suites" }
  ],

  users: [
    { id: 1, name: "Sarah Cherono (Platform Super Admin)", email: "admin@bomasphere.co.ke", phone: "+254700112233", role: "super_admin", property_id: null, tenant_id: null, status: "active", session_token: "token_super_admin" },
    { id: 2, name: "Patrick Ndegwa (Property Manager)", email: "ndegwa@crownpeak.co.ke", phone: "+254711333444", role: "property_manager", property_id: null, tenant_id: null, status: "active", session_token: "token_property_manager" },
    { id: 3, name: "John Otieno (Site Caretaker)", email: "otieno.caretaker@kilimaniheights.ke", phone: "+254722556677", role: "caretaker", property_id: 1, tenant_id: null, status: "active", session_token: "token_caretaker" },
    { id: 4, name: "Dr. Esther Wambui Ndung'u (Landlord / Investor)", email: "esther.ndungu@gmail.com", phone: "+254733555777", role: "landlord", property_id: 3, tenant_id: null, status: "active", session_token: "token_landlord" },
    { id: 5, name: "Kariuki James Mwangi (Resident Tenant)", email: "james.kariuki@techke.com", phone: "+254722889900", role: "tenant", property_id: 1, tenant_id: 1, status: "active", session_token: "token_tenant" }
  ],

  iotDevices: [
    { id: 1, meter_number: "IOT-KRH-A101", property_id: 1, unit_id: 1, unit_number: "A101", property_name: "Kilimani Royal Heights", device_type: "Ultrasonic LoRaWAN Meter", battery_pct: 96, signal_rssi: -72, flow_rate_lph: 0.0, total_cubic_meters: 154.2, valve_status: "open" },
    { id: 2, meter_number: "IOT-KRH-A102", property_id: 1, unit_id: 2, unit_number: "A102", property_name: "Kilimani Royal Heights", device_type: "Ultrasonic LoRaWAN Meter", battery_pct: 98, signal_rssi: -69, flow_rate_lph: 1.2, total_cubic_meters: 89.6, valve_status: "open" },
    { id: 3, meter_number: "IOT-KRH-A202", property_id: 1, unit_id: 4, unit_number: "A202", property_name: "Kilimani Royal Heights", device_type: "Ultrasonic LoRaWAN Meter", battery_pct: 94, signal_rssi: -75, flow_rate_lph: 14.8, total_cubic_meters: 12.4, valve_status: "open" },
    { id: 4, meter_number: "IOT-WES-101", property_id: 2, unit_id: 6, unit_number: "Suite 101", property_name: "Westlands Executive Suites", device_type: "NB-IoT Smart Sub-meter", battery_pct: 91, signal_rssi: -81, flow_rate_lph: 0.0, total_cubic_meters: 310.5, valve_status: "open" }
  ],
  leakAlerts: [
    { id: 1, device_id: 3, unit_id: 4, meter_number: "IOT-KRH-A202", unit_number: "A202", property_name: "Kilimani Royal Heights", severity: "critical", title: "Midnight Continuous Flow in Vacant Unit A202", message: "Ultrasonic sensor detected continuous 14.8 L/hr flow between 01:00 AM and 04:30 AM in vacant unit. Probable toilet cistern bypass or pipe joint weeping.", flow_detected_lph: 14.8, status: "active", detected_at: "2026-11-02 03:14:00" }
  ],
  fundis: [
    { id: 1, name: "Kamau Mwangi", trade: "Plumbing & Drainage", phone: "+254711223344", rating: 4.9, jobs_completed: 42, id_verified: 1, daily_rate: 2500, availability: "available", location: "Kilimani, Nairobi" },
    { id: 2, name: "Ouma Electrical Solutions", trade: "Certified Electrical & Solar", phone: "+254722334455", rating: 4.8, jobs_completed: 38, id_verified: 1, daily_rate: 3000, availability: "available", location: "Westlands, Nairobi" },
    { id: 3, name: "ChillTech HVAC Engineers", trade: "AC & Cold Room Repair", phone: "+254733445566", rating: 4.7, jobs_completed: 19, id_verified: 1, daily_rate: 3500, availability: "busy", location: "Nairobi" },
    { id: 4, name: "Juma Coastal Carpentry", trade: "Carpentry & Cabinetry", phone: "+254720556677", rating: 4.9, jobs_completed: 29, id_verified: 1, daily_rate: 2200, availability: "available", location: "Nyali, Mombasa" }
  ],
  escrows: [
    { id: 1, ticket_id: 1, fundi_id: 1, ticket_title: "Master Bathroom Shower Mixer Leaking", ticket_number: "TKT-3941", fundi_name: "Kamau Mwangi", fundi_trade: "Plumbing & Drainage", fundi_phone: "+254711223344", amount: 3500, status: "held", b2c_disbursement_ref: null, milestone_desc: "Milestone 1: Replace corroded shower mixer and seal pipe joints.", created_at: "2026-11-01 11:00:00" }
  ],
  vettings: [
    { id: 1, applicant_name: "Faith Njeri Karanja", phone: "+254721990011", email: "faith.karanja@equity.co.ke", id_number: "32114590", requested_unit_id: 4, unit_number: "A202", base_rent: 85000, property_name: "Kilimani Royal Heights", monthly_income: 280000, crb_score: 785, risk_category: "Low Risk", rent_to_income_pct: 30.4, recommendation: "Approved: Clean CRB credit report and healthy rent-to-income ratio.", created_at: "2026-11-01" },
    { id: 2, applicant_name: "Dennis Kiprono Rotich", phone: "+254715887766", email: "dennis.rotich@agriltd.ke", id_number: "29871032", requested_unit_id: 7, unit_number: "Suite 102", base_rent: 75000, property_name: "Westlands Executive Suites", monthly_income: 190000, crb_score: 620, risk_category: "Medium Risk", rent_to_income_pct: 39.5, recommendation: "Conditional Approval: Require 2 months security deposit due to debt service ratio.", created_at: "2026-11-02" }
  ],
  etimsRecords: [
    { id: 1, invoice_id: 1, control_code: "KRA-ETIMS-1-98AF23", qr_code_url: "https://itax.kra.go.ke/KRA-Portal/invoiceVerification.htm?controlCode=KRA-ETIMS-1-98AF23", tax_type: "MRI_7.5_PCT", taxable_amount: 65000, tax_payable: 4875, kra_status: "transmitted", invoice_number: "INV-202611-001", month: "2026-11", unit_number: "A101", property_name: "Kilimani Royal Heights", tenant_name: "Kariuki James Mwangi" },
    { id: 2, invoice_id: 2, control_code: "KRA-ETIMS-2-B72D19", qr_code_url: "https://itax.kra.go.ke/KRA-Portal/invoiceVerification.htm?controlCode=KRA-ETIMS-2-B72D19", tax_type: "MRI_7.5_PCT", taxable_amount: 65000, tax_payable: 4875, kra_status: "transmitted", invoice_number: "INV-202611-002", month: "2026-11", unit_number: "A102", property_name: "Kilimani Royal Heights", tenant_name: "Amina Hassan Mohamed" }
  ],
  viewingLeads: [
    { id: 1, unit_id: 4, prospect_name: "Caroline Achieng", phone: "+254712445566", email: "carol.achieng@gmail.com", preferred_date: "2026-11-05", time_slot: "10:00 AM", status: "confirmed", notes: "Interested in 3BR Kilimani unit." }
  ],
  leaseAgreements: [
    {
      id: 1, lease_id: 1, unit_id: 1, tenant_id: 1, agreement_code: "BS-LEASE-2026-A101",
      rent_amount: 65000, deposit_amount: 130000, start_date: "2026-01-01", end_date: "2026-12-31",
      terms_clauses: "Residential Tenancy Agreement governed by the Laws of Kenya (Landlord and Tenant Act). Rent payable on or before 5th. No subletting.",
      tenant_signature: "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"50\"><path d=\"M10 35 Q50 10 90 35 T170 30\" stroke=\"%23059669\" stroke-width=\"2\" fill=\"none\"/></svg>",
      tenant_signed_at: "2026-01-02 11:20:00",
      manager_signature: "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"50\"><path d=\"M10 25 Q60 40 110 20 T180 35\" stroke=\"%230f172a\" stroke-width=\"2\" fill=\"none\"/></svg>",
      manager_signed_at: "2026-01-02 14:15:00", status: "executed", contract_hash: "SHA256-8A9F1C03BE49E7802D9F88A1",
      tenant_name: "Kariuki James Mwangi", tenant_phone: "+254722889900", unit_number: "A101", property_name: "Kilimani Royal Heights"
    },
    {
      id: 2, lease_id: 2, unit_id: 2, tenant_id: 2, agreement_code: "BS-LEASE-2026-A102",
      rent_amount: 65000, deposit_amount: 130000, start_date: "2026-02-01", end_date: "2027-01-31",
      terms_clauses: "Standard Kenyan residential tenancy agreement.",
      tenant_signature: null, tenant_signed_at: null,
      manager_signature: "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"50\"><path d=\"M10 25 Q60 40 110 20 T180 35\" stroke=\"%230f172a\" stroke-width=\"2\" fill=\"none\"/></svg>",
      manager_signed_at: "2026-01-28 09:30:00", status: "pending_tenant", contract_hash: "SHA256-112B4C99A0E32551",
      tenant_name: "Amina Hassan Mohamed", tenant_phone: "+254710123456", unit_number: "A102", property_name: "Kilimani Royal Heights"
    }
  ],
  inspections: [
    {
      id: 1, unit_id: 1, tenant_id: 1, inspection_type: "move_in", inspection_date: "2026-01-01",
      inspector_name: "John Otieno (Site Caretaker)", damages_total: 0, deposit_held: 130000,
      unpaid_utility_arrears: 0, net_deposit_refund: 130000, status: "completed",
      unit_number: "A101", property_name: "Kilimani Royal Heights", tenant_name: "Kariuki James Mwangi",
      checklist: [
        { item: "Living Room Walls & Paint", status: "Pristine", notes: "Fresh coat of soft white emulsion." },
        { item: "Kitchen Sink & Mixer", status: "Pristine", notes: "No leaks, good water pressure." },
        { item: "Bathroom Tiles & Shower", status: "Pristine", notes: "Clean grouting, functional." }
      ]
    },
    {
      id: 2, unit_id: 3, tenant_id: 3, inspection_type: "move_out", inspection_date: "2026-10-31",
      inspector_name: "John Otieno (Site Caretaker)", damages_total: 7700, deposit_held: 130000,
      unpaid_utility_arrears: 2150, net_deposit_refund: 120150, status: "settled",
      unit_number: "A201", property_name: "Kilimani Royal Heights", tenant_name: "Brian Omondi Otieno",
      checklist: [
        { item: "Living Room Walls & Paint", status: "Damaged", repair_cost: 4500, notes: "Plaster tears." },
        { item: "Bathroom Mirror & Cabinet", status: "Damaged", repair_cost: 3200, notes: "Cracked hinge." }
      ]
    }
  ],
  visitorPasses: [
    { id: 1, pass_code: "PASS-8491", unit_id: 1, tenant_id: 1, visitor_name: "Dr. Samuel Makori", visitor_phone: "+254722334455", vehicle_plate: "KDA 482B", valid_date: "2026-11-03", time_slot: "02:00 PM - 06:00 PM", status: "active", qr_data: "BOMASPHERE:PASS-8491:UNIT-A101", unit_number: "A101", property_name: "Kilimani Royal Heights", host_name: "Kariuki James Mwangi" },
    { id: 2, pass_code: "PASS-3312", unit_id: 1, tenant_id: 1, visitor_name: "DHL Express Courier", visitor_phone: "+254700998877", vehicle_plate: "KCM 119Z", valid_date: "2026-11-03", time_slot: "10:00 AM - 01:00 PM", status: "active", qr_data: "BOMASPHERE:PASS-3312:UNIT-A101", unit_number: "A101", property_name: "Kilimani Royal Heights", host_name: "Kariuki James Mwangi" }
  ],
  amenities: [
    { id: 1, property_id: 1, name: "Kilimani Sunset Rooftop BBQ Lounge", description: "Panoramic rooftop deck with built-in stainless steel charcoal grill, wet bar, ambient string lighting, and Nairobi skyline views.", category: "Lounge & BBQ", capacity: 35, hourly_fee: 1500, photo: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&auto=format&fit=crop&q=80", status: "available", property_name: "Kilimani Royal Heights", city: "Nairobi" },
    { id: 2, property_id: 1, name: "Heated Swimming Pool & Sundeck", description: "20-meter heated lap pool with poolside loungers and shower facilities.", category: "Recreation", capacity: 25, hourly_fee: 0, photo: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&auto=format&fit=crop&q=80", status: "available", property_name: "Kilimani Royal Heights", city: "Nairobi" },
    { id: 3, property_id: 2, name: "Westlands Executive Boardroom", description: "12-person glass boardroom with 4K display, high-speed dedicated fiber, and teleconferencing gear.", category: "Business & Meeting", capacity: 12, hourly_fee: 2500, photo: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80", status: "available", property_name: "Westlands Executive Suites", city: "Nairobi" },
    { id: 4, property_id: 4, name: "Nyali Ocean Breeze Gazebo", description: "Beachfront covered pavilion with tropical garden lawn, power hookups, and ocean breeze.", category: "Event & Social", capacity: 50, hourly_fee: 3000, photo: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80", status: "available", property_name: "Nyali Ocean Breeze Villas", city: "Mombasa" }
  ],
  amenityBookings: [
    { id: 1, booking_reference: "BK-8942", amenity_id: 1, tenant_id: 1, unit_id: 1, booking_date: "2026-11-08", start_time: "03:00 PM", end_time: "07:00 PM", total_fee: 6000, status: "confirmed", amenity_name: "Kilimani Sunset Rooftop BBQ Lounge", unit_number: "A101", tenant_name: "Kariuki James Mwangi" }
  ]
};

function resolveRequestUser(request) {
  const authHeader = request.headers.get('authorization') || '';
  const tokenHeader = request.headers.get('x-auth-token') || '';
  const roleHeader = request.headers.get('x-role') || '';
  let token = tokenHeader;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (token) {
    const user = DB.users.find(u => u.session_token === token || `token_${u.role}` === token);
    if (user) return user;
    if (token.startsWith('token_')) {
      const r = token.replace('token_', '');
      const uByRole = DB.users.find(u => u.role === r);
      if (uByRole) return uByRole;
    }
  }
  if (roleHeader) {
    const uByRole = DB.users.find(u => u.role === roleHeader);
    if (uByRole) return uByRole;
  }
  return null;
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token, X-Role'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: corsHeaders });

  // 1. Portfolio Stats
  if (pathname === '/api/stats' && method === 'GET') {
    return json({
      stats: {
        properties: DB.properties.length,
        total_units: DB.units.length,
        occupied_units: DB.units.filter(u => u.status === 'occupied').length,
        vacant_units: DB.units.filter(u => u.status === 'vacant').length,
        maintenance_units: DB.units.filter(u => u.status === 'maintenance').length,
        occupancy_rate: 66.7,
        collection_rate: 65.6,
        total_billed: 688960,
        total_collected: 451759,
        total_arrears: 237201,
        active_tickets: DB.maintenance.filter(m => m.status !== 'completed').length
      },
      recentPayments: DB.payments.slice(0, 5),
      recentTickets: DB.maintenance.slice(0, 5),
      monthlyGraph: {
        months: ["Jun 26", "Jul 26", "Aug 26", "Sep 26", "Oct 26", "Nov 26"],
        billed: [620000, 645000, 650000, 665000, 672000, 688960],
        collected: [590000, 630000, 642000, 660000, 670000, 451759]
      }
    });
  }

  // 2. Properties
  if (pathname === '/api/properties' && method === 'GET') {
    return json(DB.properties.map(p => ({
      ...p,
      total_units: DB.units.filter(u => u.property_id === p.id).length,
      occupied_units: DB.units.filter(u => u.property_id === p.id && u.status === 'occupied').length
    })));
  }

  if (pathname === '/api/properties' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const newProp = {
      id: DB.properties.length + 1,
      name: b.name || 'New Property',
      property_type: b.property_type || 'Residential',
      address: b.address || '',
      city: b.city || 'Nairobi',
      landlord_name: b.landlord_name || '',
      landlord_phone: b.landlord_phone || '',
      landlord_email: b.landlord_email || '',
      management_fee_pct: Number(b.management_fee_pct || 8.5),
      paybill_number: b.paybill_number || '522522',
      bank_name: b.bank_name || 'KCB Bank',
      bank_account: b.bank_account || ''
    };
    DB.properties.push(newProp);
    return json({ success: true, id: newProp.id, name: newProp.name, property: newProp }, 201);
  }

  // 3. Units
  if (pathname === '/api/units' && method === 'GET') {
    return json(DB.units);
  }

  if (pathname === '/api/units' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const prop = DB.properties.find(p => p.id === Number(b.property_id)) || DB.properties[0];
    const newUnit = {
      id: DB.units.length + 1,
      property_id: Number(b.property_id || 1),
      unit_number: b.unit_number || `U-${DB.units.length + 1}`,
      floor: b.floor || 'Ground',
      unit_type: b.unit_type || '2-Bedroom',
      base_rent: Number(b.base_rent || 50000),
      service_charge: Number(b.service_charge || 3000),
      garbage_fee: Number(b.garbage_fee || 500),
      status: b.status || 'vacant',
      meter_number: b.meter_number || `WM-${Math.floor(100 + Math.random() * 900)}`,
      property_name: prop ? prop.name : 'Kilimani Royal Heights'
    };
    DB.units.push(newUnit);
    return json({ success: true, id: newUnit.id, unit_number: newUnit.unit_number, unit: newUnit }, 201);
  }

  if (pathname.startsWith('/api/units/') && method === 'PUT') {
    const id = Number(pathname.split('/')[3]);
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const unit = DB.units.find(u => u.id === id);
    if (!unit) return json({ error: 'Unit not found' }, 404);
    if (b.status) unit.status = b.status;
    if (b.base_rent) unit.base_rent = Number(b.base_rent);
    return json({ success: true, unit });
  }

  // 4. Tenants
  if (pathname === '/api/tenants' && method === 'GET') {
    return json(DB.tenants);
  }

  if (pathname === '/api/tenants' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const unitId = Number(b.unit_id || 0);
    const unit = DB.units.find(u => u.id === unitId);
    if (unit) unit.status = 'occupied';

    const newTenant = {
      id: DB.tenants.length + 1,
      name: b.name || 'New Tenant',
      phone: b.phone || '',
      email: b.email || '',
      id_number: b.id_number || '',
      emergency_contact_name: b.emergency_contact_name || '',
      emergency_contact_phone: b.emergency_contact_phone || '',
      status: 'active',
      unit_id: unitId || 1,
      unit_number: unit ? unit.unit_number : 'A101',
      property_name: unit ? unit.property_name : 'Kilimani Royal Heights',
      balance: 0,
      monthly_rent: unit ? unit.base_rent : 65000,
      lease_start: b.lease_start_date || new Date().toISOString().slice(0, 10),
      lease_end: b.lease_end_date || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
    };
    DB.tenants.unshift(newTenant);
    return json({ success: true, id: newTenant.id, name: newTenant.name, tenant: newTenant }, 201);
  }

  // Leases
  if (pathname === '/api/leases' && method === 'GET') {
    return json(DB.leaseAgreements);
  }

  if (pathname === '/api/leases' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Authorizing lease agreements requires Property Manager or Admin privileges.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const newLease = {
      id: DB.leaseAgreements.length + 1,
      unit_id: Number(b.unit_id || 1),
      tenant_id: Number(b.tenant_id || 1),
      start_date: b.start_date || new Date().toISOString().slice(0, 10),
      end_date: b.end_date || '2027-12-31',
      monthly_rent: Number(b.monthly_rent || 65000),
      deposit_amount: Number(b.deposit_amount || 130000),
      status: 'active',
      agreement_code: `BS-LEASE-${Math.floor(1000 + Math.random() * 9000)}`
    };
    DB.leaseAgreements.unshift(newLease);
    return json({ success: true, id: newLease.id, lease: newLease }, 201);
  }

  if (pathname.startsWith('/api/leases/') && method === 'PUT') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Modifying lease agreements requires Property Manager or Admin privileges.' }, 403);
    }
    const id = Number(pathname.split('/')[3]);
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const lease = DB.leaseAgreements.find(l => l.id === id);
    if (!lease) return json({ error: 'Lease not found' }, 404);
    if (b.status) lease.status = b.status;
    return json({ success: true, lease });
  }

  // 5. Invoices
  if (pathname === '/api/invoices' && method === 'GET') {
    const user = resolveRequestUser(request);
    if (user && user.role === 'caretaker') {
      return json({ 
        error: '403 Forbidden: Caretakers are restricted from accessing financial ledgers and billing records.',
        role: user.role
      }, 403);
    }
    let list = DB.invoices;
    if (user && user.role === 'tenant') {
      list = list.filter(i => i.tenant_id === (user.tenant_id || 1));
    } else if (user && user.role === 'landlord' && user.property_id) {
      const prop = DB.properties.find(p => p.id === user.property_id);
      if (prop) list = list.filter(i => i.property_name === prop.name);
    }
    return json(list);
  }

  if (pathname === '/api/invoices' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
    if (user.role === 'caretaker' || user.role === 'tenant' || user.role === 'landlord') {
      return json({ error: '403 Forbidden: Invoicing authority is restricted to Property Managers and Super Admins.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const newInv = {
      id: DB.invoices.length + 1,
      invoice_number: `INV-202611-${Math.floor(100 + Math.random() * 900)}`,
      month: b.month || '2026-11',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 5*86400000).toISOString().slice(0, 10),
      total_amount: Number(b.rent_amount || 0) + Number(b.water_amount || 0) + Number(b.service_charge || 0),
      amount_paid: 0,
      balance: Number(b.rent_amount || 0) + Number(b.water_amount || 0) + Number(b.service_charge || 0),
      status: 'unpaid',
      tenant_name: 'Resident Tenant'
    };
    DB.invoices.unshift(newInv);
    return json({ success: true, id: newInv.id, invoice_number: newInv.invoice_number }, 201);
  }

  if (pathname === '/api/invoices/generate-monthly' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant' || user.role === 'landlord')) {
      return json({ error: '403 Forbidden: Batch monthly invoicing requires Property Manager privileges.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const month = b.month || '2026-12';
    let generated = 0;
    
    for (const u of DB.units.filter(u => u.status === 'occupied')) {
      const tenant = DB.tenants.find(t => t.unit_id === u.id) || DB.tenants[0];
      const invNum = `INV-${month.replace('-', '')}-${String(u.id).padStart(3, '0')}`;
      if (!DB.invoices.some(i => i.invoice_number === invNum)) {
        const total = (u.base_rent || 0) + (u.service_charge || 0) + (u.garbage_fee || 0) + 2150;
        DB.invoices.unshift({
          id: DB.invoices.length + 1,
          invoice_number: invNum,
          unit_id: u.id,
          tenant_id: tenant ? tenant.id : 1,
          month: month,
          issue_date: new Date().toISOString().slice(0, 10),
          due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
          rent_amount: u.base_rent,
          water_amount: 2150,
          service_charge: u.service_charge,
          garbage_amount: u.garbage_fee,
          total_amount: total,
          amount_paid: 0,
          balance: total,
          status: 'unpaid',
          tenant_name: tenant ? tenant.name : 'Resident',
          tenant_phone: tenant ? tenant.phone : '+254700000000',
          unit_number: u.unit_number,
          property_name: u.property_name
        });
        generated++;
      }
    }
    return json({ success: true, count: generated, message: `Successfully generated ${generated} consolidated invoices for ${month}.` });
  }

  // 6. Payments
  if (pathname === '/api/payments' && method === 'GET') {
    const user = resolveRequestUser(request);
    if (user && user.role === 'caretaker') {
      return json({ 
        error: '403 Forbidden: Caretakers are restricted from accessing financial ledgers and payment receipts.',
        role: user.role
      }, 403);
    }
    let list = DB.payments;
    if (user && user.role === 'tenant') {
      list = list.filter(p => p.tenant_id === (user.tenant_id || 1));
    } else if (user && user.role === 'landlord' && user.property_id) {
      const prop = DB.properties.find(p => p.id === user.property_id);
      if (prop) list = list.filter(p => p.property_name === prop.name);
    }
    return json(list);
  }

  if (pathname === '/api/payments' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (user && user.role === 'caretaker') {
      return json({ error: '403 Forbidden: Caretakers cannot process payment receipts.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch(e) {}
    if (user && user.role === 'tenant' && b.tenant_id && b.tenant_id !== user.tenant_id) {
      return json({ error: '403 Forbidden: Tenants can only make payments on their own accounts.' }, 403);
    }
    const newPay = {
      id: DB.payments.length + 1,
      receipt_number: `REC-20261102-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: Number(b.amount || 5000),
      payment_method: b.payment_method || 'M-Pesa',
      reference_code: `QG${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      payment_date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      payer_phone: b.payer_phone || '+254722889900',
      status: 'completed'
    };
    DB.payments.unshift(newPay);
    return json({ success: true, receipt_number: newPay.receipt_number, reference_code: newPay.reference_code }, 201);
  }

  // 7. Water Readings
  if (pathname === '/api/water-readings' && method === 'GET') {
    return json(DB.waterReadings);
  }

  if (pathname === '/api/water-readings' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const consumed = Math.max(0, Number(b.current_reading) - Number(b.previous_reading || 0));
    const newWater = {
      id: DB.waterReadings.length + 1,
      unit_id: b.unit_id || 1,
      month: b.month || '2026-11',
      reading_date: new Date().toISOString().slice(0, 10),
      previous_reading: Number(b.previous_reading || 0),
      current_reading: Number(b.current_reading || 0),
      units_consumed: consumed,
      rate_per_unit: 175.0,
      total_cost: consumed * 175.0,
      invoiced: 0
    };
    DB.waterReadings.unshift(newWater);
    return json({ success: true, id: newWater.id, units_consumed: consumed, total_cost: newWater.total_cost }, 201);
  }

  // 8. Maintenance
  if (pathname === '/api/maintenance' && method === 'GET') {
    return json(DB.maintenance);
  }

  if (pathname === '/api/maintenance' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const newMaint = {
      id: DB.maintenance.length + 1,
      ticket_number: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      title: b.title || 'General Maintenance',
      description: b.description || '',
      category: b.category || 'plumbing',
      priority: b.priority || 'medium',
      status: 'open',
      reported_date: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    DB.maintenance.unshift(newMaint);
    return json({ success: true, id: newMaint.id, ticket_number: newMaint.ticket_number }, 201);
  }

  if (pathname.startsWith('/api/maintenance/') && method === 'PUT') {
    const id = Number(pathname.split('/')[3]);
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const ticket = DB.maintenance.find(m => m.id === id);
    if (!ticket) return json({ error: 'Maintenance ticket not found' }, 404);
    if (b.status) ticket.status = b.status;
    if (b.assigned_contractor) ticket.assigned_contractor = b.assigned_contractor;
    if (b.actual_cost) ticket.actual_cost = Number(b.actual_cost);
    if (b.notes) ticket.notes = b.notes;
    return json({ success: true, ticket });
  }

  // 9. Communications
  if (pathname === '/api/communications' && method === 'GET') {
    return json(DB.communications);
  }

  if (pathname === '/api/communications/broadcast' && method === 'POST') {
    return json({ success: true, count: 8, recipients_reached: 8 });
  }

  if (pathname === '/api/communications/send' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const tenant = DB.tenants.find(t => t.id === Number(b.tenant_id)) || DB.tenants[0];
    const newComm = {
      id: DB.communications.length + 1,
      tenant_id: tenant ? tenant.id : 1,
      recipient_name: tenant ? tenant.name : 'Resident',
      recipient_phone: tenant ? tenant.phone : '+254700000000',
      type: b.type || 'sms',
      message: b.message || 'Notice from property management',
      purpose: b.purpose || 'direct',
      sent_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      status: 'delivered'
    };
    DB.communications.unshift(newComm);
    return json({ success: true, id: newComm.id, channel: newComm.type, recipient: newComm.recipient_phone, message: 'Message queued and delivered.' }, 201);
  }

  // 10. Expenses
  if (pathname === '/api/expenses' && method === 'GET') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Caretakers and Tenants are not permitted to inspect property operating expenses.' }, 403);
    }
    let list = DB.expenses;
    if (user && user.role === 'landlord' && user.property_id) {
      list = list.filter(e => e.property_id === user.property_id);
    }
    return json(list);
  }

  if (pathname === '/api/expenses' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Only Property Managers and Landlords can log operating expense vouchers.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch(e) {}
    if (user && user.role === 'landlord' && b.property_id && Number(b.property_id) !== user.property_id) {
      return json({ error: `403 Forbidden: Landlord '${user.name}' is only authorized to log expenses for Property ID ${user.property_id}.` }, 403);
    }
    const newExp = {
      id: DB.expenses.length + 1,
      property_id: b.property_id || 1,
      category: b.category || 'Repairs',
      description: b.description || 'Operating Expense',
      amount: Number(b.amount || 0),
      expense_date: new Date().toISOString().slice(0, 10),
      receipt_voucher: `VCH-${Math.floor(1000 + Math.random() * 9000)}`
    };
    DB.expenses.unshift(newExp);
    return json({ success: true, id: newExp.id }, 201);
  }

  // 11. Landlord Remittance Statement
  if (pathname === '/api/reports/landlord-statement' && method === 'GET') {
    const user = resolveRequestUser(request);
    if (user && (user.role === 'caretaker' || user.role === 'tenant')) {
      return json({ error: '403 Forbidden: Access to owner remittance statements is restricted to Landlords and Property Managers.' }, 403);
    }
    const propId = Number(url.searchParams.get('property_id') || 1);
    if (user && user.role === 'landlord' && user.property_id && propId !== user.property_id) {
      return json({ error: `403 Forbidden: Landlord '${user.name}' is only authorized to view statements for Property ID ${user.property_id}.` }, 403);
    }
    const prop = DB.properties.find(p => p.id === propId) || DB.properties[0];
    return json({
      statement: {
        property: prop,
        month: url.searchParams.get('month') || '2026-11',
        gross_collections: 451759,
        total_billed: 688960,
        total_arrears: 237201,
        management_fee_rate: prop.management_fee_pct,
        management_fee_amount: (451759 * prop.management_fee_pct) / 100,
        operating_expenses: 82500,
        net_remittance_payout: 451759 - (451759 * prop.management_fee_pct) / 100 - 82500,
        expenses_breakdown: DB.expenses.filter(e => e.property_id === prop.id),
        invoices_breakdown: DB.invoices
      }
    });
  }

  // 12. Users & Authentication
  if (pathname === '/api/users' && method === 'GET') {
    const user = resolveRequestUser(request);
    if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
    if (user.role !== 'super_admin' && user.role !== 'property_manager') {
      return json({ error: `403 Forbidden: Role '${user.role}' is not authorized to inspect system user directories.` }, 403);
    }
    return json(DB.users);
  }

  if (pathname === '/api/users' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
    if (user.role !== 'super_admin' && user.role !== 'property_manager') {
      return json({ error: '403 Forbidden: Provisioning SaaS users requires Administrative privileges.' }, 403);
    }
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const newUser = {
      id: DB.users.length + 1,
      name: b.name || 'New SaaS User',
      email: b.email || 'user@bomasphere.co.ke',
      phone: b.phone || '+254700000000',
      role: b.role || 'caretaker',
      property_id: b.property_id ? Number(b.property_id) : null,
      tenant_id: b.tenant_id ? Number(b.tenant_id) : null,
      status: 'active'
    };
    DB.users.push(newUser);
    return json({ success: true, user: newUser }, 201);
  }

  if (pathname.startsWith('/api/users/') && method === 'PUT') {
    const user = resolveRequestUser(request);
    if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
    if (user.role !== 'super_admin' && user.role !== 'property_manager') {
      return json({ error: '403 Forbidden: Modifying user accounts requires Administrative privileges.' }, 403);
    }
    const id = Number(pathname.split('/')[3]);
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const targetUser = DB.users.find(u => u.id === id);
    if (!targetUser) return json({ error: 'User not found' }, 404);
    if (b.name) targetUser.name = b.name;
    if (b.phone) targetUser.phone = b.phone;
    if (b.role) targetUser.role = b.role;
    return json({ success: true, user: targetUser });
  }

  if (pathname.startsWith('/api/users/') && method === 'DELETE') {
    const user = resolveRequestUser(request);
    if (!user) return json({ error: '401 Unauthorized: Valid authentication token required.' }, 401);
    if (user.role !== 'super_admin' && user.role !== 'property_manager') {
      return json({ error: '403 Forbidden: Deleting user accounts requires Administrative privileges.' }, 403);
    }
    const id = Number(pathname.split('/')[3]);
    const idx = DB.users.findIndex(u => u.id === id);
    if (idx !== -1) DB.users.splice(idx, 1);
    return json({ success: true, message: 'User deactivated and removed' });
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const authHeader = request.headers.get('Authorization') || request.headers.get('X-Auth-Token') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (token) {
      const role = token.replace('token_', '');
      const user = DB.users.find(u => u.role === role);
      if (user) {
        return json({ success: true, user });
      }
    }
    return json({ error: 'Authentication required. Please sign in.' }, 401);
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const { email, password } = b;
    if (!email || !password) {
      return json({ error: 'Email and password are required' }, 400);
    }
    const user = DB.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      return json({ error: 'Invalid email or password' }, 401);
    }

    const rolePasswords = {
      super_admin: 'Admin@2026',
      property_manager: 'Manager@2026',
      caretaker: 'Caretaker@2026',
      landlord: 'Landlord@2026',
      tenant: 'Tenant@2026'
    };
    const expected = rolePasswords[user.role] || 'password123';
    if (password !== expected && password !== 'password123') {
      return json({ error: 'Invalid email or password' }, 401);
    }

    return json({ success: true, token: `token_${user.role}`, user });
  }

  if (pathname === '/api/auth/switch-account' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const role = b.role || 'property_manager';
    const user = DB.users.find(u => u.role === role) || DB.users[0];
    return json({ success: true, token: `token_${user.role}`, user });
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    return json({ success: true, message: 'Logged out successfully' });
  }

  if (pathname === '/api/reset-seed' && method === 'POST') {
    const user = resolveRequestUser(request);
    if (!user || user.role !== 'super_admin') {
      return json({ error: '403 Forbidden: System database reset requires Super Admin authentication.' }, 403);
    }
    return json({ success: true, message: 'Sample data refreshed successfully' });
  }

  // 13. Public Vacancies & Viewing Bookings
  if (pathname === '/api/public/vacancies' && method === 'GET') {
    const vacancies = DB.units.filter(u => u.status === 'vacant').map(v => {
      const prop = DB.properties.find(p => p.id === v.property_id) || {};
      let bedrooms = 2;
      let bathrooms = 2;
      let sqft = 1100;
      let photo = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80';
      let higgsfield = {
        mode: 'dolly',
        rig: 'Interior Tracking Glide (35mm Cine)',
        fps: 24,
        lighting: 'Golden hour ambient diffusion (3200K)',
        prompt: 'Dolly forward through sunlit living room with teak finishes, open balcony overlooking gardens, natural light, 35mm lens, steadycam 24fps glide, photorealistic.'
      };

      if (v.unit_type.includes('Commercial') || v.unit_type.includes('Office')) {
        bedrooms = 0; bathrooms = 1; sqft = 650;
        photo = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80';
        higgsfield = {
          mode: 'pan',
          rig: 'Pedestal Horizontal Pan (24mm Cine)',
          fps: 24,
          lighting: 'Cool executive daylight & recessed LED ceiling glow',
          prompt: 'Slow horizontal pedestal pan across open-plan executive commercial office suite, glass partition reflections, panoramic city view, 24fps smooth pan.'
        };
      } else if (v.unit_type.includes('3-Bedroom') || v.unit_type.includes('DSQ')) {
        bedrooms = 3; bathrooms = 3; sqft = 1650;
        photo = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80';
        higgsfield = {
          mode: 'dolly',
          rig: 'Steadicam Dolly In (35mm Anamorphic)',
          fps: 24,
          lighting: 'Warm afternoon golden hour ambient diffusion',
          prompt: 'Dolly forward through sunlit living room with teak dining finishes, open balcony overlooking lush gardens, natural volumetric light, 35mm lens, photorealistic.'
        };
      } else if (v.unit_type.includes('Townhouse') || v.unit_type.includes('Villa')) {
        bedrooms = 4; bathrooms = 4.5; sqft = 3200;
        photo = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80';
        higgsfield = {
          mode: 'aerial',
          rig: 'Cinema Drone 3D Arc Pullback',
          fps: 24,
          lighting: 'Sunset golden hour with warm interior window glow',
          prompt: 'Cinematic drone aerial pullback, 4k ultra-high definition, slow smooth arc revealing modern luxury villa at golden hour, private manicured lawn, warm ambient interior lighting visible through floor-to-ceiling glass.'
        };
      }
      return {
        ...v,
        property_name: prop.name || 'Kilimani Royal Heights',
        property_type: prop.property_type || 'Residential',
        address: prop.address || 'Nairobi',
        city: prop.city || 'Nairobi',
        bedrooms, bathrooms, sqft, photo,
        deposit: v.base_rent * 2,
        total_monthly: v.base_rent + (v.service_charge || 0) + (v.garbage_fee || 0),
        higgsfield,
        amenities: ['High-Speed Fiber', 'Borehole Water', '24/7 Manned Security', 'Backup Generator', 'Reserved Parking', 'Solar Water Heating']
      };
    });
    return json({ success: true, count: vacancies.length, vacancies });
  }

  if (pathname === '/api/public/book-viewing' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const ref = 'VIEW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    return json({ success: true, reference: ref, message: 'Viewing booked successfully. SMS dispatched.' }, 201);
  }

  // 14. WhatsApp Business Bot
  if (pathname === '/api/whatsapp/webhook' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const incoming = (b.message || b.Body || '1').trim();
    const cmd = incoming.toUpperCase();
    let reply = `Jambo Kariuki James! Your current BomaSphere balance is KES 0.00. All invoices settled. Reply 'PAY' to trigger M-Pesa prompt.`;
    if (cmd.includes('RECEIPT') || cmd === '2') {
      reply = `Official BomaSphere Receipt: REC-20261101-4912. Paid KES 71,310 via M-Pesa (QG982KLA83). Status: Reconciled.`;
    } else if (cmd.includes('PAY') || cmd === '3') {
      reply = `Daraja M-Pesa STK push initiated for KES 65,000 to handset. Enter your M-Pesa PIN on prompt.`;
    } else if (cmd.startsWith('TICKET') || cmd === '4') {
      reply = `Maintenance ticket TKT-4890 logged successfully! Our site caretaker has been notified.`;
    }
    return json({ success: true, incoming, reply, action: 'whatsapp_response' });
  }

  if (pathname === '/api/whatsapp/history' && method === 'GET') {
    return json({ success: true, messages: DB.communications.filter(c => c.type === 'whatsapp') });
  }

  // 15. AI Tenant Vetting & CRB
  if (pathname === '/api/tenant-vetting' && method === 'GET') {
    return json({ success: true, vettings: DB.vettings });
  }

  if (pathname === '/api/tenant-vetting/analyze' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const income = Number(b.monthly_income || 250000);
    const rent = 65000;
    const ratio = Number(((rent / income) * 100).toFixed(1));
    return json({
      success: true,
      applicant_name: b.applicant_name || 'Applicant',
      crb_score: ratio > 40 ? 590 : 765,
      risk_category: ratio > 40 ? 'High Risk' : 'Low Risk',
      rent_to_income_pct: ratio,
      recommendation: ratio > 40 ? 'Declined: Rent exceeds 40% threshold' : 'Approved: Clean credit history'
    }, 201);
  }

  // 16. IoT Telemetry & Leak Alerts
  if (pathname === '/api/iot/devices' && method === 'GET') {
    return json({ success: true, count: DB.iotDevices.length, devices: DB.iotDevices });
  }

  if (pathname === '/api/iot/leak-alerts' && method === 'GET') {
    return json({ success: true, count: DB.leakAlerts.length, alerts: DB.leakAlerts });
  }

  if (pathname === '/api/iot/valve-toggle' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const dev = DB.iotDevices.find(d => d.id === Number(b.device_id)) || DB.iotDevices[0];
    dev.valve_status = b.valve_status || 'open';
    return json({ success: true, message: `Smart valve status updated to ${dev.valve_status}`, device: dev });
  }

  // 17. KRA eTIMS & 7.5% MRI Tax
  if (pathname === '/api/tax/etims-summary' && method === 'GET') {
    const totalTaxable = DB.invoices.reduce((sum, i) => sum + i.rent_amount, 0);
    const totalMri = Math.round(totalTaxable * 0.075);
    return json({
      success: true,
      stats: { total_transmitted: DB.etimsRecords.length, total_taxable_rent: totalTaxable, total_mri_tax: totalMri, mri_rate: '7.5%' },
      records: DB.etimsRecords
    });
  }

  if (pathname === '/api/tax/etims/generate' && method === 'POST') {
    const code = 'KRA-ETIMS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    return json({ success: true, record: { control_code: code, qr_code_url: `https://itax.kra.go.ke/verify?code=${code}`, tax_payable: 4875 } }, 201);
  }

  // 18. Artisan Escrow Marketplace
  if (pathname === '/api/marketplace/fundis' && method === 'GET') {
    return json({ success: true, count: DB.fundis.length, fundis: DB.fundis });
  }

  if (pathname === '/api/marketplace/escrows' && method === 'GET') {
    return json({ success: true, count: DB.escrows.length, escrows: DB.escrows });
  }

  if (pathname === '/api/marketplace/escrow/allocate' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    return json({ success: true, escrow_id: 99, status: 'held', message: `KES ${Number(b.amount || 3500).toLocaleString()} locked in escrow` }, 201);
  }

  if (pathname === '/api/marketplace/escrow/release' && method === 'POST') {
    const ref = 'B2C-MPESA-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    return json({ success: true, status: 'disbursed', b2c_disbursement_ref: ref, message: `Escrow released and disbursed via M-Pesa B2C (${ref}).` });
  }

  // 19. Digital Lease Agreements & E-Signatures
  if (pathname === '/api/leases/agreements' && method === 'GET') {
    return json({ success: true, count: DB.leaseAgreements.length, agreements: DB.leaseAgreements });
  }

  if (pathname.startsWith('/api/leases/agreements/') && pathname.endsWith('/sign') && method === 'POST') {
    const id = Number(pathname.split('/')[4]);
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const agr = DB.leaseAgreements.find(a => a.id === id) || DB.leaseAgreements[0];
    agr.status = 'executed';
    agr.tenant_signature = b.signature || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50"><path d="M10 35 Q50 10 90 35 T170 30" stroke="%23059669" stroke-width="2" fill="none"/></svg>';
    agr.tenant_signed_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return json({ success: true, agreement: agr, is_executed: true, message: `Lease ${agr.agreement_code} signed and legally executed!` });
  }

  // 20. Move-In / Move-Out Inspections & Deposit Settlement
  if (pathname === '/api/inspections' && method === 'GET') {
    return json({ success: true, count: DB.inspections.length, inspections: DB.inspections });
  }

  if (pathname === '/api/inspections' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const items = b.checklist || [];
    const damages = items.reduce((s, it) => s + (Number(it.repair_cost) || 0), 0);
    const held = Number(b.deposit_held || 130000);
    const arrears = Number(b.unpaid_utility_arrears || 0);
    const net = Math.max(0, held - arrears - damages);
    const newInsp = {
      id: DB.inspections.length + 1,
      unit_id: b.unit_id || 1,
      tenant_id: b.tenant_id || 1,
      inspection_type: b.inspection_type || 'move_out',
      inspection_date: new Date().toISOString().slice(0, 10),
      inspector_name: b.inspector_name || 'John Otieno (Site Caretaker)',
      damages_total: damages,
      deposit_held: held,
      unpaid_utility_arrears: arrears,
      net_deposit_refund: net,
      status: 'completed',
      unit_number: 'A101',
      property_name: 'Kilimani Royal Heights',
      tenant_name: 'Kariuki James Mwangi',
      checklist: items
    };
    DB.inspections.unshift(newInsp);
    return json({ success: true, id: newInsp.id, damages_total: damages, net_deposit_refund: net, message: 'Inspection recorded successfully.' }, 201);
  }

  if (pathname.startsWith('/api/inspections/') && pathname.endsWith('/settle-deposit') && method === 'POST') {
    const voucher = 'REF-DEP-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    return json({ success: true, voucher_number: voucher, message: `Deposit refund settled (${voucher}) via M-Pesa B2C.` });
  }

  // 21. Gated Estate Visitor Passes & Gate QR Security
  if (pathname === '/api/visitor-passes' && method === 'GET') {
    return json({ success: true, count: DB.visitorPasses.length, passes: DB.visitorPasses });
  }

  if (pathname === '/api/visitor-passes' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const code = 'PASS-' + Math.floor(1000 + Math.random() * 9000);
    const newPass = {
      id: DB.visitorPasses.length + 1,
      pass_code: code,
      unit_id: b.unit_id || 1,
      tenant_id: b.tenant_id || 1,
      visitor_name: b.visitor_name || 'Guest',
      visitor_phone: b.visitor_phone || '+254700000000',
      vehicle_plate: b.vehicle_plate || 'KDA 000A',
      valid_date: b.valid_date || new Date().toISOString().slice(0, 10),
      time_slot: b.time_slot || '08:00 AM - 08:00 PM',
      status: 'active',
      qr_data: `BOMASPHERE:${code}:UNIT-1`,
      unit_number: 'A101',
      property_name: 'Kilimani Royal Heights',
      host_name: 'Kariuki James Mwangi'
    };
    DB.visitorPasses.unshift(newPass);
    return json({ success: true, id: newPass.id, pass_code: code, qr_data: newPass.qr_data, message: `Visitor Gate Pass ${code} generated.` }, 201);
  }

  if (pathname === '/api/visitor-passes/validate' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const pass = DB.visitorPasses.find(p => p.pass_code === b.pass_code) || DB.visitorPasses[0];
    pass.status = b.action === 'check_out' ? 'completed' : 'checked_in';
    return json({ success: true, action: b.action || 'check_in', status: pass.status, pass, message: `Pass validated for ${pass.visitor_name}.` });
  }

  // 22. Diaspora Landlord Multi-Currency Hub & ROI
  if (pathname === '/api/reports/diaspora-roi' && method === 'GET') {
    const totalValuationKES = 880000000;
    return json({
      success: true,
      fx_rates: { USD: 129.50, GBP: 168.20, EUR: 141.00 },
      portfolio_summary: {
        total_valuation_kes: totalValuationKES,
        total_valuation_usd: Math.round(totalValuationKES / 129.50),
        total_valuation_gbp: Math.round(totalValuationKES / 168.20),
        total_valuation_eur: Math.round(totalValuationKES / 141.00),
        total_annual_rent_kes: 74800000,
        average_cap_rate: '7.8%',
        average_net_yield: '8.5%'
      },
      properties: DB.properties.map(p => ({
        id: p.id,
        name: p.name,
        city: p.city,
        estimated_valuation_kes: Math.round(totalValuationKES / DB.properties.length),
        net_yield_pct: 8.5,
        cap_rate_pct: 7.8
      }))
    });
  }

  // 23. Shared Estate Amenities & Booking
  if (pathname === '/api/amenities' && method === 'GET') {
    return json({ success: true, count: DB.amenities.length, amenities: DB.amenities });
  }

  if (pathname === '/api/amenity-bookings' && method === 'GET') {
    return json({ success: true, count: DB.amenityBookings.length, bookings: DB.amenityBookings });
  }

  if (pathname === '/api/amenity-bookings' && method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch(e) {}
    const ref = 'BK-' + Math.floor(1000 + Math.random() * 9000);
    const amenity = DB.amenities.find(a => a.id === Number(b.amenity_id)) || DB.amenities[0];
    const totalFee = (amenity.hourly_fee || 0) * Number(b.hours || 3);
    const newBk = {
      id: DB.amenityBookings.length + 1,
      booking_reference: ref,
      amenity_id: amenity.id,
      tenant_id: b.tenant_id || 1,
      unit_id: b.unit_id || 1,
      booking_date: b.booking_date || new Date().toISOString().slice(0, 10),
      start_time: b.start_time || '03:00 PM',
      end_time: b.end_time || '06:00 PM',
      total_fee: totalFee,
      status: 'confirmed',
      amenity_name: amenity.name,
      unit_number: 'A101',
      tenant_name: 'Kariuki James Mwangi'
    };
    DB.amenityBookings.unshift(newBk);
    return json({ success: true, id: newBk.id, booking_reference: ref, total_fee: totalFee, amenity_name: amenity.name, message: `Booking ${ref} confirmed for ${amenity.name}.` }, 201);
  }

  // Catch-all 404 for unmatched API routes
  return json({ error: "404 Not Found: API route does not exist", path: pathname }, 404);
}
