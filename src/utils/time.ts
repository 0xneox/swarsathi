const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

/**
 * A short, human phrase for how long ago something happened.
 *
 * Deliberately coarse - "2 days ago" is what a caregiver needs, not "47 hours". A timestamp in the
 * future (a clock change, an imported file) reads as "just now" rather than a negative age, and a
 * gap of over a month stops counting days because the exact number stops being useful.
 */
export function relativeTimeLabel(timestamp: number, now: number): string {
  const elapsed = now - timestamp;
  if (elapsed < MINUTE) {
    return 'just now';
  }
  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (elapsed < MONTH) {
    const days = Math.floor(elapsed / DAY);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return 'over a month ago';
}
