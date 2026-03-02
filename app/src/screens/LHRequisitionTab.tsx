import { Plus, Trash2 } from 'lucide-react';
import type { LHRequisition, LHLeg, TripHeader } from '../types';
import TimeSelect from '../components/TimeSelect';
import { makeLHLeg } from '../utils/tripUtils';

interface Props {
  req: LHRequisition;
  tripHeader: TripHeader;
  onChange: (r: LHRequisition) => void;
}

export default function LHRequisitionTab({ req, tripHeader, onChange }: Props) {
  function update(patch: Partial<LHRequisition>) {
    onChange({ ...req, ...patch });
  }

  function updateLeg(index: number, patch: Partial<LHLeg>) {
    const legs = [...req.legs];
    legs[index] = { ...legs[index], ...patch };
    update({ legs });
  }

  function addLeg() {
    update({ legs: [...req.legs, makeLHLeg()] });
  }

  function removeLeg(index: number) {
    update({ legs: req.legs.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4">

      {/* Auto-filled header */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div>
            <span className="text-slate-500 text-xs">Driver </span>
            <span className="text-white font-medium">{tripHeader.driverName.split(' ')[0]}</span>
          </div>
          <div>
            <span className="text-slate-500 text-xs">Route </span>
            <span className="text-white font-medium">{tripHeader.routeNumber}</span>
          </div>
          <div>
            <span className="text-slate-500 text-xs">Date </span>
            <span className="text-white font-medium">{tripHeader.date}</span>
          </div>
          {tripHeader.tractorNumber && (
            <div>
              <span className="text-slate-500 text-xs">Tractor </span>
              <span className="text-white font-medium">{tripHeader.tractorNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* Trip legs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Trip Lines
          </div>
          {req.legs.length < 10 && (
            <button
              onClick={addLeg}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />Add line
            </button>
          )}
        </div>

        <div className="space-y-3">
          {req.legs.map((leg, i) => (
            <div key={leg.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Line {i + 1}</span>
                {req.legs.length > 1 && (
                  <button
                    onClick={() => removeLeg(i)}
                    className="text-red-400/60 hover:text-red-400 p-1 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Trailer # / Bobtail */}
              <div className="grid grid-cols-[65%_35%] gap-2">
                <input
                  type="text"
                  value={leg.trailerNumber}
                  onChange={e => updateLeg(i, { trailerNumber: e.target.value })}
                  placeholder="Trailer #"
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => updateLeg(i, { trailerNumber: leg.trailerNumber === 'Bobtail' ? '' : 'Bobtail' })}
                  className={`w-full px-2 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    leg.trailerNumber === 'Bobtail'
                      ? 'border-slate-500 bg-slate-600 text-white'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  Bobtail
                </button>
              </div>

              {/* Departure row */}
              <div className="grid grid-cols-[65%_35%] gap-2 items-center">
                <input
                  type="text"
                  value={leg.departureLocation}
                  onChange={e => updateLeg(i, { departureLocation: e.target.value })}
                  placeholder="Departure location"
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <TimeSelect
                  value={leg.actualDepartureTime}
                  onChange={v => updateLeg(i, { actualDepartureTime: v })}
                  placeholder="Dep time"
                  compact
                />
              </div>

              {/* Destination row */}
              <div className="grid grid-cols-[65%_35%] gap-2 items-center">
                <input
                  type="text"
                  value={leg.destinationLocation}
                  onChange={e => updateLeg(i, { destinationLocation: e.target.value })}
                  placeholder="Destination location"
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <TimeSelect
                  value={leg.arrivalTime}
                  onChange={v => updateLeg(i, { arrivalTime: v })}
                  placeholder="Arr time"
                  compact
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
