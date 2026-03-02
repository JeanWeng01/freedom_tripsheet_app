import type { TripSheet, TripStop, SRStop, LHStop, MDCStop, ValidationResult } from '../types';

function isRegularStop(s: TripStop): s is SRStop | LHStop | MDCStop {
  return s.type !== 'segment';
}

export function validateTrip(trip: TripSheet): ValidationResult {
  const hardBlocks: string[] = [];
  const softWarnings: string[] = [];

  const { header, stops } = trip;
  const activeStops = stops.filter(isRegularStop);

  // ── Hard blocks ──────────────────────────────────────────────────────────

  if (header.clockInTime === null) {
    hardBlocks.push("Looks like you haven't logged your clock-in time — please enter your start time before submitting.");
  }

  if (!header.tractorNumber.trim()) {
    hardBlocks.push('Tractor number is missing.');
  }

  if (!header.plateNumber.trim()) {
    hardBlocks.push('Plate number is missing.');
  }

  // Check final departure time (used as finish time)
  const lastActive = activeStops[activeStops.length - 1];
  if (lastActive && lastActive.departureTime === null) {
    hardBlocks.push("Your last stop is missing a departure time — we need this for your finish time.");
  }

  // Per-stop checks
  activeStops.forEach((stop, idx) => {
    const num = idx + 1;

    // Arrival before departure
    if (stop.arrivalTime !== null && stop.departureTime !== null) {
      if (stop.departureTime < stop.arrivalTime) {
        hardBlocks.push(`Stop #${num} shows departure before arrival — this needs to be corrected.`);
      }
    }

    // Hub reading
    if (!stop.hubReading.trim()) {
      hardBlocks.push(`Stop #${num} is missing an odometer/hub reading.`);
    }

    // MDC-specific
    if (stop.type === 'mdc') {
      const mdc = stop as MDCStop;
      if (!mdc.specialActivity) {
        if (!mdc.arrivingWith) {
          hardBlocks.push(`MDC stop #${num} is missing the 'Arriving with' selection.`);
        }
        if (!mdc.leavingWith) {
          hardBlocks.push(`MDC stop #${num} is missing the 'Leaving with' selection.`);
        }
        if (mdc.arrivingWith === 'SR trailer' && mdc.leavingWith === 'Linehaul trailer' && mdc.transitionTime === null) {
          hardBlocks.push(`MDC stop #${num} (SR → Linehaul) is missing the transition time.`);
        }
      }
    }
  });

  // ── Soft warnings ────────────────────────────────────────────────────────

  // Missing times on active stops
  const missingTimes = activeStops.filter(s => s.arrivalTime === null || s.departureTime === null);
  if (missingTimes.length > 0) {
    softWarnings.push(`${missingTimes.length} stop(s) are missing arrival or departure times.`);
  }

  // Time overlap between consecutive stops
  for (let i = 1; i < activeStops.length; i++) {
    const prev = activeStops[i - 1];
    const curr = activeStops[i];
    if (prev.departureTime !== null && curr.arrivalTime !== null) {
      if (curr.arrivalTime < prev.departureTime) {
        softWarnings.push(`Stop #${i + 1} arrival is earlier than Stop #${i} departure — is this correct?`);
      }
    }
  }

  // Clock-in after first stop arrival
  if (header.clockInTime !== null && activeStops[0]?.arrivalTime !== null) {
    if (header.clockInTime > activeStops[0].arrivalTime!) {
      softWarnings.push("Your clock-in time is after your first arrival — is this correct?");
    }
  }

  // Photo check
  if (trip.photoCount < 2) {
    softWarnings.push("Have you finished taking all your BOL/POD photos?");
  }

  // SR stores not in planned route without a flag
  const unflaggedOffDay = activeStops.filter(s =>
    s.type === 'sr' && (s as SRStop).isOffDayCall && !s.flag
  );
  if (unflaggedOffDay.length > 0) {
    softWarnings.push("Have you flagged all irregular stores? (e.g., Off Day Call, Same Day Special)");
  }

  return { hardBlocks, softWarnings };
}
