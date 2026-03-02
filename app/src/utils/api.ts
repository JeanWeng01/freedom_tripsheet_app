import type { TripSheet } from '../types';

const API_BASE = '/api';

/**
 * Auto-save: push current trip state to the backend DB.
 * Fire-and-forget — errors are silent so they don't interrupt the driver.
 */
export async function syncTrip(trip: TripSheet): Promise<void> {
  try {
    await fetch(`${API_BASE}/trips/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip),
    });
  } catch {
    // Network unavailable — localStorage is still the fallback
  }
}

export interface SubmitResult {
  filename: string;
  status: 'ready' | 'flagged';
  downloadUrl: string;
}

/**
 * Final submit: save trip to DB and generate the Excel file.
 * Returns download info so the driver can grab the file.
 */
export async function submitTrip(trip: TripSheet): Promise<SubmitResult> {
  const res = await fetch(`${API_BASE}/trips/${trip.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Submit failed (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return {
    filename: data.filename,
    status: data.status,
    downloadUrl: data.download_url,
  };
}
