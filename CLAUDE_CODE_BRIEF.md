# Freedom Transportation — Trip Sheet Web App

## Project Brief

Build a mobile-first web app (React + Next.js or Vite) that replaces a Google Sheets-based daily trip sheet template used by truck drivers at Freedom Transportation Inc. The company does grocery/retail store deliveries (Costco, Freshco, Walmart, Sobeys, Foodland) and linehaul runs out of an MDC (main distribution center) hub.

---

## Terminology

- **SR (Store/Super Route)**: Deliveries to grocery/retail stores (Costco, Freshco, Walmart, Sobeys, Foodland). Stores are mapped in the RouteData and Sources tabs of the Excel template.
- **LH (Linehaul)**: All OTHER delivery/pickup activity — other depots, pallet collection centers, partner warehouses, etc. LH locations are NOT in the Sources tab. They can be anywhere, so location names are always manually entered by the driver.
- **MDC**: Main Distribution Center — the hub where drivers pick up and drop off trailers between SR and LH runs.
- **Bobtail (BT)**: Driving without a trailer attached.
- **Off Day Route**: An entire unplanned route (not on the route map) — typically for same-day overflow orders or extra deliveries from other routes. Starts blank, driver builds entire stop list.
- **Off Day Call**: An individual unplanned store added to an otherwise planned route.
- **Double Trailer**: Some routes require two trailer loads. The driver picks up one SR trailer, delivers those stores, returns to MDC for a second SR trailer, delivers more stores. Whether a route has doubles is mapped per route per day in the Sources tab.
- **"Non-suck" stores**: Stores listed in the Sources tab with short codes (e.g., "WM3130") that expand to full names (e.g., "WAL MART SUPERCENTRE #3130 BRAMPTON"). Named because this lookup "doesn't suck" for drivers — they type a short code instead of the full name.
- **BOL**: Bill of Lading. **POD**: Proof of Delivery. Drivers need to photograph these documents.

---

## What Exists Today

Drivers currently use a Google Sheets template (attached as `Freedom_Trip_Sheet_Template_-_SHARED_WITH_DRIVERS.xlsx`). Each day, they copy the template, fill in their stops with arrival/departure times, trailer numbers, BOL numbers, etc. The sheet has complex formulas that auto-calculate wait times, flag off-day deliveries, detect duplicate stops, rank stores by wait time overage, etc. The owner then downloads these as Excel files and processes them with VBA macros for invoicing and payroll.

**Time is recorded in 15-minute increments** from 12:00 AM to 11:45 PM for ease of dropdown entry and calculation.

### Excel Template Structure

- **Trip Sheet tab** — main form (rows 1-34, columns A-Z). Driver enters name (A2), route auto-populates from C2. Stops in rows 4-20 with arrival (D), departure (E), trailer (H), reefer temp (I), BOL (J). Formulas compute time spent (N), time allowance (O), saved/extra time (P), MDC wait time (Q/R). Bottom section (rows 23-34) ranks stores by time overage and summarizes total wait time charges.
- **LH Requisition tab** — linehaul manifest form for LH runs to be manually filled in by drivers.
- **Sources tab** — lookup tables:
  - Store lists categorized by time allowance (15min / 30min / 45min / 1hr / 1.5hr)
  - Store short codes that expand to full names (the "non-suck" lookup)
  - MDC activity types
  - Driver names and codes
  - Double-trailer info per route per day (cols N-U)
- **RouteData tab** — every planned route mapped by day of week (e.g., "1531 Monday" → ordered sequence of stops including MDC pickups/drops). ~200+ route-day combinations.
- **unique sheet code tab** — generates unique 7-digit trip sheet IDs from driver code + weekday + month + day.
- **Updates tab** — change log from Nov 2024 to Feb 2026 documenting updates made by owner of this template file.

### Current Pain Points

- Drivers scroll left/right on a phone to reach all spreadsheet columns.
- No photo upload capability — BOL/POD photos are handled separately.
- Each day requires manually copying the template.
- MDC activities with mixed SR/LH work collapse into one line, making it impossible for formulas to split wait time between SR and LH billing. The owner currently infers this manually from driver comments.
- Minor formula bugs exist (e.g., cells A29-A34 sometimes show negative numbers with no store name when there are fewer wait time charges than ranking slots).

---

## What the App Should Do

### Phase 1: Driver-Facing Mobile App (BUILD THIS NOW)

#### User Flow

1. **Driver selects their name** from a searchable list (parsed from Sources tab column B).
2. **App detects today's day of week**. Driver picks one of:
   - A **planned route number** — if RouteData has a map for this route + today's day, stops are prepopulated.
   - **"Off Day Route"** — Allows driver to select either "1555" or "1575" or "2609" as the route number for their off day route. Route stops start as blank (just MDC start and MDC end). Driver builds entire stop list manually. For same-day orders, overflow, or routes not on the planned map.
3. **Trip sheet screen** — shows prepopulated (or blank) stop sequence. Driver fills in data per stop and can override anything.
4. **Driver submits** → app generates a filled-in Excel file from the original .xlsx template, uploads photos, saves all data to database.

#### Store Entry UX

- **SR stores (planned and unplanned)**: Autocomplete search from the Sources tab. Driver starts typing a short code like `WM3130` or partial name like `costco vaug`, and matching results appear:
  - **WM3130** - WAL MART SUPERCENTRE #3130 BRAMPTON
  - **C1261** - COSTCO CANADA #1261 VAUGHAN
  Driver taps to select. App stores both short code and full name. Excel output uses the full name in column C.
- **LH locations**: Plain text free-entry field. Driver types the full location name manually,doesn't require a match from any list.
- **MDC activities**: Dropdown-based (see MDC section below).

#### Stop Card Capabilities (flexibility is paramount)

Every stop is a "card" on screen. Drivers must be able to:
- **Override** any prepopulated stop (change location name).
- **Reorder** stops (drag-and-drop or move up/down buttons).
- **Skip** mark a stop as "no order." 
- **Add** new stops anywhere in the sequence.
- **Flag** stops with special tags: SAME DAY SPECIAL, MISSING CALL, OFF DAY CALL, CHEESE OFF DAY. In case of MISSING CALL, make visually distinct (dimmed/crossed out) but preserved in data so the owner can see it was planned but not delivered. When outputing onto .xslx template in the backend, such flagged stops still gets entered into column C just like the other stores, but the flag gets entered into column A of the corresponding row.
- **Enter comment** per stop (breakdowns, incidents, special instructions, wait time reasons).
- **Upload photos** for all documents at end of day.

#### Per-Stop Data Fields

- Location name (prepopulated or entered)
- Arrival time (tap to select from drop down menu with time options from 12:00 AM to 11:45 PM)
- Departure time (same)
- Trailer number
- Reefer temperature
- Hub/odometer reading
- BOL number
- Free text box for comments ( e.g. wait time reason, breakdowns, incidents, etc.)
- Special flag (optional — SAME DAY SPECIAL, MISSING CALL, CHEESE OFF DAY, OFF DAY CALL, or none)

#### Trip-Level Info (Header Section)

- Driver name (selected at start)
- Route number (selected or entered at start)
- Date (auto-detected)
- Day of week (auto-detected)
- Plate number
- Tractor number
- Starting hub odometer
- Finishing hub odometer
- Start time (clock in — tap to log)
- Finish time (clock out — tap to log)
- Unique trip sheet ID (generated using same logic as the "unique sheet code" tab: driver code + weekday + month + day)

---

### MDC Activity Handling — CRITICAL SECTION

MDC stops are different from store stops. A driver visits MDC multiple times per day to pick up and drop off trailers. Each MDC visit has implications for time allowances and wait time billing.

#### MDC Card Design

Each MDC stop is a **single card** with:
- **"Arriving with" dropdown**: Bobtail / SR trailer / Linehaul trailer
- **"Leaving with" dropdown**: Bobtail / SR trailer / Linehaul trailer
- Arrival time
- Departure time
- **Transition time** (ONLY shown when "Arriving with" = SR trailer AND "Leaving with" = Linehaul trailer — see below)
- Notes field

**Important UX note**: Use full words in the dropdowns — **Bobtail**, **SR trailer**, **Linehaul trailer** — NOT abbreviations like "BT", "SR", "LH". Drivers work at 3 AM and need enough visual difference between options to avoid selection mistakes.

**Invalid combo**: Bobtail → Bobtail does not happen in practice. Hide or disable this combination.

#### MDC Time Allowances by Combo

| Arriving with | Leaving with | Allowance | Notes |
|---|---|---|---|
| Bobtail | SR trailer | 30 min | Standard SR pickup |
| Bobtail | Linehaul trailer | 15 min | LH pickup only |
| SR trailer | Bobtail | 30 min | Standard SR drop |
| SR trailer | SR trailer | 45 min | Drop one SR, take another SR — NOT 30+30, it's 45 total |
| SR trailer | Linehaul trailer | 30 + 15 min (SPLIT) | **Special case — see below** |
| Linehaul trailer | Bobtail | 15 min | LH drop only |
| Linehaul trailer | SR trailer | 45 min | Drop LH, take SR |
| Linehaul trailer | Linehaul trailer | 30 min | Drop one LH, take another LH |

#### The SR → Linehaul Special Case

This is the ONE case where a single MDC visit gets output as **two rows** on the Excel sheet. In all other combos, the MDC visit outputs as a single row (same as the current template).

**Why it's special**: When a driver arrives at MDC with an SR trailer and leaves with a Linehaul trailer, there's SR wait time (dropping the SR trailer) and LH wait time (picking up the LH trailer) mixed together. The current single-line template can't differentiate where SR billing ends and LH billing begins.

**Solution**: When the driver selects SR trailer → Linehaul trailer, the app shows an **extra "Transition time" field** between arrival and departure. This is the moment the SR drop was complete and the LH pickup began.

- **Row 1 on Excel**: "MDC - drop SR trailer" — arrival time to transition time. 30 min allowance (SR).
- **Row 2 on Excel**: "MDC - take Linehaul trailer" — transition time to departure time. 15 min allowance (LH).

For ALL other MDC combos: single card → single Excel row → single time allowance. Existing Excel formulas stay untouched. The owner will write new Excel formulas to handle the two-row SR → LH case separately.

#### MDC Activity Labels for Excel Output

The app should output MDC location strings in the same format as the current template. Map the dropdown combos to these strings:

- Bobtail → SR trailer: "MDC - arrive with Bobtail, take SR trailer"
- Bobtail → Linehaul trailer: "MDC - arrive with Bobtail, take LH trailer"
- SR trailer → Bobtail: "MDC - drop SR trailer, leave with Bobtail"
- SR trailer → SR trailer: "MDC - drop SR trailer, take trailer for another SR"
- SR trailer → Linehaul trailer (row 1): "MDC - drop SR trailer"
- SR trailer → Linehaul trailer (row 2): "MDC - take LH trailer"
- Linehaul trailer → Bobtail: "MDC - drop LH trailer, leave with Bobtail"
- Linehaul trailer → SR trailer: "MDC - drop LH trailer, take SR trailer"
- Linehaul trailer → Linehaul trailer: "MDC - drop LH trailer, take LH trailer"

Additional MDC-type activities that should be available (these don't follow the arrival/departure combo pattern — they're special activities):
- "MDC - additional SR trailer" (mid-route return for second trailer load on double-trailer routes)
- "LH location - pick or drop - see LH tab"
- "Shunting"
- "Yard Management"

---


### Submission Validation Alerts

When the driver taps Submit, the app runs validation checks before proceeding. Alerts are **tiered** — hard blocks for definite errors, soft warnings for likely-but-not-certain issues. A driver who did everything correctly sees zero alerts. All warnings/blocks appear as a single summary checklist, not a barrage of individual popups. Driver sees all issues at once, can fix hard blocks and dismiss soft warnings with a single "Submit Anyway" tap.

**Hard Blocks (cannot submit — must fix):**

- Start time (clock-in / pre-trip time, cell D2 in template) not entered → gentle reminder: "Looks like you haven't logged your clock-in time — please enter your start time before submitting."
- Finish time not entered. NOTE: the backend should auto-populate Finish Time (cell E2 in template) from the departure time at the driver's final stop of the day. If that final departure is missing → gentle reminder: "Your last stop is missing a departure time — we need this for your finish time."
- Arrival time is AFTER departure time on the SAME stop → clear statement: "Stop #3 shows departure before arrival — this needs to be corrected."
- No tractor number or plate number entered.
- Any stop missing odometer/hub reading.
- MDC stop is missing "Arriving with" or "Leaving with" selection → "MDC stop #2 is missing the 'Leaving with' selection."
- SR trailer → Linehaul trailer MDC combo is missing the transition time → "MDC stop #4 (SR → Linehaul) is missing the transition time."

**Soft Warnings (can dismiss and submit anyway):**

- Any SR store in the stop list is NOT in that day's planned route AND has no special flag selected → "Have you flagged all irregular stores? (e.g., Off Day Call, Same Day Special)"
- Any active (non-skipped) stop is missing arrival or departure time → "Some stops are missing time entries — are any of these skipped stores with no order?"
- Fewer than 2 photo uploads total → "Have you finished taking all your BOL/POD photos?"
- Arrival time at any stop is earlier than departure time of the PREVIOUS stop → "Stop #5 arrival is earlier than Stop #4 departure — is this correct?" (This can happen legitimately but is often a typo.)
- Trip start time (clock-in) is later than first stop arrival → "Your clock-in time is after your first arrival — is this correct?"

**Finish Time logic:** The app does NOT require drivers to manually enter a separate Finish Time. Instead, the backend takes the departure time from the driver's final location and writes it to cell E2 (finish time) in the Excel output. This removes one manual step for drivers and ensures consistency.


### Excel Generation on Submit

This is THE critical feature. **Zero tolerance for errors.** The generated Excel files must be identical in structure to what drivers produce today by hand, because the owner's existing VBA macros depend on exact cell positions.

When driver submits:
1. Take the original .xlsx template as a base file.
2. Make a byte-for-byte copy.
3. Fill in ONLY the driver-input cells:
   - A2 = driver name
   - C2 = route number
   - D2 = start time, E2 = finish time
   - Rows 4-20: C = location name, D = arrival time, E = departure time, F = wait time reason, G = hub reading, H = trailer number, I = reefer temp, J = BOL number
   - A4:A20 = special flags (SAME DAY SPECIAL, etc.) if any
   - For the SR → LH split case: output as two rows, consuming two row slots
4. **ALL existing formulas in the template stay untouched** — columns L through Z, rows 23-34 summary section, all of it. The formulas calculate based on the filled-in data.
5. Save as `[MM.DD.YYYY] [ROUTE] [DriverFirstName].xlsx` . (Split driver's full name from their name selection drop down box and use only the first word in trip sheet file name.)
6. Store in a designated output folder (or upload to Google Drive / cloud storage).
7. **Verification step**: After generating the Excel file, the backend opens it programmatically, recalculates, and checks for formula errors (e.g., #REF!, #VALUE!, #N/A in cells that shouldn't have them), missing data in critical cells, or row count mismatches. If everything passes, the file goes to the output folder. If anything fails:
- The file gets moved to a separate flagged folder (not mixed in with good files).
- The owner receives a notification (email, or a simple admin dashboard showing flagged trip sheets with the error reason — e.g., "TripSheet_PFR_2026-02-28_1531.xlsx — #REF! error in cell P7, row count mismatch expected 8 stops got 9").
- The raw data is still safe in the database, so the file can be regenerated or manually corrected.
- For the prototype, just the separate flagged folder is fine. For production, an admin dashboard or email alerts.

**The owner processes these Excel files with existing VBA macros for invoicing and payroll. The VBA pipeline must see the exact same file structure it always has.**

---

### Data Storage & Reliability

**Reliability is critical. The owner's words: "The app CANNOT make any mistakes."**

Three layers of safety:
1. **Auto-save**: All trip sheet data saved to database as the driver enters it — not just on submit, but continuously (every few seconds). If the app crashes, the network drops, or the phone dies, when the driver reopens the app their in-progress trip sheet is right where they left it.
2. **Database as source of truth**: The Excel file generation happens server-side after submit. If that process fails, the raw data is still in the database — the Excel file can be regenerated any time.
3. **Immediate photo upload**: Photos get uploaded to cloud storage (S3 or local storage) immediately when taken, not held on the phone waiting for submit. So even if everything else fails, BOL photos are already safe.

Database: SQLite for prototype, PostgreSQL for production.
Store: every stop, every timestamp, every override, every photo reference. Full audit trail.

The database also enables things not possible with individual Excel files: searching across all drivers and dates, analyzing wait time patterns at specific stores, etc.

---

### Phase 2 (future): Motive Telemetry Integration

Motive is the fleet GPS/telemetry platform. This integration is an **audit aid for the owner only** — NOT the source of truth, NOT driver-facing.

- Pull geofence arrival/departure events from Motive's API.
- Display as a side-by-side comparison for the owner: driver-entered times vs Motive GPS times.
- Green = times match (within a few minutes tolerance). Yellow/Red = meaningful discrepancy.
- For MDC stops: Motive just shows one "at MDC" block. The driver's detailed breakdown (SR drop, LH pickup, etc.) falls within that Motive window — that's enough confirmation.
- Edge cases to handle gracefully:
  - **Truck breakdown / swap**: Driver switches trucks mid-day. Motive shows original truck stopped and new truck starting. Driver notes this in the app. Allow driver to change tractor number mid-trip.
  - **Unfenced new locations**: Motive has no name — fall back to GPS coordinates, reverse-geocode to address.
  - **Multiple MDC activities**: Motive sees one long MDC visit. Driver's entries detail what happened inside that window.

### Phase 3 (future): Backend Processing

- Migrate the owner's Excel VBA processing logic into backend code, including those that automate invoicing and payroll calculations.
- Start with the 80% of trips that follow normal patterns, flag edge cases for manual review.
- This is hard because of many edge cases — not a priority for now.

---

## Technical Notes

- **Mobile-first design.** Drivers use phones. Must work well on small screens. No left/right scrolling.
- **Dark/Light theme:** Match setting on driver's phone.
- **15-minute time increments** for all time entry fields.
- **Time display**: 12hr AM/PM format.
- The RouteData and Sources data from the Excel file should be loaded into the app's config/database. For the prototype, hardcode the route data. For production, build an admin interface to update routes.
- When testing: run local dev server, test on phone via local IP on same WiFi.

---

## Files

The Excel template (`Freedom_Trip_Sheet_Template_-_SHARED_WITH_DRIVERS.xlsx`) is the source of truth for:
- All route-day stop sequences (RouteData tab)
- Store lists, short codes, full names, and time allowances (Sources tab)
- Driver names and codes (Sources tab col B)
- MDC activity type strings (Sources tab col D)
- Double-trailer counts per route per day (Sources tab cols N-U)
- Unique ID generation logic (unique sheet code tab)
- The exact Excel cell layout that the VBA pipeline expects (Trip Sheet tab)

**Parse this file to extract all the data needed for the app.**

---

## Summary

The goal is: **drivers get a phone-friendly app that's easier than a spreadsheet. The owner gets the exact same Excel output they've always gotten, plus photos, plus a database of all trips, plus better MDC time tracking.**

Don't try to replicate the spreadsheet's formula logic in the app — let the actual Excel template do that work. The app is a better input method that outputs to the same Excel format.

The only one structural change from the current template: the SR → Linehaul MDC case now outputs as two rows instead of one, so the owner can properly split wait time billing. The owner will handle the Excel formula changes for this case which are not yet in the Excel template. All other MDC combos output as single rows, matching the current template exactly.
