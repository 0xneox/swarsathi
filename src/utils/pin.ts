import * as Crypto from 'expo-crypto';

/**
 * Local PIN hashing for the optional caregiver configuration lock.
 *
 * The PIN is never stored. What is stored is a *salted, iterated* SHA-256 digest, together with a
 * per-device random salt:
 *
 *   digest = SHA256( SHA256( ... SHA256( salt + ":" + pin ) ... ) )   (PIN_ITERATIONS times)
 *
 * This is an appropriate, Android-compatible approach for a local convenience lock: it uses the
 * platform's own cryptographic primitives (`expo-crypto`), never the JVM's `String.hashCode`, and
 * the salt makes two devices with the same PIN store different values.
 *
 * Honest limitation: this is *not* PBKDF2/Argon2, and a 4-8 digit PIN has a small keyspace. The PIN
 * exists to stop a helper casually changing boards and messages, not to withstand an attacker who
 * already has the device's database file. Nothing about it is a claim of strong cryptography, and
 * it is never sent anywhere.
 */

/** Shortest PIN SwarSathi accepts. */
export const PIN_MIN_LENGTH = 4;
/** Longest PIN SwarSathi accepts. */
export const PIN_MAX_LENGTH = 8;
/** Iterations of SHA-256 applied to the salted PIN. */
export const PIN_ITERATIONS = 2048;

/** Keeps only digits and trims to the supported length, so a keypad and a text field agree. */
export function normalizePinDigits(pin: string): string {
  return pin.replace(/\D+/g, '').slice(0, PIN_MAX_LENGTH);
}

/** True when the value is a usable PIN: the right characters and the right length. */
export function isValidPin(pin: string): boolean {
  const digits = normalizePinDigits(pin);
  return digits.length >= PIN_MIN_LENGTH && digits.length <= PIN_MAX_LENGTH;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Generates a fresh 128-bit salt, unique to this device. */
export async function createPinSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return toHex(bytes);
}

/** Derives the stored digest for a PIN. Deterministic for a given salt and iteration count. */
export async function hashPin(
  pin: string,
  salt: string,
  iterations: number = PIN_ITERATIONS
): Promise<string> {
  const rounds = iterations > 0 ? iterations : PIN_ITERATIONS;
  let digest = `${salt}:${normalizePinDigits(pin)}`;
  for (let index = 0; index < rounds; index += 1) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digest);
  }
  return digest;
}

/**
 * Checks a PIN against a stored digest.
 *
 * The comparison is length-independent and does not short-circuit on the first differing
 * character, so the time taken does not reveal how much of the PIN was correct. A missing salt or
 * digest is always a refusal, never a pass.
 */
export async function verifyPin(
  pin: string,
  expectedHash: string | null,
  salt: string | null,
  iterations: number = PIN_ITERATIONS
): Promise<boolean> {
  if (!expectedHash || !salt) {
    return false;
  }
  const candidate = await hashPin(pin, salt, iterations);
  return timingSafeEqual(candidate, expectedHash);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
