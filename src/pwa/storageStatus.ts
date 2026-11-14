/** Native: SQLite files are not evicted by the system, so there is nothing to report. */
export async function readStoragePersisted(): Promise<boolean | null> {
  return null;
}
