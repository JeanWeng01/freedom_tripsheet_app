// ─── Data types (from extracted Excel data) ─────────────────────────────────

export interface Driver {
  fullName: string;
  payrollName: string;
  code3: string;
}

export interface Store {
  code: string;
  name: string;
  allowanceMinutes: number;
}

export interface RouteStop {
  type: 'mdc' | 'store';
  raw: string;
  code?: string;
  name?: string;
}

export interface Route {
  routeNumber: number;
  day: string;
  stops: RouteStop[];
}

export interface TimeSlot {
  label: string;
  value: number;
}

// ─── Trip sheet types ────────────────────────────────────────────────────────

export type StopFlag = 'SAME DAY SPECIAL' | 'MISSING CALL' | 'OFF DAY CALL' | 'CHEESE OFF DAY';

export type MDCArrivingWith = 'Bobtail' | 'SR trailer' | 'Linehaul trailer';
export type MDCLeavingWith = 'Bobtail' | 'SR trailer' | 'Linehaul trailer';

export type StopType = 'sr' | 'lh' | 'mdc' | 'segment';

export interface BaseStop {
  id: string;
  type: StopType;
  arrivalTime: number | null;
  departureTime: number | null;
  hubReading: string;
  trailerNumber: string;
  reeferTemp: string;
  bolNumber: string;
  comment: string;
  skipped: boolean;
  flag: StopFlag | null;
}

export interface SRStop extends BaseStop {
  type: 'sr';
  storeCode: string;
  storeName: string;
  allowanceMinutes: number;
  isOffDayCall: boolean;
}

export interface LHStop extends BaseStop {
  type: 'lh';
  locationName: string;
}

export interface MDCStop extends BaseStop {
  type: 'mdc';
  arrivingWith: MDCArrivingWith | null;
  leavingWith: MDCLeavingWith | null;
  transitionTime: number | null;
  specialActivity: 'MDC - additional SR trailer' | 'LH location - pick or drop - see LH tab' | 'Shunting' | 'Yard Management' | null;
}

export interface SegmentStop {
  id: string;
  type: 'segment';
  routeNumber: string;
}

export type TripStop = SRStop | LHStop | MDCStop | SegmentStop;

export interface TripHeader {
  driverName: string;
  driverCode3: string;
  routeNumber: string;
  date: string;
  dayOfWeek: string;
  plateNumber: string;
  tractorNumber: string;
  startingHub: string;
  finishingHub: string;
  clockInTime: number | null;
}

// ─── LH Requisition ──────────────────────────────────────────────────────────

export interface LHLeg {
  id: string;
  trailerNumber: string;
  departureLocation: string;
  destinationLocation: string;
  scheduledDepartureTime: number | null;
  actualDepartureTime: number | null;
  arrivalTime: number | null;
  weightKg: string;
}

export interface LHDeliveryRow {
  id: string;
  agentNameRoute: string;
  casesDelivered: string;
  palletsDelivered: string;
  casesReturned: string;
  palletsReturned: string;
}

export interface LHRequisition {
  legs: LHLeg[];
  tempTrailerDeparture: string;
  tempTrailerArrival: string;
  tempWarehouse: string;
  deliveries: LHDeliveryRow[];
  waitTimeLocation: string;
  scheduledDepartureTime: number | null;
  officialDepartureTime: number | null;
  totalWaitTimeClaim: string;
  waitTimeReasons: {
    warehouseMaintenance: boolean;
    lateLoading: boolean;
    trailerMaintenance: boolean;
    waitingForPaperwork: boolean;
    backOrders: boolean;
    other: boolean;
  };
  additionalComments: string;
}

export interface TripSheet {
  id: string;
  header: TripHeader;
  stops: TripStop[];
  lhRequisition: LHRequisition;
  photoCount: number;
  submittedAt: string | null;
}

// ─── App state ───────────────────────────────────────────────────────────────

export type AppScreen = 'driver-select' | 'route-select' | 'trip-sheet' | 'submit-confirm';

export interface ValidationResult {
  hardBlocks: string[];
  softWarnings: string[];
}
