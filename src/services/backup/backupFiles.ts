import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { logger } from '../../utils/logger';

const SCOPE = 'Backup';

/**
 * The filesystem side of backup: writing a file the user can keep, sharing it, and reading one
 * back. All of it is local; the share sheet is the only way a file ever leaves the device, and it
 * appears only when the user asks for it.
 */

/** The application version recorded in a backup, for diagnostics only. */
export function readAppVersion(): string {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version.length > 0 ? version : 'unknown';
}

/** A filename that sorts chronologically and cannot collide within the same minute. */
export function backupFileName(at: number = Date.now()): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `swarsathi-backup-${stamp}.json`;
}

/** True when this device has somewhere to send a shared file. */
export async function canShareBackup(): Promise<boolean> {
  try {
    return await Sharing.isAvailableAsync();
  } catch (error) {
    logger.warn(SCOPE, 'Could not check whether sharing is available');
    void error;
    return false;
  }
}

/**
 * Writes the backup and opens the share sheet.
 *
 * Returns `false` when sharing is unavailable, so the screen can explain that rather than appear to
 * do nothing.
 */
export async function exportBackupToShare(json: string, at: number = Date.now()): Promise<boolean> {
  if (!(await canShareBackup())) {
    return false;
  }
  const file = new File(Paths.cache, backupFileName(at));
  if (file.exists) {
    file.delete();
  }
  file.create({ overwrite: true });
  await file.write(json);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your SwarSathi backup',
    UTI: 'public.json',
  });
  return true;
}

/** The result of choosing a file to import. */
export type PickedBackup =
  | { canceled: true }
  | { canceled: false; name: string; text: string };

/**
 * Asks the user for a backup file and reads it.
 *
 * Any MIME type is accepted because Android file providers report JSON inconsistently; the content
 * is validated afterwards, which is what actually keeps a wrong file from being applied.
 */
export async function pickBackupFile(): Promise<PickedBackup> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) {
    return { canceled: true };
  }
  const asset = result.assets[0];
  const text = await new File(asset.uri).text();
  return { canceled: false, name: asset.name, text };
}
