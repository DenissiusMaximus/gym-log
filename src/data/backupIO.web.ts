function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Shares the backup through the Web Share sheet (iPhone: "Save to Files"), or downloads it.
 * Must be called synchronously from a tap handler: the File is built before any `await`,
 * otherwise Safari drops the user activation and `share()` is rejected.
 * Resolves false if the user dismissed the share sheet.
 */
export async function exportBackupFile(json: string, filename: string): Promise<boolean> {
  const candidates = ['application/json', 'text/plain'].map((type) => new File([json], filename, { type }));
  const shareable =
    typeof navigator.canShare === 'function'
      ? candidates.find((f) => navigator.canShare({ files: [f] }))
      : undefined;
  if (shareable && typeof navigator.share === 'function') {
    try {
      await navigator.share({ files: [shareable] });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      // Any other failure: fall back to a plain download below.
    }
  }
  download(candidates[0]);
  return true;
}

/** Opens the file chooser (call from a tap handler) and returns the text, or null if cancelled. */
export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/plain';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      file.text().then(resolve, reject);
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}
