/** Whether the browser promised not to evict this origin's data; null if it cannot tell. */
export async function readStoragePersisted(): Promise<boolean | null> {
  if (!navigator.storage?.persisted) return null;
  try {
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}
