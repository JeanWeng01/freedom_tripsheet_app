import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Building2, Trash2, TriangleAlert, GripVertical } from 'lucide-react';
import type { MDCStop, MDCArrivingWith, MDCLeavingWith } from '../types';
import TimeSelect from './TimeSelect';
import { getMDCAllowance, minutesToLabel } from '../utils/tripUtils';
import { vibrate } from '../utils/haptics';

const ARRIVING_OPTIONS: MDCArrivingWith[] = ['Bobtail', 'SR trailer', 'Linehaul trailer'];
const LEAVING_OPTIONS: MDCLeavingWith[] = ['Bobtail', 'SR trailer', 'Linehaul trailer'];

const SPECIAL_ACTIVITIES = [
  'MDC - additional SR trailer',
  'LH location - pick or drop - see LH tab',
  'Shunting',
  'Yard Management',
] as const;

interface Props {
  stop: MDCStop;
  index: number;
  onChange: (updated: MDCStop) => void;
  onDelete: () => void;
  dragHandleProps: Record<string, unknown>;
  trailerMismatch: string | null;
  isOverAllowance: boolean;
}

export default function MDCCard({ stop, index: _index, onChange, onDelete, dragHandleProps, trailerMismatch, isOverAllowance }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [showSpecial, setShowSpecial] = useState(!!stop.specialActivity);
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

  function update(patch: Partial<MDCStop>) {
    onChange({ ...stop, ...patch });
  }

  const isSRtoLH = stop.arrivingWith === 'SR trailer' && stop.leavingWith === 'Linehaul trailer';
  const invalidCombo = stop.arrivingWith === 'Bobtail' && stop.leavingWith === 'Bobtail';

  let allowanceLabel = '';
  if (stop.specialActivity === 'MDC - additional SR trailer') {
    allowanceLabel = '45 min allowance';
  } else if (!stop.specialActivity && stop.arrivingWith && stop.leavingWith && !invalidCombo) {
    const a = getMDCAllowance(stop.arrivingWith, stop.leavingWith);
    if (a.isSplit) {
      allowanceLabel = `30 min SR + 15 min LH`;
    } else {
      allowanceLabel = `${a.total} min allowance`;
    }
  }

  const headerLabel = stop.specialActivity
    ? stop.specialActivity
    : stop.arrivingWith && stop.leavingWith
      ? `${stop.arrivingWith} → ${stop.leavingWith}`
      : 'MDC Stop';

  return (
    <div ref={cardRef} className="border border-blue-800/50 bg-blue-950/20 rounded-2xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-1 px-2 py-3">

        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="flex-shrink-0 p-1.5 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 touch-none"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Clickable info area */}
        <div
          className="flex-1 min-w-0 cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span className="text-sm font-bold text-blue-400 uppercase tracking-wider">MDC</span>
            <span className="text-slate-300 text-base font-medium truncate">{headerLabel}</span>
            {invalidCombo && <TriangleAlert className="w-3.5 h-3.5 text-amber-400" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-base flex-wrap">
            {stop.arrivalTime !== null && (
              <span className="text-green-500">→ {minutesToLabel(stop.arrivalTime)}</span>
            )}
            {stop.departureTime !== null && (
              <span className={isOverAllowance ? 'text-orange-400' : 'text-green-500'}>
                {minutesToLabel(stop.departureTime)} →{isOverAllowance && ' ⚠'}
              </span>
            )}
            {allowanceLabel && <span className="text-blue-600">· {allowanceLabel}</span>}
          </div>
        </div>

        {/* Expand chevron */}
        <div
          className="text-slate-500 flex-shrink-0 px-1 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Trailer mismatch warning */}
      {trailerMismatch && (
        <div className="mx-3 mb-2 px-3 py-2 bg-amber-900/30 border border-amber-700/50 rounded-xl flex items-start gap-2">
          <TriangleAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-amber-300">{trailerMismatch}</span>
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-blue-900/40 pt-3">

          {/* Special activity toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Activity type</span>
            <button
              type="button"
              onClick={() => {
                setShowSpecial(!showSpecial);
                if (showSpecial) update({ specialActivity: null });
              }}
              className={`text-sm px-2.5 py-1 rounded-lg border transition-colors ${
                showSpecial
                  ? 'border-purple-600 bg-purple-900/30 text-purple-300'
                  : 'border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              {showSpecial ? 'Special activity ✓' : 'Special activity'}
            </button>
          </div>

          {showSpecial ? (
            <div className="space-y-2">
              {stop.specialActivity ? (
                /* Collapsed — show only the selected activity */
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-xl border border-purple-500 bg-purple-900/40 text-purple-200 text-base font-medium">
                    {stop.specialActivity}
                  </div>
                  <button
                    type="button"
                    onClick={() => update({ specialActivity: null })}
                    className="text-sm px-2.5 py-2 rounded-lg border border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                /* Expanded — show all 4 options to pick from */
                <div className="grid grid-cols-1 gap-2">
                  {SPECIAL_ACTIVITIES.map(act => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => update({ specialActivity: act, arrivingWith: null, leavingWith: null })}
                      className="px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 text-base text-left transition-colors"
                    >
                      {act}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Arriving with */}
              <div>
                <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Arriving with
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ARRIVING_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        const patch: Partial<MDCStop> = { arrivingWith: opt };
                        if (opt !== 'SR trailer' || stop.leavingWith !== 'Linehaul trailer') {
                          patch.transitionTime = null;
                        }
                        update(patch);
                      }}
                      className={`py-2.5 px-1 rounded-xl border text-sm font-medium transition-colors text-center ${
                        stop.arrivingWith === opt
                          ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Leaving with */}
              <div>
                <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Leaving with
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LEAVING_OPTIONS.map(opt => {
                    const isInvalid = stop.arrivingWith === 'Bobtail' && opt === 'Bobtail';
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={isInvalid}
                        onClick={() => {
                          const patch: Partial<MDCStop> = { leavingWith: opt };
                          if (stop.arrivingWith !== 'SR trailer' || opt !== 'Linehaul trailer') {
                            patch.transitionTime = null;
                          }
                          update(patch);
                        }}
                        className={`py-2.5 px-1 rounded-xl border text-sm font-medium transition-colors text-center ${
                          isInvalid
                            ? 'border-slate-800 bg-slate-800/30 text-slate-700 cursor-not-allowed'
                            : stop.leavingWith === opt
                              ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                              : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {isInvalid ? '✕' : opt}
                      </button>
                    );
                  })}
                </div>
                {invalidCombo && (
                  <p className="text-amber-400 text-sm mt-1.5 flex items-center gap-1">
                    <TriangleAlert className="w-3 h-3" />
                    Bobtail → Bobtail doesn't happen — please select a valid combination
                  </p>
                )}
              </div>

              {/* Allowance badge */}
              {allowanceLabel && !invalidCombo && (
                <div className={`text-sm px-3 py-2 rounded-lg ${isSRtoLH ? 'bg-amber-900/30 text-amber-300 border border-amber-800/40' : 'bg-slate-800 text-slate-400'}`}>
                  {isSRtoLH ? (
                    <>30 min SR allowance + 15 min LH allowance — enter transition time below</>
                  ) : (
                    <>⏱ {allowanceLabel}</>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Times */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Times</label>
            <div className="flex gap-2">
              <TimeSelect
                value={stop.arrivalTime}
                onChange={v => update({ arrivalTime: v })}
                placeholder="Arrival"
              />
              <div className={`flex-1 ${isOverAllowance ? 'ring-2 ring-orange-500 rounded-xl' : ''}`}>
                <TimeSelect
                  value={stop.departureTime}
                  onChange={v => update({ departureTime: v })}
                  placeholder="Departure"
                />
              </div>
            </div>
            {isOverAllowance && (
              <p className="text-orange-400 text-sm mt-1.5">Over allowance — add a note explaining the wait time</p>
            )}

            {isSRtoLH && (
              <div>
                <label className="block text-sm font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                  Transition time (when SR drop ended / LH pickup began)
                </label>
                <TimeSelect
                  value={stop.transitionTime}
                  onChange={v => update({ transitionTime: v })}
                  placeholder="Transition time"
                />
                {stop.transitionTime !== null && stop.arrivalTime !== null && stop.departureTime !== null && (
                  <div className="mt-1.5 text-sm text-slate-500 space-y-0.5">
                    <div>SR drop: {minutesToLabel(stop.arrivalTime)} → {minutesToLabel(stop.transitionTime)}</div>
                    <div>LH pickup: {minutesToLabel(stop.transitionTime)} → {minutesToLabel(stop.departureTime)}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Extra fields */}
          <div className="grid grid-cols-2 gap-2">
            {stop.leavingWith !== 'Bobtail' && (
              <div>
                <label className="block text-base text-slate-400 mb-1">Trailer #</label>
                <input
                  type="text"
                  value={stop.trailerNumber}
                  onChange={e => update({ trailerNumber: e.target.value })}
                  placeholder="e.g. T4821"
                  className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-base placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
            <div>
              <label className="block text-base text-slate-400 mb-1">Hub km</label>
              <input
                type="text"
                value={stop.hubReading}
                onChange={e => update({ hubReading: e.target.value })}
                placeholder="km at destination"
                className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-base placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-base text-slate-400 mb-1">Notes</label>
            <textarea
              value={stop.comment}
              onChange={e => update({ comment: e.target.value })}
              placeholder="Add notes..."
              rows={2}
              className={`w-full px-2.5 py-2 bg-slate-800 border rounded-lg text-white text-base placeholder-slate-600 focus:outline-none resize-none ${isOverAllowance ? 'border-orange-500 focus:border-orange-400' : 'border-slate-700 focus:border-blue-500'}`}
            />
          </div>

          {/* Delete / confirmation */}
          {showDeleteConfirm ? (
            <div className="border border-slate-700 rounded-xl p-3 bg-slate-800/50">
              <p className="text-sm text-slate-400 mb-2">Remove this MDC stop?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 text-sm py-2 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex-1 text-sm py-2 rounded-lg border border-red-800/50 bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors"
                >
                  Delete stop
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
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-sm text-red-400/70 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-900/20 transition-colors"
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
