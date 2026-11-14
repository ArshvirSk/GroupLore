const MAX_SAMPLES = 9;
const MAX_RTT = 500;

export function recordLatency(room, playerId, rttMs) {
  const value = Number(rttMs);
  if (!Number.isFinite(value) || value < 0) return;
  room.latency = room.latency || {};
  const samples = room.latency[playerId] || [];
  samples.push(Math.min(MAX_RTT, Math.round(value)));
  if (samples.length > MAX_SAMPLES) samples.shift();
  room.latency[playerId] = samples;
}

export function medianLatency(room, playerId) {
  const samples = [...(room.latency?.[playerId] || [])].sort((a, b) => a - b);
  if (!samples.length) return 0;
  const middle = Math.floor(samples.length / 2);
  return samples.length % 2
    ? samples[middle]
    : Math.round((samples[middle - 1] + samples[middle]) / 2);
}

/** Half of the smoothed RTT, capped at 125ms (250ms RTT). */
export function latencyOf(room, playerId) {
  return Math.min(125, medianLatency(room, playerId) / 2);
}

export function correctedArrival(room, playerId, arrivedAt) {
  return Number(arrivedAt) - latencyOf(room, playerId);
}

export function rankByCorrectedTime(entries) {
  return [...entries].sort(
    (a, b) => a.correctedAt - b.correctedAt || a.arrivedAt - b.arrivedAt,
  );
}
