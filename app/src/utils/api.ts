import type { TripSheet } from '../types';

const API_BASE = '/api';

export async function uploadPhoto(
  tripId: string,
  file: File,
  meta: { date: string; route: string; driverCode: string },
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('date', meta.date);
  form.append('route', meta.route);
  form.append('driver_code', meta.driverCode);

  const res = await fetch(`${API_BASE}/trips/${tripId}/photos`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Photo upload failed (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return data.url as string;
}

/**
 * Beacon sync: used on page hide/unload where fetch may not complete.
 * sendBeacon is fire-and-forget and survives page teardown.
 */
export function syncTripBeacon(trip: TripSheet): void {
  try {
    const blob = new Blob([JSON.stringify(trip)], { type: 'application/json' });
    navigator.sendBeacon(`${API_BASE}/trips/sync`, blob);
  } catch {
    // Best-effort only
  }
}

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

/**
 * Check if the backend is reachable. Returns true if the server responds.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(5_000) });
    return res.ok;
  } catch {
    return false;
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
