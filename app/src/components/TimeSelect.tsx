import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { minutesToLabel, nowMinutes } from '../utils/tripUtils';
import { vibrate } from '../utils/haptics';
import timeSlotsData from '../data/timeSlots.json';

interface TimeSlot { label: string; value: number; }
const timeSlots = timeSlotsData as TimeSlot[];

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  compact?: boolean;
}

export default function TimeSelect({ value, onChange, placeholder = 'Time', compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll to current value when opened
  useEffect(() => {
    if (!open || !listRef.current) return;
    const idx = value !== null ? timeSlots.findIndex(t => t.value === value) : -1;
    if (idx >= 0) {
      const itemH = 44;
      listRef.current.scrollTop = Math.max(0, idx * itemH - 88);
    }
  }, [open, value]);

  function logNow() {
    vibrate();
    const now = nowMinutes();
    // Snap to nearest slot
    const nearest = timeSlots.reduce((prev, curr) =>
      Math.abs(curr.value - now) < Math.abs(prev.value - now) ? curr : prev
    );
    onChange(nearest.value);
    setOpen(false);
  }

  const label = value !== null ? minutesToLabel(value) : null;

  if (compact) {
    return (
      <div ref={ref} className="relative w-full">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-base font-medium transition-colors ${
            label
              ? 'bg-green-900/40 border-green-700/60 text-green-300'
              : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
          }`}
        >
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{label || placeholder}</span>
        </button>
        {open && <TimeDropdown listRef={listRef} value={value} onChange={onChange} setOpen={setOpen} onLogNow={logNow} />}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-base transition-colors ${
          label
            ? 'bg-green-900/30 border-green-700/50 text-green-300'
            : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
        }`}
      >
        <Clock className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">{label || placeholder}</span>
        {label && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(null); }}
            className="text-slate-500 hover:text-red-400 text-xs px-1"
          >
            ✕
          </button>
        )}
      </button>
      {open && <TimeDropdown listRef={listRef} value={value} onChange={onChange} setOpen={setOpen} onLogNow={logNow} />}
    </div>
  );
}

function TimeDropdown({
  listRef,
  value,
  onChange,
  setOpen,
  onLogNow,
}: {
  listRef: React.RefObject<HTMLDivElement | null>;
  value: number | null;
  onChange: (v: number | null) => void;
  setOpen: (v: boolean) => void;
  onLogNow: () => void;
}) {
  return (
    <div className="absolute z-50 top-full mt-1 left-0 w-52 bg-slate-800 border border-slate-600 rounded-xl shadow-xl overflow-hidden">
      {/* Log now */}
      <button
        type="button"
        onClick={onLogNow}
        className="w-full px-3 py-2.5 text-base font-semibold text-blue-400 hover:bg-slate-700 border-b border-slate-700 flex items-center gap-2"
      >
        <Clock className="w-3.5 h-3.5" />
        Log current time
      </button>
      {/* Time list */}
      <div ref={listRef} className="overflow-y-auto max-h-56">
        {timeSlots.map(slot => (
          <button
            key={slot.value}
            type="button"
            onClick={() => { vibrate(); onChange(slot.value); setOpen(false); }}
            className={`w-full px-3 py-2.5 text-base text-left transition-colors ${
              value === slot.value
                ? 'bg-blue-700 text-white font-semibold'
                : 'text-slate-200 hover:bg-slate-700'
            }`}
          >
            {slot.label}
          </button>
        ))}
      </div>
    </div>
  );
}
