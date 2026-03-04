import { useState, useEffect, useRef } from 'react';
import { CheckCircle, RotateCcw, Download, AlertTriangle, ArrowLeft } from 'lucide-react';
import type { TripSheet, SRStop, LHLegStop, MDCStop } from '../types';
import type { SubmitResult } from '../utils/api';
import { checkHealth } from '../utils/api';
import { minutesToLabel } from '../utils/tripUtils';

interface Props {
  trip: TripSheet;
  submitResult: SubmitResult | null;
  onNewTrip: () => void;
  onRetry: () => Promise<void>;
  onGoBack: () => void;
  history: TripSheet[];
}

export default function SubmitScreen({ trip, submitResult, onNewTrip, onRetry, onGoBack, history }: Props) {
  const { header, stops } = trip;
  const activeStops = stops.filter(
    (s): s is SRStop | LHLegStop | MDCStop => s.type !== 'segment' && s.type !== 'truck' && !s.skipped
  );
  const lastActive = activeStops[activeStops.length - 1];
  const finishTime = lastActive?.departureTime;
  const dateLabel = new Date(header.date + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const d = new Date(header.date + 'T12:00:00');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  const firstName = header.driverName.split(' ')[0];
  const filename = submitResult?.filename ?? `${mm}.${dd} ${header.routeNumber} ${firstName} ${yyyy}.xlsx`;

  const isFlagged = submitResult?.status === 'flagged';
  const backendDown = submitResult === null;

  const [retrying, setRetrying] = useState(false);

  // Keep a ref so the polling closure always calls the latest onRetry
  const onRetryRef = useRef(onRetry);
  onRetryRef.current = onRetry;

  // Auto-retry: poll /api/health every 20s when backend was unreachable
  useEffect(() => {
    if (!backendDown || retrying) return;
    const interval = setInterval(async () => {
      const alive = await checkHealth();
      if (alive) {
        clearInterval(interval);
        setRetrying(true);
        try {
          await onRetryRef.current();
        } finally {
          setRetrying(false);
        }
      }
    }, 20_000);
    return () => clearInterval(interval);
  }, [backendDown, retrying]);

  // Past trips from history, excluding the current one
  const pastHistory = history.filter(t => t.id !== trip.id).slice(0, 5);

  return (
    <div className="flex flex-col min-h-dvh bg-slate-900 px-5">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <img src="/logo.png" alt="Freedom Transportation" className="h-16 mb-4" />

        <div className="w-20 h-20 rounded-full bg-green-900/40 border-2 border-green-600 flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Trip sheet submitted!</h1>
        <p className="text-slate-400 text-sm mb-6 max-w-sm">
          Your trip data has been saved.
        </p>

        {isFlagged && (
          <div className="w-full max-w-sm flex items-start gap-2.5 bg-amber-900/20 border border-amber-700/50 rounded-xl px-3 py-2.5 mb-4 text-left">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-300 text-sm">
              Excel file generated but flagged for review — the owner will check it.
            </p>
          </div>
        )}

        {backendDown && (
          <div className="w-full max-w-sm flex items-start gap-2.5 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 mb-4 text-left">
            <AlertTriangle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-slate-400 text-sm">
              {retrying
                ? 'Server found — retrying submission…'
                : 'Could not reach the server. Trip data is saved on this device — will retry automatically when the server is back online.'}
            </p>
          </div>
        )}

        {/* Summary card */}
        <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-4 text-left space-y-3 mb-6">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trip summary</div>
          <div className="space-y-2 text-sm">
            <Row label="Driver" value={header.driverName} />
            <Row label="Route" value={header.routeNumber} />
            <Row label="Date" value={dateLabel} />
            {header.clockInTime !== null && (
              <Row label="Clock-in" value={minutesToLabel(header.clockInTime)} />
            )}
            {finishTime !== undefined && finishTime !== null && (
              <Row label="Finish time" value={minutesToLabel(finishTime)} />
            )}
            <Row label="Active stops" value={String(activeStops.length)} />
            <Row label="Trip ID" value={`#${trip.id}`} mono />
          </div>
          <div className="pt-2 border-t border-slate-700">
            <div className="text-xs text-slate-500 mb-1">Output file</div>
            <div className={`font-mono text-xs px-2 py-1.5 rounded-lg break-all ${
              isFlagged
                ? 'text-amber-400 bg-amber-950/30'
                : 'text-green-400 bg-green-950/30'
            }`}>
              {filename}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pb-6 space-y-3">
        {submitResult && (
          <a
            href={submitResult.downloadUrl}
            download={submitResult.filename}
            className={`w-full py-4 font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 ${
              isFlagged
                ? 'bg-amber-700 hover:bg-amber-600 text-white'
                : 'bg-green-700 hover:bg-green-600 text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            Download Excel file
          </a>
        )}

        <button
          onClick={onGoBack}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-2xl transition-colors flex items-center justify-center gap-2 border border-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Go back and edit
        </button>

        <button
          onClick={onNewTrip}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Start new trip sheet
        </button>

        <p className="text-xs text-center text-slate-600">
          A copy of this trip is saved locally on this device.
        </p>
      </div>

      {/* Recent submissions history */}
      {pastHistory.length > 0 && (
        <div className="pb-8">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Recent submissions
          </div>
          <div className="space-y-2">
            {pastHistory.map(t => {
              const submitted = t.submittedAt !== null;
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${submitted ? 'bg-green-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">
                      {t.header.driverName} · Route {t.header.routeNumber}
                    </div>
                    <div className="text-xs text-slate-500">{t.header.date}</div>
                  </div>
                  <span className={`text-xs flex-shrink-0 ${submitted ? 'text-green-500' : 'text-amber-400'}`}>
                    {submitted ? 'submitted' : 'pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-white text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
