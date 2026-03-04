import { useState, useRef } from 'react';
import { Navigation, Trash2, GripVertical } from 'lucide-react';
import type { LHLegStop } from '../types';
import TimeSelect from './TimeSelect';
import { minutesToLabel } from '../utils/tripUtils';
import { vibrate } from '../utils/haptics';

interface Props {
  stop: LHLegStop;
  legNumber: number;
  onChange: (updated: LHLegStop) => void;
  onDelete?: () => void;
  dragHandleProps?: Record<string, unknown>;
}

export default function LHLegCard({ stop, legNumber, onChange, onDelete, dragHandleProps }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  function handleCollapse() {
    vibrate();
    setExpanded(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const keyDiv = cardRef.current?.parentElement?.parentElement;
      const prevKeyDiv = keyDiv?.previousElementSibling;
      const scrollTarget = prevKeyDiv?.children[1] ?? cardRef.current;
      scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function update(patch: Partial<LHLegStop>) {
    onChange({ ...stop, ...patch });
  }

  const depLabel = stop.departureLocation || null;
  const destLabel = stop.destinationLocation || null;
  const hasDepTime = stop.departureTime !== null;
  const hasArrTime = stop.arrivalTime !== null;

  return (
    <div ref={cardRef} className="border rounded-2xl overflow-hidden border-emerald-800/50 bg-emerald-950/20">
      {/* Card header */}
      <div className="flex items-start gap-1 px-2 py-3">

        {/* Drag handle */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="flex-shrink-0 mt-0.5 p-1.5 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 touch-none"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Clickable info area */}
        <div
          className="flex-1 min-w-0 cursor-pointer select-none"
          onClick={() => { setExpanded(!expanded); setShowDeleteConfirm(false); }}
        >
          {/* Badge row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <Navigation className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="text-sm px-1.5 py-0.5 rounded border border-emerald-800/50 text-emerald-500 font-medium">
              Line {legNumber}
            </span>
          </div>

          {/* Locations */}
          <div className="font-medium text-base text-white">
            <span className={!depLabel ? 'text-slate-500 italic' : ''}>{depLabel || 'Dep. location →'}</span>
            <span className="text-slate-500 mx-1">→</span>
            <span className={!destLabel ? 'text-slate-500 italic' : ''}>{destLabel || 'Dest. location'}</span>
          </div>

          {/* Time summary */}
          <div className="flex items-center gap-2 mt-0.5 text-base flex-wrap">
            {hasDepTime && (
              <span className="text-green-500">dep {minutesToLabel(stop.departureTime!)}</span>
            )}
            {hasArrTime && (
              <span className="text-green-500">arr {minutesToLabel(stop.arrivalTime!)}</span>
            )}
            {!hasDepTime && !hasArrTime && (
              <span className="text-amber-600/70">⏱ tap to log times</span>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <div
          className="text-slate-600 flex-shrink-0 mt-1 px-1 cursor-pointer text-sm"
          onClick={() => { setExpanded(!expanded); setShowDeleteConfirm(false); }}
        >
          {expanded ? '▲' : '▼'}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">

          {/* Departure row */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Departure</label>
            <div className="grid grid-cols-[65%_35%] gap-2 items-center">
              <input
                type="text"
                value={stop.departureLocation}
                onChange={e => update({ departureLocation: e.target.value })}
                placeholder="From location"
                className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-600"
              />
              <TimeSelect
                value={stop.departureTime}
                onChange={v => update({ departureTime: v })}
                placeholder="Dep time"
                compact
              />
            </div>
          </div>

          {/* Destination row */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Destination</label>
            <div className="grid grid-cols-[65%_35%] gap-2 items-center">
              <input
                type="text"
                value={stop.destinationLocation}
                onChange={e => update({ destinationLocation: e.target.value })}
                placeholder="To location"
                className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-600"
              />
              <TimeSelect
                value={stop.arrivalTime}
                onChange={v => update({ arrivalTime: v })}
                placeholder="Arr time"
                compact
              />
            </div>
          </div>

          {/* Trailer # / Bobtail / Hub */}
          <div className="grid grid-cols-[40%_25%_35%] gap-2">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Trailer #</label>
              <input
                type="text"
                value={stop.trailerNumber}
                onChange={e => update({ trailerNumber: e.target.value })}
                placeholder="T—"
                className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => update({ trailerNumber: stop.trailerNumber === 'Bobtail' ? '' : 'Bobtail' })}
                className={`w-full px-1 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                  stop.trailerNumber === 'Bobtail'
                    ? 'border-slate-500 bg-slate-600 text-white'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                Bobtail
              </button>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Hub km</label>
              <input
                type="text"
                value={stop.hubReading}
                onChange={e => update({ hubReading: e.target.value })}
                placeholder="km at destination"
                className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Delete / collapse */}
          {showDeleteConfirm ? (
            <div className="border border-slate-700 rounded-xl p-3 bg-slate-800/50">
              <p className="text-sm text-slate-400 mb-2">Remove this line?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 text-sm py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex-1 text-sm py-2 rounded-lg border border-red-800/50 bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors"
                >
                  Delete line
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleCollapse}
                className="text-slate-600 hover:text-slate-400 transition-colors px-2 py-1 text-sm"
              >
                ▲ collapse
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg border border-slate-700 text-red-400/60 hover:text-red-400 hover:border-red-800/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove line
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
