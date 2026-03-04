import { AlertCircle, AlertTriangle } from 'lucide-react';
import type { ValidationResult } from '../types';

interface Props {
  result: ValidationResult;
  onFix: () => void;
  onSubmitAnyway: () => void;
}

export default function ValidationModal({ result, onFix, onSubmitAnyway }: Props) {
  const { hardBlocks, softWarnings } = result;
  const hasBlocks = hardBlocks.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm">
      <div className="w-full bg-slate-900 border border-slate-700 rounded-t-3xl max-h-[85dvh] flex flex-col">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        {/* Title */}
        <div className="px-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            {hasBlocks ? (
              <AlertCircle className="w-5 h-5 text-red-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            )}
            <h2 className="text-white font-semibold text-lg">
              {hasBlocks ? 'Fix these issues first' : 'A few things to check'}
            </h2>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">
            {hasBlocks
              ? `${hardBlocks.length} issue${hardBlocks.length > 1 ? 's' : ''} must be fixed before submitting`
              : 'Everything looks mostly good — review these warnings'}
          </p>
        </div>

        {/* Issue list */}
        <div className="overflow-y-auto flex-1 px-5 pb-3 space-y-2">
          {hardBlocks.map((msg, i) => (
            <div key={`block-${i}`} className="flex items-start gap-3 p-3 bg-red-950/40 border border-red-800/50 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-200 text-sm">{msg}</p>
            </div>
          ))}
          {softWarnings.map((msg, i) => (
            <div key={`warn-${i}`} className="flex items-start gap-3 p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200 text-sm">{msg}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-slate-800 space-y-2 flex-shrink-0">
          {!hasBlocks && (
            <button
              type="button"
              onClick={onSubmitAnyway}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              Submit anyway
            </button>
          )}
          <button
            type="button"
            onClick={onFix}
            className={`w-full py-3.5 font-semibold rounded-xl transition-colors ${
              hasBlocks
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {hasBlocks ? 'Go fix issues' : 'Go back and review'}
          </button>
        </div>
      </div>
    </div>
  );
}
