import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes the backup to the cache and opens the system share sheet. Resolves true once shared. */
export async function exportBackupFile(json: string, filename: string): Promise<boolean> {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  await file.write(json);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
  return true;
}

/** Lets the user pick a file and returns its text, or null if cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  return new File(result.assets[0].uri).text();
}
