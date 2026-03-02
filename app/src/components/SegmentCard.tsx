import { GripVertical, Trash2 } from 'lucide-react';
import type { SegmentStop } from '../types';

interface Props {
  stop: SegmentStop;
  onChange: (updated: SegmentStop) => void;
  onDelete: () => void;
  dragHandleProps: Record<string, unknown>;
}

export default function SegmentCard({ stop, onChange, onDelete, dragHandleProps }: Props) {
  return (
    <div className="flex items-center gap-2 px-2 py-2.5 border border-dashed border-slate-600/60 rounded-xl bg-slate-800/20">
      <div
        {...dragHandleProps}
        className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 touch-none"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">
        New Route
      </span>

      <input
        type="text"
        value={stop.routeNumber}
        onChange={e => onChange({ ...stop, routeNumber: e.target.value })}
        placeholder="Route #"
        className="flex-1 min-w-0 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
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
