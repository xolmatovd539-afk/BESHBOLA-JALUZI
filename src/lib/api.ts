// Unified High-Reliability Client-Side Firestore API with Persistent Offline support
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  getDocsFromCache,
  getDocFromCache,
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from './firebase';

export interface DBState {
  materials: any[];
  orders: any[];
  inventory: any[];
  settings: {
    usdToUzs: number;
    companyName: string;
    managerName: string;
    managerPhone: string;
    [key: string]: any;
  };
}

let lastBackgroundFetchTime = 0;
const MIN_BACKGROUND_FETCH_INTERVAL = 30000; // Limit background online fetch to once every 30 seconds

async function fetchWithTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Timeout"));
    }, ms);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getDb(): Promise<DBState> {
  // 1. Try to load cached state immediately (instantly responsive, completely offline-compatible)
  let cachedState: DBState | null = null;
  
  try {
    const stored = localStorage.getItem('beshbola_db_state');
    if (stored) {
      cachedState = JSON.parse(stored);
    }
  } catch (e) {}

  if (!cachedState) {
    try {
      const [mSnap, oSnap, iSnap, sSnap] = await Promise.all([
        getDocsFromCache(collection(db, 'materials')),
        getDocsFromCache(collection(db, 'orders')),
        getDocsFromCache(collection(db, 'inventory')),
        getDocFromCache(doc(db, 'settings', 'global'))
      ]);

      const materials = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const orders = oSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const inventory = iSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      let settings = { 
        usdToUzs: 12650, 
        companyName: "BESHBOLA JALUZI", 
        managerName: "Dostonbek", 
        managerPhone: "+998911200004" 
      };
      if (sSnap.exists()) {
        settings = { ...settings, ...sSnap.data() };
      }

      cachedState = { materials, orders, inventory, settings };
      
      try {
        localStorage.setItem('beshbola_db_state', JSON.stringify(cachedState));
      } catch (e) {}
    } catch (e) {}
  }

  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

  // 2. If we have any cache (even empty arrays), return it instantly with 0ms delay!
  if (cachedState) {
    const now = Date.now();
    if (isOnline && (now - lastBackgroundFetchTime > MIN_BACKGROUND_FETCH_INTERVAL)) {
      lastBackgroundFetchTime = now;
      
      // Kick off background fetch silently without delaying the UI render
      setTimeout(async () => {
        try {
          const [mSnap, oSnap, iSnap, sSnap] = await fetchWithTimeout(
            Promise.all([
              getDocs(collection(db, 'materials')),
              getDocs(collection(db, 'orders')),
              getDocs(collection(db, 'inventory')),
              getDoc(doc(db, 'settings', 'global'))
            ]),
            3000
          );

          const materials = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const orders = oSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const inventory = iSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          let settings = { 
            usdToUzs: 12650, 
            companyName: "BESHBOLA JALUZI", 
            managerName: "Dostonbek", 
            managerPhone: "+998911200004" 
          };
          if (sSnap.exists()) {
            settings = { ...settings, ...sSnap.data() };
          }

          const state = { materials, orders, inventory, settings };
          localStorage.setItem('beshbola_db_state', JSON.stringify(state));
        } catch (err: any) {
          // Fail silently in the background - no console spam
        }
      }, 50);
    }
    return cachedState;
  }

  // 3. Fallback: If absolutely no cache exists yet (e.g., first load), perform a blocking online fetch
  if (isOnline) {
    try {
      const [mSnap, oSnap, iSnap, sSnap] = await fetchWithTimeout(
        Promise.all([
          getDocs(collection(db, 'materials')),
          getDocs(collection(db, 'orders')),
          getDocs(collection(db, 'inventory')),
          getDoc(doc(db, 'settings', 'global'))
        ]),
        2500
      );

      const materials = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const orders = oSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const inventory = iSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      let settings = { 
        usdToUzs: 12650, 
        companyName: "BESHBOLA JALUZI", 
        managerName: "Dostonbek", 
        managerPhone: "+998911200004" 
      };
      if (sSnap.exists()) {
        settings = { ...settings, ...sSnap.data() };
      }

      const state = { materials, orders, inventory, settings };
      
      try {
        localStorage.setItem('beshbola_db_state', JSON.stringify(state));
      } catch (e) {}

      return state;
    } catch (err: any) {
      // Fail silently without console warnings
    }
  }

  // 4. Default state
  const defaultState = {
    materials: [],
    orders: [],
    inventory: [],
    settings: { 
      usdToUzs: 12650, 
      companyName: "BESHBOLA JALUZI", 
      managerName: "Dostonbek", 
      managerPhone: "+998911200004" 
    }
  };
  try {
    localStorage.setItem('beshbola_db_state', JSON.stringify(defaultState));
  } catch (e) {}
  return defaultState;
}

export async function getCollection(collectionName: string): Promise<any[]> {
  // Always query from localStorage or cache first for quick results
  try {
    const stored = localStorage.getItem(`beshbola_col_${collectionName}`);
    if (stored) {
      const items = JSON.parse(stored);
      if (Array.isArray(items)) {
        // Kick off background fetch silently if online
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        if (isOnline) {
          setTimeout(async () => {
            try {
              const snap = await fetchWithTimeout(
                getDocs(collection(db, collectionName)),
                3000
              );
              const itemsFresh = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              localStorage.setItem(`beshbola_col_${collectionName}`, JSON.stringify(itemsFresh));
            } catch (e) {}
          }, 50);
        }
        return items;
      }
    }
  } catch (e) {}

  // Fallback to offline Firestore Cache
  try {
    const snap = await getDocsFromCache(collection(db, collectionName));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    try {
      localStorage.setItem(`beshbola_col_${collectionName}`, JSON.stringify(items));
    } catch (e) {}
    return items;
  } catch (cacheErr) {
    try {
      const stored = localStorage.getItem(`beshbola_col_${collectionName}`);
      if (stored) return JSON.parse(stored);
    } catch (lsErr) {}
    
    try {
      const fullDb = localStorage.getItem('beshbola_db_state');
      if (fullDb) {
        const parsed = JSON.parse(fullDb);
        if (Array.isArray(parsed[collectionName])) {
          return parsed[collectionName];
        }
      }
    } catch (e) {}
  }

  // Blocking online fetch only as last resort if totally empty
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
  if (isOnline) {
    try {
      const snap = await fetchWithTimeout(
        getDocs(collection(db, collectionName)),
        2500
      );
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      try {
        localStorage.setItem(`beshbola_col_${collectionName}`, JSON.stringify(items));
      } catch (e) {}
      return items;
    } catch (err: any) {
      // Fail silently
    }
  }

  return [];
}

export async function createItem(collectionName: string, item: any): Promise<any> {
  const id = item.id || doc(collection(db, collectionName)).id;
  const newItem = { 
    ...item, 
    id, 
    createdAt: item.createdAt || new Date().toISOString() 
  };

  try {
    setDoc(doc(db, collectionName, id), newItem); // Async trigger - Firestore local cache queues it
  } catch (err: any) {
    console.warn(`Firestore createItem (${collectionName}) background queue write:`, err.message || err);
  }

  // Update localStorage backup cache synchronously so the UI stays updated immediately!
  try {
    const stored = localStorage.getItem('beshbola_db_state');
    if (stored) {
      const dbState = JSON.parse(stored) as DBState;
      if (!dbState[collectionName]) dbState[collectionName] = [];
      dbState[collectionName] = dbState[collectionName].filter((x: any) => x.id !== id);
      dbState[collectionName].push(newItem);
      localStorage.setItem('beshbola_db_state', JSON.stringify(dbState));
    }
    
    const colStored = localStorage.getItem(`beshbola_col_${collectionName}`);
    if (colStored) {
      const items = JSON.parse(colStored) as any[];
      const updated = items.filter((x: any) => x.id !== id);
      updated.push(newItem);
      localStorage.setItem(`beshbola_col_${collectionName}`, JSON.stringify(updated));
    }
  } catch (e) {}

  return newItem;
}

export async function updateItem(collectionName: string, id: string, updatedFields: any): Promise<any> {
  const docRef = doc(db, collectionName, id);
  const updatedData = { 
    ...updatedFields, 
    updatedAt: new Date().toISOString() 
  };

  try {
    updateDoc(docRef, updatedData); // Async trigger - Firestore local cache queues it
  } catch (err: any) {
    console.warn(`Firestore updateDoc (${collectionName} / ${id}) queued:`, err.message || err);
  }

  // Deduce the final item state using local cache synchronously (saves 100% of network latency)
  let existingItem = {};
  try {
    const stored = localStorage.getItem('beshbola_db_state');
    if (stored) {
      const dbState = JSON.parse(stored) as DBState;
      const found = (dbState[collectionName] || []).find((x: any) => x.id === id);
      if (found) {
        existingItem = found;
      }
    }
  } catch (e) {}

  const finalItem = { ...existingItem, ...updatedFields, id, updatedAt: new Date().toISOString() };

  try {
    const stored = localStorage.getItem('beshbola_db_state');
    if (stored) {
      const dbState = JSON.parse(stored) as DBState;
      if (!dbState[collectionName]) dbState[collectionName] = [];
      const idx = dbState[collectionName].findIndex((x: any) => x.id === id);
      if (idx !== -1) {
        dbState[collectionName][idx] = { ...dbState[collectionName][idx], ...finalItem };
      } else {
        dbState[collectionName].push(finalItem);
      }
      localStorage.setItem('beshbola_db_state', JSON.stringify(dbState));
    }

    const colStored = localStorage.getItem(`beshbola_col_${collectionName}`);
    if (colStored) {
      const items = JSON.parse(colStored) as any[];
      const idx = items.findIndex((x: any) => x.id === id);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...finalItem };
      } else {
        items.push(finalItem);
      }
      localStorage.setItem(`beshbola_col_${collectionName}`, JSON.stringify(items));
    }
  } catch (e) {}

  return finalItem;
}

export async function deleteItem(collectionName: string, id: string): Promise<boolean> {
  try {
    deleteDoc(doc(db, collectionName, id)); // Async trigger - Firestore local cache queues it
  } catch (err: any) {
    console.warn(`Firestore deleteDoc (${collectionName} / ${id}) queued:`, err.message || err);
  }

  try {
    const stored = localStorage.getItem('beshbola_db_state');
    if (stored) {
      const dbState = JSON.parse(stored) as DBState;
      if (dbState[collectionName]) {
        dbState[collectionName] = dbState[collectionName].filter((x: any) => x.id !== id);
        localStorage.setItem('beshbola_db_state', JSON.stringify(dbState));
      }
    }

    const colStored = localStorage.getItem(`beshbola_col_${collectionName}`);
    if (colStored) {
      const items = JSON.parse(colStored) as any[];
      const updated = items.filter((x: any) => x.id !== id);
      localStorage.setItem(`beshbola_col_${collectionName}`, JSON.stringify(updated));
    }
  } catch (e) {}

  return true;
}

export async function updateSettings(settings: any): Promise<any> {
  const docRef = doc(db, 'settings', 'global');
  const updatedData = { 
    ...settings, 
    updatedAt: new Date().toISOString() 
  };

  try {
    setDoc(docRef, updatedData, { merge: true }); // Async trigger - Firestore local cache queues it
  } catch (err: any) {
    console.warn("Firestore updateSettings queued:", err.message || err);
  }

  let finalSettings = settings;
  try {
    const stored = localStorage.getItem('beshbola_db_state');
    if (stored) {
      const dbState = JSON.parse(stored) as DBState;
      finalSettings = { ...(dbState.settings || {}), ...settings };
      dbState.settings = finalSettings;
      localStorage.setItem('beshbola_db_state', JSON.stringify(dbState));
    }
  } catch (e) {}

  return finalSettings;
}
