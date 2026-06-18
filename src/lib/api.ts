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

export async function getDb(): Promise<DBState> {
  try {
    // 1. Try to fetch fresh from online/live collections
    const [mSnap, oSnap, iSnap, sSnap] = await Promise.all([
      getDocs(collection(db, 'materials')),
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'inventory')),
      getDoc(doc(db, 'settings', 'global'))
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

    const state = { materials, orders, inventory, settings };
    
    // Save to localStorage as a high-reliability fallback cache
    try {
      localStorage.setItem('beshbola_db_state', JSON.stringify(state));
    } catch (e) {
      console.warn("localStorage setItem error:", e);
    }

    return state;
  } catch (err: any) {
    console.warn("Firestore getDb failed, trying offline cache fallback:", err.message || err);
    
    // 2. Try to get from Firestore Local Cache
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

      const state = { materials, orders, inventory, settings };
      return state;
    } catch (cacheErr: any) {
      console.warn("Firestore local cache fetch failed, querying localStorage:", cacheErr.message || cacheErr);
      
      // 3. Try to get from localStorage backup cache
      try {
        const stored = localStorage.getItem('beshbola_db_state');
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (lsErr) {
        console.error("localStorage getItem failed:", lsErr);
      }

      // 4. Return default/initial state to prevent any crash
      return {
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
    }
  }
}

export async function getCollection(collectionName: string): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Cache collection in localStorage
    try {
      localStorage.setItem(`beshbola_col_${collectionName}`, JSON.stringify(items));
    } catch (e) {}

    return items;
  } catch (err: any) {
    console.warn(`Firestore getCollection (${collectionName}) failed, trying cache:`, err.message || err);
    try {
      const snap = await getDocsFromCache(collection(db, collectionName));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (cacheErr) {
      try {
        const stored = localStorage.getItem(`beshbola_col_${collectionName}`);
        if (stored) return JSON.parse(stored);
      } catch (lsErr) {}
      
      // Secondary fallback from full DB state cache
      try {
        const fullDb = localStorage.getItem('beshbola_db_state');
        if (fullDb) {
          const parsed = JSON.parse(fullDb);
          if (Array.isArray(parsed[collectionName])) {
            return parsed[collectionName];
          }
        }
      } catch (e) {}

      return [];
    }
  }
}

export async function createItem(collectionName: string, item: any): Promise<any> {
  const id = item.id || doc(collection(db, collectionName)).id;
  const newItem = { 
    ...item, 
    id, 
    createdAt: item.createdAt || new Date().toISOString() 
  };

  try {
    await setDoc(doc(db, collectionName, id), newItem);
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
    await updateDoc(docRef, updatedData);
  } catch (err: any) {
    console.warn(`Firestore updateDoc (${collectionName} / ${id}) queued:`, err.message || err);
  }

  let finalItem: any = { id, ...updatedFields };
  try {
    const snap = await getDoc(docRef).catch(() => getDocFromCache(docRef));
    if (snap.exists()) {
      finalItem = { id, ...snap.data() };
    }
  } catch (e) {
    try {
      const stored = localStorage.getItem('beshbola_db_state');
      if (stored) {
        const dbState = JSON.parse(stored) as DBState;
        const existing = (dbState[collectionName] || []).find((x: any) => x.id === id);
        if (existing) {
          finalItem = { ...existing, ...updatedFields };
        }
      }
    } catch (lsErr) {}
  }

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
    await deleteDoc(doc(db, collectionName, id));
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
    await setDoc(docRef, updatedData, { merge: true });
  } catch (err: any) {
    console.warn("Firestore updateSettings queued:", err.message || err);
  }

  let finalSettings = settings;
  try {
    const snap = await getDoc(docRef).catch(() => getDocFromCache(docRef));
    if (snap.exists()) {
      finalSettings = snap.data();
    }
  } catch (e) {}

  try {
    const stored = localStorage.getItem('beshbola_db_state');
    if (stored) {
      const dbState = JSON.parse(stored) as DBState;
      dbState.settings = { ...dbState.settings, ...finalSettings };
      localStorage.setItem('beshbola_db_state', JSON.stringify(dbState));
    }
  } catch (e) {}

  return finalSettings;
}
