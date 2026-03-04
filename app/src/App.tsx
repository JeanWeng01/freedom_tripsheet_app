import { useState, useEffect, useRef, useMemo } from 'react';
import type { Driver, TripSheet, AppScreen } from './types';
import DriverSelectScreen from './screens/DriverSelectScreen';
import RouteSelectScreen from './screens/RouteSelectScreen';
import TripSheetScreen from './screens/TripSheetScreen';
import SubmitScreen from './screens/SubmitScreen';
import { syncTrip, syncTripBeacon, submitTrip } from './utils/api';
import type { SubmitResult } from './utils/api';

function loadHistory(): TripSheet[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as TripSheet[];
  } catch {}
  return [];
}

function markTripSubmittedInStorage(tripId: string): void {
  try {
    const history = loadHistory();
    const idx = history.findIndex(t => t.id === tripId);
    if (idx !== -1) {
      history[idx] = { ...history[idx], submittedAt: new Date().toISOString() };
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
  } catch {}
}

const STORAGE_KEY = 'freedomTripState';
const HISTORY_KEY = 'freedomTripHistory';

interface PersistedState {
  screen: AppScreen;
  driver: Driver | null;
  trip: TripSheet | null;
}

function migrateLegacyTrip(trip: TripSheet): TripSheet {
  const stops = trip.stops.map(s => {
    if ((s as { type: string }).type === 'lh') {
      const old = s as { id: string; trailerNumber?: string; locationName?: string; departureTime?: number | null; arrivalTime?: number | null; hubReading?: string; skipped?: boolean; flag?: unknown };
      return {
        id: old.id,
        type: 'lh-leg' as const,
        trailerNumber: old.trailerNumber ?? '',
        departureLocation: '',
        destinationLocation: old.locationName ?? '',
        departureTime: old.departureTime ?? null,
        arrivalTime: old.arrivalTime ?? null,
        hubReading: old.hubReading ?? '',
        skipped: old.skipped ?? false,
        flag: null,
      };
    }
    return s;
  });
  return { ...trip, stops };
}

function loadState(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.trip) parsed.trip = migrateLegacyTrip(parsed.trip);
      return parsed;
    }
  } catch {}
  return {};
}

function saveState(state: PersistedState) {
  try {
    // Don't persist submit-confirm screen — always restart fresh after submit
    const toSave = state.screen === 'submit-confirm'
      ? { ...state, screen: 'driver-select' as AppScreen, trip: null }
      : state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
}

function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function archiveTrip(t: TripSheet) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: TripSheet[] = raw ? JSON.parse(raw) : [];
    history.unshift(t);
    if (history.length > 10) history.splice(10);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export default function App() {
  const saved = loadState();

  const [screen, setScreen] = useState<AppScreen>(
    // Restore to trip-sheet if there was an in-progress trip
    saved.screen === 'trip-sheet' && saved.trip ? 'trip-sheet' : 'driver-select'
  );
  const [driver, setDriver] = useState<Driver | null>(saved.driver ?? null);
  const [trip, setTrip] = useState<TripSheet | null>(saved.trip ?? null);
  const [submittedTrip, setSubmittedTrip] = useState<TripSheet | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [retryingPending, setRetryingPending] = useState(false);

  const history = useMemo(() => loadHistory(), [historyVersion]);
  const pendingTrips = useMemo(() => history.filter(t => t.submittedAt === null), [history]);

  function markTripSubmitted(tripId: string) {
    markTripSubmittedInStorage(tripId);
    setHistoryVersion(v => v + 1);
  }

  // Auto-save to localStorage on every state change
  useEffect(() => {
    saveState({ screen, driver, trip });
  }, [screen, driver, trip]);

  // Periodic backend sync every 10s while trip is active
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (screen !== 'trip-sheet' || !trip) {
      if (syncRef.current) clearInterval(syncRef.current);
      return;
    }
    syncRef.current = setInterval(() => {
      if (trip) syncTrip(trip);
    }, 10_000);
    return () => {
      if (syncRef.current) clearInterval(syncRef.current);
    };
  }, [screen, trip]);

  // Sync immediately when app is backgrounded (visibilitychange: hidden)
  const tripRef = useRef<typeof trip>(trip);
  tripRef.current = trip;
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === 'hidden' && tripRef.current) {
        syncTrip(tripRef.current);
      }
    }
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // Beacon sync on page unload (covers hard close / OS kill)
  useEffect(() => {
    function onPageHide() {
      if (tripRef.current) syncTripBeacon(tripRef.current);
    }
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  // beforeunload protection is handled in TripSheetScreen (camera-aware)

  function handleDriverSelect(d: Driver) {
    setDriver(d);
    setScreen('route-select');
  }

  function handleTripStart(t: TripSheet) {
    setTrip(t);
    setScreen('trip-sheet');
  }

  function handleTripChange(t: TripSheet) {
    setTrip(t);
  }

  async function handleSubmit(t: TripSheet) {
    archiveTrip(t);
    clearState();

    let result: SubmitResult | null = null;
    try {
      result = await submitTrip(t);
      markTripSubmitted(t.id);
    } catch (e) {
      // Backend unavailable — proceed to confirm screen without download link.
      // Data is safe in localStorage history.
      console.warn('Backend submit failed:', e);
    }

    setSubmittedTrip(t);
    setSubmitResult(result);
    setScreen('submit-confirm');
  }

  async function handleRetry() {
    if (!submittedTrip) return;
    let result: SubmitResult | null = null;
    try {
      result = await submitTrip(submittedTrip);
      markTripSubmitted(submittedTrip.id);
    } catch (e) {
      console.warn('Retry submit failed:', e);
    }
    setSubmitResult(result);
  }

  async function handleRetryPending() {
    setRetryingPending(true);
    const pending = loadHistory().filter(t => t.submittedAt === null);
    for (const t of pending) {
      try {
        await submitTrip(t);
        markTripSubmittedInStorage(t.id);
      } catch {
        // one failed — continue with the rest
      }
    }
    setHistoryVersion(v => v + 1);
    setRetryingPending(false);
  }

  function handleDiscard() {
    clearState();
    setTrip(null);
    setDriver(null);
    setScreen('driver-select');
  }

  function handleGoBackToEdit() {
    setTrip(submittedTrip);
    setSubmittedTrip(null);
    setSubmitResult(null);
    setScreen('trip-sheet');
  }

  function handleNewTrip() {
    setTrip(null);
    setSubmittedTrip(null);
    setSubmitResult(null);
    setDriver(null);
    setScreen('driver-select');
  }

  return (
    <div className="min-h-dvh bg-slate-900 text-slate-100">
      {screen === 'driver-select' && (
        <DriverSelectScreen
          onSelect={handleDriverSelect}
          pendingCount={pendingTrips.length}
          onRetryPending={handleRetryPending}
          retryingPending={retryingPending}
        />
      )}
      {screen === 'route-select' && driver && (
        <RouteSelectScreen
          driver={driver}
          onBack={() => setScreen('driver-select')}
          onStart={handleTripStart}
        />
      )}
      {screen === 'trip-sheet' && trip && driver && (
        <TripSheetScreen
          trip={trip}
          onTripChange={handleTripChange}
          onSubmit={handleSubmit}
          onDiscard={handleDiscard}
        />
      )}
      {screen === 'submit-confirm' && submittedTrip && (
        <SubmitScreen
          trip={submittedTrip}
          submitResult={submitResult}
          onNewTrip={handleNewTrip}
          onRetry={handleRetry}
          onGoBack={handleGoBackToEdit}
          history={history}
        />
      )}
    </div>
  );
}
