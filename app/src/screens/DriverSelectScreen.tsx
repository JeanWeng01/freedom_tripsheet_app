import { useState, useMemo } from 'react';
import { Search, Truck } from 'lucide-react';
import type { Driver } from '../types';
import driversData from '../data/drivers.json';

const drivers = driversData as Driver[];

interface Props {
  onSelect: (driver: Driver) => void;
}

export default function DriverSelectScreen({ onSelect }: Props) {
  const [query, setQuery] = useState('');

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
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-blue-600 rounded-xl p-2">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">
            Freedom Transportation
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white mt-3">Who's driving today?</h1>
        <p className="text-slate-400 text-sm mt-1">Select your name to start your trip sheet</p>
      </div>

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
