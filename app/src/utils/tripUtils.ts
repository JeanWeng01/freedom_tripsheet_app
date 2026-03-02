import type { TripStop, SRStop, LHStop, MDCStop, SegmentStop, TruckStop, MDCArrivingWith, MDCLeavingWith, Route, RouteStop, Store, LHRequisition, LHLeg, LHDeliveryRow } from '../types';
import routesData from '../data/routes.json';
import storesData from '../data/stores.json';

// Build store lookup map: code → Store
const _stores = storesData as Store[];
const storeMap: Record<string, Store> = {};
for (const s of _stores) {
  if (s.code) storeMap[s.code] = s;
}

// ─── ID generation ───────────────────────────────────────────────────────────

let idCounter = 0;
export function newId(): string {
  return `stop-${Date.now()}-${idCounter++}`;
}

/** Generate trip sheet unique ID: driverCode3 + weekdayCode + monthCode + dayCode */
// Month codes: 1–9 = Jan–Sep, O = Oct, N = Nov, D = Dec
const MONTH_CODES = ['1','2','3','4','5','6','7','8','9','O','N','D'];

export function generateTripId(driverCode3: string, date: Date): string {
  const weekdayCode = date.getDay();           // 0=Sun … 6=Sat
  const monthCode = MONTH_CODES[date.getMonth()]; // always 1 char
  const dayCode = String(date.getDate()).padStart(2, '0');
  // Format: 3-letter code + weekday(1) + month(1) + day(2) = 7 chars always
  return `${driverCode3}${weekdayCode}${monthCode}${dayCode}`;
}

// ─── Time utilities ──────────────────────────────────────────────────────────

export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function nowMinutes(): number {
  const now = new Date();
  // Round to nearest 15 min
  const raw = now.getHours() * 60 + now.getMinutes();
  return Math.round(raw / 15) * 15 % (24 * 60);
}

// ─── Default stop factories ──────────────────────────────────────────────────

export function makeSRStop(storeCode: string, storeName: string, allowanceMinutes: number, isOffDayCall = false): SRStop {
  return {
    id: newId(), type: 'sr',
    storeCode, storeName, allowanceMinutes, isOffDayCall,
    arrivalTime: null, departureTime: null,
    hubReading: '', trailerNumber: '', reeferTemp: '', bolNumber: '', comment: '',
    skipped: false, flag: null,
  };
}

export function makeLHStop(locationName = ''): LHStop {
  return {
    id: newId(), type: 'lh',
    locationName,
    arrivalTime: null, departureTime: null,
    hubReading: '', trailerNumber: '', reeferTemp: '', bolNumber: '', comment: '',
    skipped: false, flag: null,
  };
}

export function makeMDCStop(arrivingWith: MDCArrivingWith | null = null, leavingWith: MDCLeavingWith | null = null): MDCStop {
  return {
    id: newId(), type: 'mdc',
    arrivingWith, leavingWith, transitionTime: null, specialActivity: null,
    arrivalTime: null, departureTime: null,
    hubReading: '', trailerNumber: '', reeferTemp: '', bolNumber: '', comment: '',
    skipped: false, flag: null,
  };
}

export function makeSpecialMDCStop(activity: MDCStop['specialActivity']): MDCStop {
  return { ...makeMDCStop(), specialActivity: activity };
}

export function makeSegmentStop(routeNumber = ''): SegmentStop {
  return { id: newId(), type: 'segment', routeNumber };
}

export function makeTruckStop(tractorNumber = ''): TruckStop {
  return { id: newId(), type: 'truck', tractorNumber };
}

// ─── MDC allowance lookup ─────────────────────────────────────────────────────

interface MDCAllowance { sr: number; lh: number; total: number; isSplit: boolean }

export function getMDCAllowance(arriving: MDCArrivingWith, leaving: MDCLeavingWith): MDCAllowance {
  if (arriving === 'Bobtail' && leaving === 'SR trailer')
    return { sr: 30, lh: 0, total: 30, isSplit: false };
  if (arriving === 'Bobtail' && leaving === 'Linehaul trailer')
    return { sr: 0, lh: 15, total: 15, isSplit: false };
  if (arriving === 'SR trailer' && leaving === 'Bobtail')
    return { sr: 30, lh: 0, total: 30, isSplit: false };
  if (arriving === 'SR trailer' && leaving === 'SR trailer')
    return { sr: 45, lh: 0, total: 45, isSplit: false };
  if (arriving === 'SR trailer' && leaving === 'Linehaul trailer')
    return { sr: 30, lh: 15, total: 45, isSplit: true };
  if (arriving === 'Linehaul trailer' && leaving === 'Bobtail')
    return { sr: 0, lh: 15, total: 15, isSplit: false };
  if (arriving === 'Linehaul trailer' && leaving === 'SR trailer')
    return { sr: 0, lh: 45, total: 45, isSplit: false };
  if (arriving === 'Linehaul trailer' && leaving === 'Linehaul trailer')
    return { sr: 0, lh: 30, total: 30, isSplit: false };
  return { sr: 0, lh: 0, total: 0, isSplit: false };
}

// ─── Route loading ────────────────────────────────────────────────────────────

const routes = routesData as unknown as Route[];

export function getRoutesForDay(dayOfWeek: string): Route[] {
  return routes.filter(r => r.day === dayOfWeek);
}

export function getRoute(routeNumber: number, dayOfWeek: string): Route | undefined {
  return routes.find(r => r.routeNumber === routeNumber && r.day === dayOfWeek);
}

/** Convert a RouteStop into a TripStop */
function routeStopToTripStop(rs: RouteStop): TripStop {
  if (rs.type === 'mdc') {
    const raw = rs.raw;
    // Parse arriving/leaving from the MDC label
    let arrivingWith: MDCArrivingWith | null = null;
    let leavingWith: MDCLeavingWith | null = null;
    let specialActivity: MDCStop['specialActivity'] = null;

    const up = raw.toUpperCase();
    if (up.includes('ARRIVE WITH BOBTAIL') || up.includes('COME BOBTAIL FROM')) arrivingWith = 'Bobtail';
    else if (up.includes('DROP SR') || (up.includes('SR TRAILER') && up.includes('DROP'))) arrivingWith = 'SR trailer';
    else if (up.includes('DROP LH') || (up.includes('LH TRAILER') && up.includes('DROP'))) arrivingWith = 'Linehaul trailer';

    if (up.includes('TAKE SR') || up.includes('TRAILER FOR ANOTHER SR')) leavingWith = 'SR trailer';
    else if (up.includes('TAKE LH') || up.includes('TAKE LINEHAUL')) leavingWith = 'Linehaul trailer';
    else if (up.includes('LEAVE WITH BOBTAIL') || up.includes('GOING BOBTAIL')) leavingWith = 'Bobtail';

    if (raw === 'MDC - additional SR trailer') specialActivity = 'MDC - additional SR trailer';
    else if (raw.startsWith('LH location')) specialActivity = 'LH location - pick or drop - see LH tab';
    else if (raw === 'Shunting') specialActivity = 'Shunting';
    else if (raw === 'Yard Management') specialActivity = 'Yard Management';

    const mdcStop = makeMDCStop(arrivingWith, leavingWith);
    return { ...mdcStop, specialActivity };
  }

  // Store stop — look up allowance from storeMap
  const code = rs.code || '';
  const name = rs.name || rs.raw;
  const storeEntry = code ? storeMap[code] : null;
  const allowanceMinutes = storeEntry?.allowanceMinutes ?? 30;
  return makeSRStop(code, name, allowanceMinutes);
}

/** Build initial trip stop list from a planned route */
export function buildStopsFromRoute(route: Route): TripStop[] {
  return route.stops.map(routeStopToTripStop);
}

/** Build a blank trip (just MDC start/end) for off-day routes */
export function buildOffDayStops(): TripStop[] {
  return [
    makeMDCStop('Bobtail', 'SR trailer'),
    makeMDCStop('SR trailer', 'Bobtail'),
  ];
}

// ─── Stop label for display ───────────────────────────────────────────────────

export function stopDisplayName(stop: TripStop): string {
  if (stop.type === 'sr') return stop.storeName || stop.storeCode || 'Unknown store';
  if (stop.type === 'lh') return stop.locationName || 'LH Location (tap to enter)';
  if (stop.type === 'mdc') {
    if (stop.specialActivity) return stop.specialActivity;
    if (stop.arrivingWith && stop.leavingWith) {
      return `MDC — ${stop.arrivingWith} → ${stop.leavingWith}`;
    }
    return 'MDC Stop';
  }
  if (stop.type === 'segment') return `Route ${stop.routeNumber || '???'} segment`;
  if (stop.type === 'truck') return `New truck: ${stop.tractorNumber || '???'}`;
  return 'Unknown stop';
}

export function stopShortCode(stop: TripStop): string {
  if (stop.type === 'sr') return stop.storeCode || '';
  if (stop.type === 'lh') return 'LH';
  if (stop.type === 'mdc') return 'MDC';
  if (stop.type === 'segment') return '—';
  if (stop.type === 'truck') return 'TRK';
  return '';
}

// ─── LH Requisition factory ──────────────────────────────────────────────────

export function makeLHLeg(): LHLeg {
  return {
    id: newId(),
    trailerNumber: '',
    departureLocation: '',
    destinationLocation: '',
    scheduledDepartureTime: null,
    actualDepartureTime: null,
    arrivalTime: null,
    weightKg: '',
  };
}

export function makeLHDeliveryRow(): LHDeliveryRow {
  return {
    id: newId(),
    agentNameRoute: '',
    casesDelivered: '',
    palletsDelivered: '',
    casesReturned: '',
    palletsReturned: '',
  };
}

export function makeEmptyLHRequisition(): LHRequisition {
  return {
    legs: [makeLHLeg()],
    tempTrailerDeparture: '',
    tempTrailerArrival: '',
    tempWarehouse: '',
    deliveries: [makeLHDeliveryRow()],
    waitTimeLocation: '',
    scheduledDepartureTime: null,
    officialDepartureTime: null,
    totalWaitTimeClaim: '',
    waitTimeReasons: {
      warehouseMaintenance: false,
      lateLoading: false,
      trailerMaintenance: false,
      waitingForPaperwork: false,
      backOrders: false,
      other: false,
    },
    additionalComments: '',
  };
}
