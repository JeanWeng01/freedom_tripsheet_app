import type { LHRequisition, LHLegStop, TripHeader } from '../types';
import LHLegCard from '../components/LHLegCard';

interface Props {
  req: LHRequisition;
  legs: LHLegStop[];
  tripHeader: TripHeader;
  onChange: (r: LHRequisition) => void;
  onUpdateLeg: (id: string, patch: Partial<LHLegStop>) => void;
}

export default function LHRequisitionTab({ legs, tripHeader, onUpdateLeg }: Props) {
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

      {/* Trip legs — derived from trip sheet stops */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Trip Lines
          </div>
          <span className="text-xs text-slate-600">Add lines from the Trip Sheet tab</span>
        </div>

        {legs.length === 0 ? (
          <div className="text-center py-6 text-slate-600 text-sm border border-slate-800 rounded-xl">
            No LH lines yet — add them from the Trip Sheet tab
          </div>
        ) : (
          <div className="space-y-3">
            {legs.map((leg, i) => (
              <LHLegCard
                key={leg.id}
                stop={leg}
                legNumber={i + 1}
                onChange={updated => onUpdateLeg(leg.id, updated)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
