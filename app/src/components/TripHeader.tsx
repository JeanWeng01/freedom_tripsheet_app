import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import type { TripHeader as TripHeaderType } from '../types';
import TimeSelect from './TimeSelect';
import { minutesToLabel } from '../utils/tripUtils';

interface Props {
  header: TripHeaderType;
  tripId: string;
  onChange: (updated: TripHeaderType) => void;
}

export default function TripHeader({ header, tripId, onChange }: Props) {
  const [expanded, setExpanded] = useState(true);

  function update(patch: Partial<TripHeaderType>) {
    onChange({ ...header, ...patch });
  }

  const dateLabel = new Date(header.date + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-base">{header.routeNumber} — {header.driverName.split(' ')[0]}</div>
          <div className="flex items-baseline justify-between gap-2 mt-0.5">
            <span className="text-slate-400 text-sm">{dateLabel}</span>
            <span className="text-slate-500 text-xs font-mono flex-shrink-0">#{tripId}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500 flex-wrap">
            {header.clockInTime !== null && (
              <span className="text-green-500">Clock-in: {minutesToLabel(header.clockInTime)}</span>
            )}
            {header.tractorNumber && <span>Tractor: {header.tractorNumber}</span>}
            {header.plateNumber && <span>Plate: {header.plateNumber}</span>}
          </div>
        </div>
        <div className="text-slate-500 flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded fields */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">

          {/* Clock-in time */}
          <div>
            <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              <Clock className="inline w-3 h-3 mr-1" />
              Clock-in / Pre-trip start time
            </label>
            <TimeSelect
              value={header.clockInTime}
              onChange={v => update({ clockInTime: v })}
              placeholder="Log clock-in time"
            />
          </div>

          {/* Tractor + Plate */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-base text-slate-400 mb-1">Tractor #</label>
              <input
                type="text"
                value={header.tractorNumber}
                onChange={e => update({ tractorNumber: e.target.value })}
                placeholder="123"
                className="w-full px-2.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-base text-slate-400 mb-1">Plate #</label>
              <input
                type="text"
                value={header.plateNumber}
                onChange={e => update({ plateNumber: e.target.value })}
                placeholder="e.g. ABC1234"
                className="w-full px-2.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Starting + Finishing Hub */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-base text-slate-400 mb-1">Starting hub (km)</label>
              <input
                type="text"
                value={header.startingHub}
                onChange={e => update({ startingHub: e.target.value })}
                placeholder="km"
                className="w-full px-2.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-base text-slate-400 mb-1">Finishing hub (km)</label>
              <input
                type="text"
                value={header.finishingHub}
                onChange={e => update({ finishingHub: e.target.value })}
                placeholder="km"
                className="w-full px-2.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
