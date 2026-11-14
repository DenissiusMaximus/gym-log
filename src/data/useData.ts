import { createDriver } from './driver';
import { createPersist } from './persist';
import { safetySnapshot } from './safetySnapshot';
import { createDataStore } from './store';

/** The app-wide write queue and data store, bound to the platform driver. */
export const persist = createPersist(createDriver());
export const useData = createDataStore({ persist, safety: safetySnapshot });
