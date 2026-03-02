/**
 * Extracts all app data from the Freedom Trip Sheet Template .xlsx.
 * Outputs JSON files into src/data/.
 *
 * Run: node scripts/extract-data.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '../../Freedom Trip Sheet Template - SHARED WITH DRIVERS.xlsx');
const OUT_DIR = join(__dirname, '../src/data');

mkdirSync(OUT_DIR, { recursive: true });

const wb = XLSX.readFile(TEMPLATE_PATH, { cellFormula: false, cellHTML: false });

function sheetToRows(sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet not found: ${sheetName}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

/** Parse "CODE-FULL NAME" → { code, name } or { code: '', name: fullString } */
function parseStoreEntry(entry) {
  if (!entry || !entry.trim()) return null;
  const str = String(entry).trim();
  // Entries with codes: first segment before first "-" that looks like a short code
  // e.g. "C162-COSTCO CANADA #162 BRAMPTON" or "F9748-FRESHCO #9748 MAJOR..."
  // Some entries have no code (e.g. "YUMMY MARKET MAPLE VAUGHAN")
  const dashIdx = str.indexOf('-');
  if (dashIdx > 0 && dashIdx <= 8) {
    const code = str.substring(0, dashIdx).trim();
    const name = str.substring(dashIdx + 1).trim();
    // Valid short code: letters + digits AND must contain at least one digit (e.g. C162, F9748, FDL6283)
    if (/^[A-Za-z]+\d+[A-Za-z0-9]*$/.test(code)) {
      return { code, name };
    }
  }
  return { code: '', name: str };
}

/** Convert Excel time fraction to minutes */
function excelFractionToMinutes(frac) {
  if (!frac) return 0;
  return Math.round(Number(frac) * 24 * 60);
}

// ─── 1. SOURCES TAB ─────────────────────────────────────────────────────────

const sourcesRows = sheetToRows('Sources');
// Row 0 = header, data starts at row 1

// ── 1a. Drivers (col B=idx1 full name, col C=idx2 payroll name)
const drivers = [];
for (let i = 1; i < sourcesRows.length; i++) {
  const row = sourcesRows[i];
  const fullName = String(row[1] || '').trim();
  const payrollName = String(row[2] || '').trim();
  if (fullName && fullName !== 'Driver Names') {
    drivers.push({ fullName, payrollName });
  }
}

// ── 1b. MDC allowances (col D=idx3 label, col E=idx4 fraction-of-hour)
const mdcAllowances = {};
const mdcActivities = []; // First 16 rows of col D have MDC labels
for (let i = 1; i < Math.min(20, sourcesRows.length); i++) {
  const row = sourcesRows[i];
  const label = String(row[3] || '').trim();
  const allowFrac = row[4];
  if (label && label.startsWith('MDC') || label.startsWith('DM') || label.startsWith('LH location') || label.startsWith('Shunting') || label.startsWith('Yard')) {
    const minutes = Math.round(Number(allowFrac) * 60);
    mdcAllowances[label] = minutes;
    mdcActivities.push({ label, allowanceMinutes: minutes });
  }
}

// ── 1c. Stores by allowance (cols H-L = idx 7-11)
const ALLOW_COLS = [
  { idx: 7, minutes: 15 },
  { idx: 8, minutes: 30 },
  { idx: 9, minutes: 45 },
  { idx: 10, minutes: 60 },
  { idx: 11, minutes: 90 },
];

const storeMap = {}; // code → { code, name, allowanceMinutes }
const storeList = [];

for (const { idx, minutes } of ALLOW_COLS) {
  for (let i = 1; i < sourcesRows.length; i++) {
    const entry = String(sourcesRows[i][idx] || '').trim();
    if (!entry) continue;
    const parsed = parseStoreEntry(entry);
    if (!parsed) continue;
    const key = parsed.code || parsed.name;
    if (!storeMap[key]) {
      storeMap[key] = { code: parsed.code, name: parsed.name, allowanceMinutes: minutes };
      storeList.push({ code: parsed.code, name: parsed.name, allowanceMinutes: minutes });
    }
  }
}

// Also grab from col D (non-suck full list, rows 19+) for stores not yet captured
for (let i = 18; i < sourcesRows.length; i++) {
  const entry = String(sourcesRows[i][3] || '').trim();
  if (!entry || entry.startsWith('MDC') || entry.startsWith('DM') || entry.startsWith('LH') || entry.startsWith('Shunting') || entry.startsWith('Yard')) continue;
  const parsed = parseStoreEntry(entry);
  if (!parsed) continue;
  const key = parsed.code || parsed.name;
  if (!storeMap[key]) {
    storeMap[key] = { code: parsed.code, name: parsed.name, allowanceMinutes: 30 }; // default
    storeList.push({ code: parsed.code, name: parsed.name, allowanceMinutes: 30 });
  }
}

// ── 1d. Double-trailer info (col N=idx13 route, cols O-U=idx14-20 days)
// Days: Sunday=14, Monday=15, Tuesday=16, Wednesday=17, Thursday=18, Friday=19, Saturday=20
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const doubleTrailerMap = {}; // routeNum → { Sunday: 0/1/2, Monday: ... }

for (let i = 1; i < sourcesRows.length; i++) {
  const row = sourcesRows[i];
  const routeNum = row[13];
  if (!routeNum || typeof routeNum !== 'number') continue;
  const entry = {};
  for (let d = 0; d < 7; d++) {
    entry[DAYS[d]] = Number(row[14 + d]) || 0;
  }
  doubleTrailerMap[routeNum] = entry;
}

// ─── 2. ROUTEDATA TAB ───────────────────────────────────────────────────────

const routeRows = sheetToRows('RouteData');

// Classify each stop string
function classifyStop(stopStr) {
  const s = String(stopStr || '').trim();
  if (!s) return null;
  if (s.startsWith('MDC') || s.startsWith('DM') || s.startsWith('LH location') || s === 'Shunting' || s === 'Yard Management') {
    return { type: 'mdc', raw: s };
  }
  const parsed = parseStoreEntry(s);
  if (parsed) {
    return { type: 'store', raw: s, code: parsed.code, name: parsed.name };
  }
  return { type: 'store', raw: s, code: '', name: s };
}

// Parse MDC activity string to arriving/leaving combo
function parseMDCCombo(label) {
  const l = label.toUpperCase();
  let arriving = '', leaving = '';

  if (l.includes('ARRIVE WITH BOBTAIL') || l.includes('COME BOBTAIL')) arriving = 'Bobtail';
  else if (l.includes('DROP SR') || l.includes('SR TRAILER') && (l.includes('DROP') || l.includes('ARRIVE'))) arriving = 'SR trailer';
  else if (l.includes('DROP LH') || l.includes('LH TRAILER') && l.includes('DROP')) arriving = 'Linehaul trailer';

  if (l.includes('TAKE SR') || l.includes('TRAILER FOR ANOTHER SR') || l.includes('ADDITIONAL SR')) leaving = 'SR trailer';
  else if (l.includes('TAKE LH') || l.includes('TAKE LINEHAUL')) leaving = 'Linehaul trailer';
  else if (l.includes('LEAVE WITH BOBTAIL') || l.includes('GOING BOBTAIL') || l.includes('LEAVE WITH BT')) leaving = 'Bobtail';

  return { arriving, leaving };
}

const routes = []; // { routeNumber, day, stops: [{ type, raw, code?, name? }] }
const routeSet = new Set();

for (const row of routeRows) {
  const key = String(row[0] || '').trim();
  if (!key) continue;

  // Parse "ROUTENUM DAY"
  const parts = key.split(' ');
  if (parts.length < 2) continue;
  const routeNumber = parseInt(parts[0]);
  const day = parts.slice(1).join(' ');
  if (!DAYS.includes(day) || isNaN(routeNumber)) continue;

  // Extract stops from cols 1-11
  const stops = [];
  for (let i = 1; i <= 11; i++) {
    const stop = classifyStop(row[i]);
    if (stop) stops.push(stop);
  }

  if (stops.length === 0) continue; // skip routes with no stops for this day

  routeSet.add(routeNumber);
  routes.push({ routeNumber, day, stops });
}

// ─── 3. UNIQUE SHEET CODE TAB ───────────────────────────────────────────────

const codeRows = sheetToRows('unique sheet code');
// Row 0 = headers, Row 1 = more headers, data from row 2
const driverCodes = {}; // fullName → 3-letter code

for (let i = 2; i < codeRows.length; i++) {
  const row = codeRows[i];
  const name = String(row[0] || '').trim();
  const code3 = String(row[1] || '').trim();
  if (name && code3 && code3.length >= 2) {
    driverCodes[name] = code3;
  }
}

// Also get weekday codes (col L = idx 12)
const weekdayCodes = {}; // dayName → 0-6 number
for (let i = 2; i < codeRows.length; i++) {
  const row = codeRows[i];
  const dayName = String(row[11] || '').trim();
  const dayCode = row[12];
  if (dayName && DAYS.includes(dayName)) {
    weekdayCodes[dayName] = Number(dayCode);
  }
}

// Add driver codes to driver list
const driversEnriched = drivers.map(d => {
  const code = driverCodes[d.fullName] || '';
  return { ...d, code3: code };
});

// ─── 4. TIME SLOTS (15-min increments 12:00 AM to 11:45 PM) ─────────────────

const timeSlots = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? 'AM' : 'PM';
    const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    const value = h * 60 + m; // minutes since midnight
    timeSlots.push({ label, value });
  }
}

// ─── 5. ROUTE NUMBERS LIST ──────────────────────────────────────────────────

const routeNumbers = Array.from(routeSet).sort((a, b) => a - b);

// ─── 6. WRITE JSON FILES ────────────────────────────────────────────────────

function save(filename, data) {
  writeFileSync(join(OUT_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✓ ${filename} (${Array.isArray(data) ? data.length : Object.keys(data).length} entries)`);
}

save('drivers.json', driversEnriched);
save('stores.json', storeList);
save('routes.json', routes);
save('doubleTrailers.json', doubleTrailerMap);
save('timeSlots.json', timeSlots);
save('routeNumbers.json', routeNumbers);

console.log('\nSample data check:');
console.log('Drivers (first 5):', driversEnriched.slice(0, 5).map(d => `${d.fullName} [${d.code3}]`));
console.log('Stores (first 5):', storeList.slice(0, 5).map(s => `${s.code || '(no code)'}: ${s.name} [${s.allowanceMinutes}min]`));
console.log('Routes (first 3):', routes.slice(0, 3).map(r => `${r.routeNumber} ${r.day}: ${r.stops.length} stops`));
console.log('Route numbers:', routeNumbers.slice(0, 10));
console.log('Double trailers (1531):', doubleTrailerMap[1531]);
