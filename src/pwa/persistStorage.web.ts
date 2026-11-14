/** Asks the browser not to evict this origin's data under storage pressure. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // Not available (private mode, old browser): nothing to do.
  }
}
