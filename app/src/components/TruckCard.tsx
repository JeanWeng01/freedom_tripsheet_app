import { GripVertical, Trash2, Truck } from 'lucide-react';
import type { TruckStop } from '../types';

interface Props {
  stop: TruckStop;
  onChange: (updated: TruckStop) => void;
  onDelete: () => void;
  dragHandleProps: Record<string, unknown>;
}

export default function TruckCard({ stop, onChange, onDelete, dragHandleProps }: Props) {
  return (
    <div className="flex items-center gap-2 px-2 py-2.5 border border-yellow-700/50 rounded-xl bg-yellow-950/20">
      <div
        {...dragHandleProps}
        className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 touch-none"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <Truck className="w-4 h-4 text-yellow-600 flex-shrink-0" />

      <span className="text-sm font-semibold text-yellow-700 uppercase tracking-wider flex-shrink-0">
        New Truck
      </span>

      <input
        type="text"
        value={stop.tractorNumber}
        onChange={e => onChange({ ...stop, tractorNumber: e.target.value })}
        placeholder="Tractor #"
        className="flex-1 min-w-0 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-base placeholder-slate-600 focus:outline-none focus:border-yellow-600"
      />

      <button
        type="button"
        onClick={onDelete}
        className="flex-shrink-0 text-slate-600 hover:text-red-400 p-1 rounded transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
