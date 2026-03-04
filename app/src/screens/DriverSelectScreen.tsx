import { useState, useMemo } from 'react';
import { Search, AlertTriangle, RotateCcw, Clock, ChevronDown } from 'lucide-react';
import type { Driver, TripSheet } from '../types';
import driversData from '../data/drivers.json';

const drivers = driversData as Driver[];

interface Props {
  onSelect: (driver: Driver) => void;
  pendingCount: number;
  onRetryPending: () => Promise<void>;
  retryingPending: boolean;
  history: TripSheet[];
}

export default function DriverSelectScreen({ onSelect, pendingCount, onRetryPending, retryingPending, history }: Props) {
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return drivers;
    const q = query.toLowerCase();
    return drivers.filter(d =>
      d.fullName.toLowerCase().includes(q) ||
      d.payrollName.toLowerCase().includes(q) ||
      d.code3.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="flex flex-col h-dvh bg-slate-900 dark:bg-slate-900">
      {/* Header */}
      <div className="px-4 pt-10 pb-4 bg-slate-900">
        <div className="flex items-start justify-between">
          <div className="mb-1">
            <img src="/logo.png" alt="Freedom Transportation" className="h-16" />
          </div>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors mt-2"
            >
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">History</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white mt-3">Who's driving today?</h1>
        <p className="text-slate-400 text-sm mt-1">Select your name to start your trip sheet</p>
      </div>

      {/* History panel */}
      {showHistory && history.length > 0 && (
        <div className="px-4 pb-3">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent trips</div>
            {history.map(t => {
              const submitted = t.submittedAt !== null;
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-slate-900/50 border border-slate-700/40 rounded-lg"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${submitted ? 'bg-green-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">
                      {t.header.driverName} · Route {t.header.routeNumber}
                    </div>
                    <div className="text-xs text-slate-500">{t.header.date}</div>
                  </div>
                  <span className={`text-xs flex-shrink-0 ${submitted ? 'text-green-500' : 'text-amber-400'}`}>
                    {submitted ? 'submitted' : 'pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 pb-3 bg-slate-900">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-9 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-base"
          />
        </div>
      </div>

      {/* Pending submissions banner */}
      {pendingCount > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-amber-900/20 border border-amber-700/50 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="flex-1 text-amber-300 text-sm">
              {pendingCount} trip {pendingCount === 1 ? 'sheet' : 'sheets'} not yet submitted to server
            </p>
            <button
              onClick={onRetryPending}
              disabled={retryingPending}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 border border-amber-700/60 rounded-lg px-2.5 py-1.5 hover:bg-amber-900/30 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              <RotateCcw className={`w-3 h-3 ${retryingPending ? 'animate-spin' : ''}`} />
              {retryingPending ? 'Retrying…' : 'Retry now'}
            </button>
          </div>
        </div>
      )}

      {/* Driver list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No drivers found matching "{query}"
          </div>
        )}
        {filtered.map(driver => (
          <button
            key={driver.fullName}
            onClick={() => onSelect(driver)}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-xl transition-colors text-left"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-300 font-bold text-sm">
                {driver.code3 || driver.fullName.charAt(0)}
              </span>
            </div>
            {/* Name */}
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium truncate">{driver.fullName}</div>
              <div className="text-slate-400 text-sm">{driver.payrollName}</div>
            </div>
            {/* Code badge */}
            {driver.code3 && (
              <span className="text-xs font-mono bg-slate-700 text-slate-300 px-2 py-1 rounded-lg flex-shrink-0">
                {driver.code3}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
