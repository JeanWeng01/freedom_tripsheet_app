import { useState } from 'react';
import { CheckCircle, RotateCcw, Share2, Download, AlertTriangle } from 'lucide-react';
import type { TripSheet, SRStop, LHStop, MDCStop } from '../types';
import type { SubmitResult } from '../utils/api';
import { minutesToLabel, stopDisplayName } from '../utils/tripUtils';

interface Props {
  trip: TripSheet;
  submitResult: SubmitResult | null;
  onNewTrip: () => void;
}

function formatTripText(trip: TripSheet): string {
  const { header, stops } = trip;
  const activeStops = stops.filter(
    (s): s is SRStop | LHStop | MDCStop => s.type !== 'segment' && !s.skipped
  );

  const dateLabel = new Date(header.date + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const lines: string[] = [
    'FREEDOM TRANSPORTATION',
    `Route ${header.routeNumber} — ${header.driverName}`,
    dateLabel,
    '',
    `Tractor: ${header.tractorNumber || '—'} | Plate: ${header.plateNumber || '—'}`,
    header.clockInTime !== null ? `Clock-in: ${minutesToLabel(header.clockInTime)}` : '',
    '',
    `STOPS (${activeStops.length}):`,
    ...activeStops.map((stop, i) => {
      const name = stopDisplayName(stop);
      const arr = stop.arrivalTime !== null ? minutesToLabel(stop.arrivalTime) : '--';
      const dep = stop.departureTime !== null ? minutesToLabel(stop.departureTime) : '--';
      return `${i + 1}. ${name} — ${arr} → ${dep}`;
    }),
    '',
    `Photos: ${trip.photoCount}`,
    `Trip ID: #${trip.id}`,
  ].filter(l => l !== undefined);

  return lines.join('\n');
}

export default function SubmitScreen({ trip, submitResult, onNewTrip }: Props) {
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');

  const { header, stops } = trip;
  const activeStops = stops.filter(
    (s): s is SRStop | LHStop | MDCStop => s.type !== 'segment' && !s.skipped
  );
  const lastActive = activeStops[activeStops.length - 1];
  const finishTime = lastActive?.departureTime;
  const dateLabel = new Date(header.date + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const dateForFile = new Date(header.date + 'T12:00:00').toLocaleDateString('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).replace(/-/g, '.');
  const firstName = header.driverName.split(' ')[0];
  const filename = submitResult?.filename ?? `[${dateForFile}] ${header.routeNumber} ${firstName}.xlsx`;

  async function handleShare() {
    const text = formatTripText(trip);
    const title = `Trip Sheet — Route ${header.routeNumber} — ${firstName}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2500);
      }
    } catch {
      // User cancelled share or clipboard failed — silent
    }
  }

  const isFlagged = submitResult?.status === 'flagged';
  const backendDown = submitResult === null;

  return (
    <div className="flex flex-col h-dvh bg-slate-900 px-5">
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
              Could not reach the server — data saved locally. Excel will be generated when the server is back online.
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
      <div className="pb-10 space-y-3">
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
          onClick={handleShare}
          className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          <Share2 className="w-4 h-4" />
          {shareStatus === 'copied' ? 'Copied to clipboard!' : 'Save / Share a copy'}
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
