/**
 * PLACEHOLDER — not a real listener count.
 *
 * PRD §9 P1 puts the live count behind one Durable Object holding a WebSocket
 * connection set, which is Phase 2 and the first backend code in the project.
 * Until that exists there is nothing to count, so this fills the slot with a
 * deterministic curve — busier in the evening, quiet at 4am — purely so the
 * layout and type are real while the number is not.
 *
 * When Phase 2 lands, delete this file and point `<Presence />` at the socket.
 * Nothing else in the UI has to change.
 */

/** Rough shape of a listening day, indexed by IST hour. */
const CURVE = [
  9, 6, 5, 4, 4, 6, 12, 21, 34, 41, 38, 35, 33, 36, 39, 44, 52, 63, 74, 81, 77, 62, 41, 22,
];

export function placeholderListenerCount(istHour: number, istMinute: number): number {
  const here = CURVE[istHour % 24] ?? 20;
  const next = CURVE[(istHour + 1) % 24] ?? 20;
  // Ease between the hour buckets so it does not visibly jump on the hour.
  return Math.max(1, Math.round(here + ((next - here) * istMinute) / 60));
}
