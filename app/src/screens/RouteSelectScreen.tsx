import { useState, useMemo } from 'react';
import { ChevronLeft, MapPin, Navigation, Plus } from 'lucide-react';
import type { Driver, TripSheet } from '../types';
import { getRoutesForDay, buildStopsFromRoute, buildOffDayStops, generateTripId, makeEmptyLHRequisition } from '../utils/tripUtils';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const OFF_DAY_ROUTES = [1555, 1575, 2609];

interface Props {
  driver: Driver;
  onBack: () => void;
  onStart: (trip: TripSheet) => void;
}

export default function RouteSelectScreen({ driver, onBack, onStart }: Props) {
  const today = new Date();
  const todayDay = DAYS[today.getDay()];
  const [search, setSearch] = useState('');
  const [offDayRoute, setOffDayRoute] = useState<number | null>(null);
  const [pendingTrip, setPendingTrip] = useState<TripSheet | null>(null);

  const availableRoutes = useMemo(() => getRoutesForDay(todayDay), [todayDay]);
  const filtered = useMemo(() => {
    if (!search.trim()) return availableRoutes;
    return availableRoutes.filter(r => String(r.routeNumber).includes(search));
  }, [availableRoutes, search]);

  function buildTrip(routeNum: string, stops: TripSheet['stops']): TripSheet {
    return {
      id: generateTripId(driver.code3, today),
      header: {
        driverName: driver.fullName,
        driverCode3: driver.code3,
        routeNumber: routeNum,
        date: today.toISOString().split('T')[0],
        dayOfWeek: todayDay,
        plateNumber: '', tractorNumber: '',
        startingHub: '', finishingHub: '',
        clockInTime: null,
      },
      stops,
      lhRequisition: makeEmptyLHRequisition(),
      photos: [],
      submittedAt: null,
    };
  }

  const dateStr = today.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col h-dvh bg-slate-900">
      <div className="px-4 pt-10 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="flex items-center gap-1 text-slate-400 text-sm -ml-1 p-1">
            <ChevronLeft className="w-4 h-4" />Back
          </button>
          <img src="/logo.png" alt="Freedom Transportation" className="h-8" />
        </div>
        <div className="text-slate-400 text-sm mb-1">{driver.fullName}</div>
        <h1 className="text-2xl font-bold text-white">Select your route</h1>
        <p className="text-slate-400 text-sm mt-1">{dateStr}</p>
      </div>

      <div className="px-4 pb-3 flex-shrink-0">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="number"
            placeholder="Search route number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-base"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
        {/* Pure Line Haul — for drivers with no pre-built route */}
        <button
          onClick={() => setPendingTrip(buildTrip('LH', []))}
          className="w-full flex items-center gap-4 px-5 py-4 bg-blue-950/30 hover:bg-blue-950/50 border border-blue-800/40 rounded-xl transition-colors text-left"
        >
          <div className="w-16 h-12 bg-blue-900/30 rounded-xl flex items-center justify-center border border-blue-800/30 flex-shrink-0">
            <Navigation className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-blue-300 font-semibold">Pure Line Haul</div>
            <div className="text-slate-500 text-xs mt-0.5">No pre-built route — add lines as you go</div>
          </div>
          <span className="text-slate-600 flex-shrink-0 text-lg">›</span>
        </button>

        <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 pb-1">
          {todayDay} routes ({filtered.length})
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            {search ? `No route matching "${search}"` : `No planned routes for ${todayDay}`}
          </div>
        )}

        {filtered.map(route => (
          <button
            key={route.routeNumber}
            onClick={() => setPendingTrip(buildTrip(String(route.routeNumber), buildStopsFromRoute(route)))}
            className="w-full flex items-center gap-4 px-5 py-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 hover:border-blue-600/50 rounded-xl transition-colors text-left"
          >
            <div className="w-16 h-12 bg-blue-900/40 rounded-xl flex items-center justify-center border border-blue-800/30 flex-shrink-0">
              <span className="text-blue-300 font-bold font-mono text-base">{route.routeNumber}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold">Route {route.routeNumber}</div>
              <div className="text-slate-500 text-xs mt-0.5">
                {route.stops.filter(s => s.type === 'store').length} stores ·{' '}
                {route.stops.filter(s => s.type === 'mdc').length} MDC stops
              </div>
            </div>
            <span className="text-slate-600 flex-shrink-0 text-lg">›</span>
          </button>
        ))}

        {/* Off Day Route — at bottom */}
        <div className="pt-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 pb-2">
            Off Day Route
          </div>
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4">
            <div className="flex gap-2 mb-3">
              {OFF_DAY_ROUTES.map(r => (
                <button
                  key={r}
                  onClick={() => setOffDayRoute(offDayRoute === r ? null : r)}
                  className={`flex-1 py-2.5 rounded-lg font-mono font-bold text-sm transition-colors ${
                    offDayRoute === r
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-amber-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              disabled={!offDayRoute}
              onClick={() => offDayRoute && setPendingTrip(buildTrip(String(offDayRoute), buildOffDayStops()))}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                offDayRoute
                  ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              {offDayRoute ? `Start Off Day Route ${offDayRoute}` : 'Select route number above'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {pendingTrip && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="text-white font-semibold text-lg mb-1">
              Start Route {pendingTrip.header.routeNumber}?
            </div>
            <p className="text-slate-400 text-sm mb-1">
              {driver.fullName} · {dateStr}
            </p>
            <p className="text-slate-500 text-xs mb-6">
              Your entries will save automatically as you go.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingTrip(null)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onStart(pendingTrip)}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
              >
                Start trip sheet →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
