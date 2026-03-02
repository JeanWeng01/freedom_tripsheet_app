import { useState, useMemo, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { Store } from '../types';
import storesData from '../data/stores.json';

const stores = storesData as Store[];

interface Props {
  value: string;        // current store name displayed
  storeCode: string;
  onSelect: (store: Store) => void;
  placeholder?: string;
}

export default function StoreSearch({ value, storeCode, onSelect, placeholder = 'Search store code or name...' }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return stores
      .filter(s =>
        (s.code && s.code.toLowerCase().includes(q)) ||
        s.name.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [query]);

  function handleSelect(store: Store) {
    onSelect(store);
    setOpen(false);
    setQuery('');
  }

  const displayName = value || storeCode || '';

  return (
    <div ref={ref} className="relative">
      {/* Current value / trigger */}
      <button
        type="button"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={`w-full flex items-start gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
          displayName
            ? 'bg-slate-700 border-slate-600 text-white'
            : 'bg-slate-700/50 border-slate-600 border-dashed text-slate-400 hover:border-slate-500'
        }`}
      >
        <Search className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
        <span className="flex-1 min-w-0">
          {displayName ? (
            <>
              {storeCode && <span className="font-mono text-blue-400 text-xs mr-1">{storeCode}</span>}
              <span className="break-words">{value}</span>
            </>
          ) : (
            placeholder
          )}
        </span>
      </button>

      {/* Search dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-slate-800 border border-slate-600 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type code (e.g. WM3130) or name..."
                className="w-full pl-8 pr-3 py-2 bg-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {query.trim() === '' && (
              <div className="px-3 py-3 text-slate-500 text-sm">
                Start typing a store code (e.g. <span className="font-mono text-slate-400">C1261</span>) or name
              </div>
            )}
            {query.trim() !== '' && results.length === 0 && (
              <div className="px-3 py-3 text-slate-500 text-sm">No matches for "{query}"</div>
            )}
            {results.map((store, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(store)}
                className="w-full px-3 py-2.5 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
              >
                <div className="flex items-start gap-2">
                  {store.code && (
                    <span className="font-mono text-blue-400 text-xs bg-blue-900/30 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                      {store.code}
                    </span>
                  )}
                  <span className="text-white text-sm flex-1 min-w-0 break-words">{store.name}</span>
                  <span className="text-slate-500 text-xs flex-shrink-0 mt-0.5">{store.allowanceMinutes}min</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
