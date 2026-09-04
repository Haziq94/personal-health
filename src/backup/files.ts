/**
 * Writing exports out and reading imports back in.
 *
 * Exports land in the cache directory and are handed straight to the system
 * share sheet: the app never keeps a second copy of your data lying around, and
 * the OS decides where it actually goes.
 */

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type ShareOutcome = 'shared' | 'unavailable';

export async function writeAndShare(
  filename: string,
  contents: string,
  mimeType: string,
): Promise<ShareOutcome> {
  const file = new File(Paths.cache, filename);

  // A previous export with the same name would otherwise be shared instead.
  if (file.exists) file.delete();
  file.create();
  file.write(contents);

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';

  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle: filename,
    // iOS needs a uniform type identifier alongside the MIME type.
    UTI: mimeType === 'application/json' ? 'public.json' : 'public.comma-separated-values-text',
  });

  return 'shared';
}

export interface PickedFile {
  name: string;
  contents: string;
}

/**
 * Asks the user for a file and reads it as text.
 *
 * Returns null when the picker was dismissed — a cancellation is a normal
 * outcome, not an error worth reporting.
 */
export async function pickTextFile(mimeType: string): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: mimeType,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) return null;

  const file = new File(asset.uri);
  return { name: asset.name, contents: file.textSync() };
}
