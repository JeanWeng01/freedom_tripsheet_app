import { useState, useRef } from 'react';
import { MapPin, Navigation, Trash2, Flag, GripVertical } from 'lucide-react';
import type { TripStop, SRStop, LHStop, StopFlag } from '../types';
import TimeSelect from './TimeSelect';
import StoreSearch from './StoreSearch';
import { minutesToLabel } from '../utils/tripUtils';
import { vibrate } from '../utils/haptics';

const FLAGS: StopFlag[] = ['SAME DAY SPECIAL', 'MISSING CALL', 'OFF DAY CALL', 'CHEESE OFF DAY'];

const FLAG_STYLES: Record<StopFlag, string> = {
  'SAME DAY SPECIAL': 'border-orange-500 bg-orange-900/30 text-orange-300',
  'MISSING CALL': 'border-slate-600 bg-slate-800/50 text-slate-400',
  'OFF DAY CALL': 'border-yellow-600 bg-yellow-900/30 text-yellow-300',
  'CHEESE OFF DAY': 'border-pink-500 bg-pink-900/30 text-pink-300',
};

interface Props {
  stop: TripStop & (SRStop | LHStop);
  index: number;
  onChange: (updated: TripStop) => void;
  onDelete: () => void;
  onPhotoAdd: () => void;
  dragHandleProps: Record<string, unknown>;
  isOverAllowance: boolean;
  isDuplicate?: boolean;
}

export default function StopCard({
  stop, index: _index, onChange, onDelete, onPhotoAdd: _onPhotoAdd, dragHandleProps, isOverAllowance, isDuplicate,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showFlags, setShowFlags] = useState(!!stop.flag);
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

  function update(patch: Partial<TripStop>) {
    onChange({ ...stop, ...patch } as TripStop);
  }

  const isSR = stop.type === 'sr';
  const isLH = stop.type === 'lh';
  const sr = isSR ? stop as SRStop : null;
  const lh = isLH ? stop as LHStop : null;

  const displayName = isSR
    ? (sr!.storeName || sr!.storeCode || '')
    : (lh!.locationName || '');

  const hasAllTimes = stop.arrivalTime !== null && stop.departureTime !== null;
  const isMissing = stop.flag === 'MISSING CALL';

  const borderClass = isSR ? 'border-slate-700' : 'border-emerald-800/50';
  const bgClass = isSR ? 'bg-slate-800/60' : 'bg-emerald-950/20';

  return (
    <div ref={cardRef} className={`border rounded-2xl overflow-hidden ${borderClass} ${bgClass}`}>
      {/* Card header */}
      <div className="flex items-start gap-1 px-2 py-3">

        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="flex-shrink-0 mt-0.5 p-1.5 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 touch-none"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Clickable info area */}
        <div
          className="flex-1 min-w-0 cursor-pointer select-none"
          onClick={() => { setExpanded(!expanded); setShowDeleteConfirm(false); }}
        >
          {/* Badges row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            {isSR ? (
              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            )}
            {isLH && (
              <span className="text-sm px-1.5 py-0.5 rounded border border-emerald-800/50 text-emerald-500 font-medium">
                LH
              </span>
            )}
            {isDuplicate && (
              <span className="text-sm px-2 py-0.5 rounded border border-amber-600 bg-amber-900/30 text-amber-400 font-bold">
                ×2
              </span>
            )}
            {stop.flag && (
              <span className={`text-sm px-1.5 py-0.5 rounded border font-medium ${FLAG_STYLES[stop.flag]}`}>
                {stop.flag}
              </span>
            )}
          </div>

          {/* Store/location name */}
          <div className={`font-medium text-base ${isMissing ? 'line-through text-slate-500' : 'text-white'}`}>
            {isSR && sr!.storeCode && (
              <span className="font-mono text-slate-400 text-sm mr-1.5">{sr!.storeCode}</span>
            )}
            <span className={!displayName ? 'text-slate-500 italic' : ''}>
              {displayName || (isSR ? 'Select store →' : 'Enter location →')}
            </span>
          </div>

          {/* Time summary */}
          <div className="flex items-center gap-2 mt-0.5 text-base flex-wrap">
            {stop.arrivalTime !== null && (
              <span className="text-green-500">→ {minutesToLabel(stop.arrivalTime)}</span>
            )}
            {stop.departureTime !== null && (
              <span className={isOverAllowance ? 'text-orange-400' : 'text-green-500'}>
                {minutesToLabel(stop.departureTime)} →{isOverAllowance && ' ⚠'}
              </span>
            )}
            {isSR && sr!.allowanceMinutes && (
              <span className="text-slate-600">{sr!.allowanceMinutes}min</span>
            )}
            {!hasAllTimes && (
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

          {/* Location entry */}
          {isSR && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Store</label>
              <StoreSearch
                value={sr!.storeName}
                storeCode={sr!.storeCode}
                onSelect={store => update({
                  storeCode: store.code,
                  storeName: store.name,
                  allowanceMinutes: store.allowanceMinutes,
                } as Partial<SRStop>)}
              />
            </div>
          )}
          {isLH && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Location name</label>
              <input
                type="text"
                value={lh!.locationName}
                onChange={e => update({ locationName: e.target.value } as Partial<LHStop>)}
                placeholder="Destination name"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-base placeholder-slate-600 focus:outline-none focus:border-emerald-600"
              />
            </div>
          )}

          {/* Times */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Times</label>
            <div className="flex gap-2">
              <TimeSelect value={stop.arrivalTime} onChange={v => update({ arrivalTime: v })} placeholder="Arrival" />
              <div className={`flex-1 ${isOverAllowance ? 'ring-2 ring-orange-500 rounded-xl' : ''}`}>
                <TimeSelect value={stop.departureTime} onChange={v => update({ departureTime: v })} placeholder="Departure" />
              </div>
            </div>
            {isOverAllowance && (
              <p className="text-orange-400 text-sm mt-1.5">Over allowance — add a comment explaining the wait time</p>
            )}
          </div>

          {/* Fields grid — 3 columns */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-base text-slate-400 mb-1">Trailer #</label>
              <input
                type="text"
                value={stop.trailerNumber}
                onChange={e => update({ trailerNumber: e.target.value })}
                placeholder="T—"
                className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-base placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-base text-slate-400 mb-1">Reefer °C</label>
              <input
                type="text"
                value={stop.reeferTemp}
                onChange={e => update({ reeferTemp: e.target.value })}
                placeholder="°C"
                className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-base placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-base text-slate-400 mb-1">Hub km</label>
              <input
                type="text"
                value={stop.hubReading}
                onChange={e => update({ hubReading: e.target.value })}
                placeholder="km"
                className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-base placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-base text-slate-400 mb-1">Comment</label>
            <textarea
              value={stop.comment}
              onChange={e => update({ comment: e.target.value })}
              placeholder={isDuplicate && !stop.comment ? 'Second visit — why are you back? (explain here)' : 'Add notes...'}
              rows={2}
              className={`w-full px-2.5 py-2 bg-slate-800 border rounded-lg text-white text-base placeholder-slate-600 focus:outline-none resize-none ${
                isOverAllowance
                  ? 'border-orange-500 focus:border-orange-400'
                  : isDuplicate && !stop.comment
                    ? 'border-amber-600/60 focus:border-amber-500'
                    : 'border-slate-700 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Flags */}
          <div>
            <button
              type="button"
              onClick={() => setShowFlags(!showFlags)}
              className={`flex items-center gap-2 text-base px-4 py-2.5 rounded-xl border font-semibold transition-colors w-full justify-center ${
                stop.flag
                  ? 'border-orange-500 text-orange-300 bg-orange-900/30'
                  : 'border-amber-700 text-amber-400 bg-amber-900/20 hover:bg-amber-900/40 hover:border-amber-600'
              }`}
            >
              <Flag className="w-4 h-4" />
              {stop.flag ? `Flag: ${stop.flag}` : 'Add Flag'}
            </button>
            {showFlags && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {FLAGS.map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { update({ flag: stop.flag === f ? null : f }); if (stop.flag === f) setShowFlags(false); }}
                    className={`text-sm px-2.5 py-1.5 rounded-lg border transition-colors ${
                      stop.flag === f
                        ? FLAG_STYLES[f]
                        : 'border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete / confirmation */}
          {showDeleteConfirm ? (
            <div className="border border-slate-700 rounded-xl p-3 bg-slate-800/50">
              <p className="text-sm text-slate-400 mb-2">Remove this stop?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { update({ flag: 'MISSING CALL' }); setShowDeleteConfirm(false); }}
                  className="flex-1 text-sm py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Mark as Missing Call
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex-1 text-sm py-2 rounded-lg border border-red-800/50 bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors"
                >
                  Delete stop
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full mt-1.5 text-sm text-slate-600 hover:text-slate-500 py-1"
              >
                Cancel
              </button>
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
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg border border-slate-700 text-red-400/60 hover:text-red-400 hover:border-red-800/50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove stop
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
