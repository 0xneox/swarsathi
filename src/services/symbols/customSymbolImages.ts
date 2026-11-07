import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { createId } from '../../utils/id';
import { logger } from '../../utils/logger';

const SCOPE = 'Symbols';

/**
 * Choosing a picture for the board and keeping it.
 *
 * The picker hands back a URI inside the system cache, which Android may clear at any time, so the
 * file is copied into the application's own document directory before its location is recorded.
 * Nothing is uploaded: the picture never leaves the phone, and the only permission asked for is
 * access to the chosen image.
 */

/** Folder inside the document directory that holds every custom symbol picture. */
const CUSTOM_SYMBOL_DIR = 'custom-symbols';

export type CustomSymbolPickResult =
  | { status: 'picked'; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'failed' };

/**
 * Opens the system picker and returns a durable URI for the chosen picture.
 *
 * `denied` and `failed` are separated from `cancelled` so the board can explain a permissions
 * problem instead of appearing to ignore the tap.
 */
export async function pickCustomSymbolImage(): Promise<CustomSymbolPickResult> {
  let granted = false;
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    granted = permission.granted;
  } catch (error) {
    logger.warn(SCOPE, 'Could not request photo permission', error);
    return { status: 'failed' };
  }
  if (!granted) {
    return { status: 'denied' };
  }

  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });
  } catch (error) {
    logger.warn(SCOPE, 'Could not open the photo picker', error);
    return { status: 'failed' };
  }

  if (result.canceled || result.assets.length === 0) {
    return { status: 'cancelled' };
  }

  const picked = result.assets[0];
  try {
    const directory = new Directory(Paths.document, CUSTOM_SYMBOL_DIR);
    if (!directory.exists) {
      directory.create({ intermediates: true });
    }
    const destination = new File(directory, `${createId('pic')}${extensionFor(picked)}`);
    await new File(picked.uri).copy(destination);
    return { status: 'picked', uri: destination.uri };
  } catch (error) {
    logger.warn(SCOPE, 'Could not keep the chosen picture', error);
    return { status: 'failed' };
  }
}

/** Deletes a picture that is no longer on the board. Missing files are not an error. */
export async function deleteCustomSymbolImage(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    // The row is being removed either way; a picture left behind wastes a little space and nothing
    // else, so this must never stop the removal from finishing.
    logger.warn(SCOPE, 'Could not delete a removed picture', error);
  }
}

/**
 * The extension to store the picture under.
 *
 * Taken from the file the picker returned rather than from the mime type, because the extension is
 * what Android's image decoder uses and the picker's `fileName` is the one thing that already has
 * it. A picker that reports neither falls back to `.jpg`, which every source here can decode.
 */
function extensionFor(asset: ImagePicker.ImagePickerAsset): string {
  const candidate = asset.fileName ?? asset.uri;
  const match = /\.[A-Za-z0-9]+$/.exec(candidate.split('?')[0] ?? '');
  return match ? match[0].toLowerCase() : '.jpg';
}
