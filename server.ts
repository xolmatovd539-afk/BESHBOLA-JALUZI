import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else {
    console.warn("[Firebase Config Warning] firebase-applet-config.json file not found at path:", configPath);
  }
} catch (err) {
  console.error("Failed to load firebase config on startup:", err);
}

// Local Database Implementation (Solid FS based persistence)
let DB_PATH = path.join(process.cwd(), 'data', 'db.json');
try {
  const testDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const testFile = path.join(testDir, '.write-test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
} catch (e) {
  console.warn("Read-only filesystem detected (e.g. Vercel). Falling back database storage to /tmp/db.json");
  DB_PATH = path.join('/tmp', 'db.json');
}

function readLocalDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const initial = { 
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
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (err) {
    console.error("Local DB load error:", err);
    return { materials: [], orders: [], inventory: [], settings: {} };
  }
}

function writeLocalDb(data: any) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Local DB write error:", err);
  }
}

// REST Client to Firestore for server-side backup & bootstrapping
async function fetchFirebaseDocREST(collectionName: string) {
  try {
    const projectId = firebaseConfig?.projectId;
    const dbId = firebaseConfig?.firestoreDatabaseId || '(default)';
    const apiKey = firebaseConfig?.apiKey;
    
    if (!projectId || !apiKey || projectId.includes("placeholder") || projectId.includes("remixed-project")) {
      console.log(`[Firestore REST] Skipping cloud sync for ${collectionName}: Firebase is not configured or uses placeholder credentials.`);
      return [];
    }
    
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/${collectionName}?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    if (!data.documents) return [];
    
    return data.documents.map((doc: any) => {
      const id = doc.name.split('/').pop();
      const fields: any = {};
      if (doc.fields) {
        for (const [key, value] of Object.entries(doc.fields)) {
          const valObj = value as any;
          if ('stringValue' in valObj) fields[key] = valObj.stringValue;
          else if ('integerValue' in valObj) fields[key] = parseInt(valObj.integerValue);
          else if ('doubleValue' in valObj) fields[key] = parseFloat(valObj.doubleValue);
          else if ('booleanValue' in valObj) fields[key] = valObj.booleanValue;
          else if ('mapValue' in valObj) {
            const mapFields: any = {};
            if (valObj.mapValue.fields) {
              for (const [mk, mv] of Object.entries(valObj.mapValue.fields)) {
                const subVal = mv as any;
                if ('stringValue' in subVal) mapFields[mk] = subVal.stringValue;
                else if ('integerValue' in subVal) mapFields[mk] = parseInt(subVal.integerValue);
                else if ('doubleValue' in subVal) mapFields[mk] = parseFloat(subVal.doubleValue);
                else if ('booleanValue' in subVal) mapFields[mk] = subVal.booleanValue;
              }
            }
            fields[key] = mapFields;
          } else if ('arrayValue' in valObj) {
            fields[key] = (valObj.arrayValue.values || []).map((v: any) => {
              if ('stringValue' in v) return v.stringValue;
              if ('integerValue' in v) return parseInt(v.integerValue);
              if ('doubleValue' in v) return parseFloat(v.doubleValue);
              if ('booleanValue' in v) return v.booleanValue;
              if ('mapValue' in v && v.mapValue.fields) {
                const subObj: any = {};
                for (const [mk, mv] of Object.entries(v.mapValue.fields)) {
                  const sv = mv as any;
                  if ('stringValue' in sv) subObj[mk] = sv.stringValue;
                  else if ('integerValue' in sv) subObj[mk] = parseInt(sv.integerValue);
                  else if ('doubleValue' in sv) subObj[mk] = parseFloat(sv.doubleValue);
                  else if ('booleanValue' in sv) subObj[mk] = sv.booleanValue;
                }
                return subObj;
              }
              return v;
            });
          }
        }
      }
      return { id, ...fields };
    });
  } catch (err) {
    console.error(`Sync error for ${collectionName}:`, err);
    return [];
  }
}

async function fetchFirebaseSettingsREST() {
  try {
    const projectId = firebaseConfig?.projectId;
    const dbId = firebaseConfig?.firestoreDatabaseId || '(default)';
    const apiKey = firebaseConfig?.apiKey;
    
    if (!projectId || !apiKey || projectId.includes("placeholder") || projectId.includes("remixed-project")) {
      console.log(`[Firestore REST] Skipping cloud sync for settings: Firebase is not configured or uses placeholder credentials.`);
      return null;
    }
    
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/settings/global?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const doc = await response.json();
    const fields: any = {};
    if (doc.fields) {
      for (const [key, value] of Object.entries(doc.fields)) {
        const valObj = value as any;
        if ('stringValue' in valObj) fields[key] = valObj.stringValue;
        else if ('integerValue' in valObj) fields[key] = parseInt(valObj.integerValue);
        else if ('doubleValue' in valObj) fields[key] = parseFloat(valObj.doubleValue);
        else if ('booleanValue' in valObj) fields[key] = valObj.booleanValue;
      }
    }
    return fields;
  } catch (err) {
    console.error("Sync error for settings:", err);
    return null;
  }
}

async function syncDatabaseOnBoot() {
  console.log("[Boot Sync] Syncing local db with cloud Firestore...");
  const dbData = readLocalDb();
  
  if (dbData.materials.length === 0) {
    const cloudMaterials = await fetchFirebaseDocREST('materials');
    if (cloudMaterials.length > 0) {
      dbData.materials = cloudMaterials;
      console.log(`[Boot Sync] Imported ${cloudMaterials.length} materials.`);
    }
  }
  
  if (dbData.orders.length === 0) {
    const cloudOrders = await fetchFirebaseDocREST('orders');
    if (cloudOrders.length > 0) {
      dbData.orders = cloudOrders;
      console.log(`[Boot Sync] Imported ${cloudOrders.length} orders.`);
    }
  }
  
  if (dbData.inventory.length === 0) {
    const cloudInventory = await fetchFirebaseDocREST('inventory');
    if (cloudInventory.length > 0) {
      dbData.inventory = cloudInventory;
      console.log(`[Boot Sync] Imported ${cloudInventory.length} inventory items.`);
    }
  }

  const cloudSettings = await fetchFirebaseSettingsREST();
  if (cloudSettings) {
    dbData.settings = { ...dbData.settings, ...cloudSettings };
    console.log("[Boot Sync] Imported global settings.");
  }
  
  writeLocalDb(dbData);
  console.log("[Boot Sync] Sync completed successfully.");
}

const app = express();
const PORT = 3000;

// Set limits for base64 transfers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    platform: 'express-vite-fullstack'
  });
});

// Config Status Helper
app.get('/api/config', (req, res) => {
  res.json({
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
  });
});

// Window Corners Detection Proxy API using Gemini
app.post('/api/detect-windows', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Rasm ma\'lumotlari yuborilmadi (image base64 field is empty).' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(500).json({ error: 'Serverda GEMINI_API_KEY sozlanmagan yoki u hali o\'zgartirilmagan. Iltimos, AI Studio sozlamalaridagi "Secrets" panelidan real API kalitni kiriting.' });
    }

    // Defensive check: strip custom surrounding quotes if any are present
    const cleanApiKey = apiKey.trim().replace(/^["']|["']$/g, '');

    const ai = new GoogleGenAI({ 
      apiKey: cleanApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    let base64Data = image;
    if (image.includes(',')) {
      base64Data = image.split(',')[1];
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
          { text: "Find the window areas in the image. If it's one large window, return it as a single window with 4 points. If there are clearly separate window sections, return each section separately. Return in JSON format: {\"windows\": [{\"points\": [{\"x\": 0-100, \"y\": 0-100}, ...], \"width\": meters, \"height\": meters}, ...]}." }
        ]
      }
    });

    const text = response.text || "";
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error("Sun'iy intellekt javobidan JSON topilmadi.");
    }

    const parsed = JSON.parse(text.substring(jsonStart, jsonEnd));
    res.json(parsed);
  } catch (error: any) {
    console.error('API Window detection error:', error);
    res.status(500).json({ error: error.message || 'Derazalarni sun\'iy intellekt orqali aniqlashda xatolik yuz berdi.' });
  }
});

// REST API CRUD endpoints for full-stack data persistence (materials, orders, inventory, settings)
app.get('/api/db', (req, res) => {
  try {
    res.json(readLocalDb());
  } catch (err: any) {
    console.error("GET /api/db error:", err);
    res.status(500).json({ error: err.message || "Ma'lumotlar bazasini yuklashda xatolik yuz berdi." });
  }
});

app.get('/api/db/:collection', (req, res) => {
  try {
    const { collection } = req.params;
    const db = readLocalDb();
    if (!db[collection]) {
      return res.status(404).json({ error: `Kolleksiya topilmadi: ${collection}` });
    }
    res.json(db[collection]);
  } catch (err: any) {
    console.error(`GET /api/db/${req.params.collection} error:`, err);
    res.status(500).json({ error: err.message || "Kolleksiyani o'qishda xatolik yuz berdi." });
  }
});

app.post('/api/db/:collection', (req, res) => {
  try {
    const { collection } = req.params;
    const item = req.body;
    
    const db = readLocalDb();
    if (!db[collection]) {
      db[collection] = [];
    }
    
    if (!Array.isArray(db[collection])) {
      return res.status(400).json({ error: `Kolleksiya massiv bo'lishi kerak, lekin u boshqa tipda: ${collection}` });
    }
    
    // Generate a secure unique ID if missing
    if (!item.id) {
      item.id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    }
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }
    
    db[collection].push(item);
    writeLocalDb(db);
    res.json({ success: true, item });
  } catch (err: any) {
    console.error(`POST /api/db/${req.params.collection} error:`, err);
    res.status(500).json({ error: err.message || "Kolleksiyaga element qo'shishda xatolik yuz berdi." });
  }
});

app.put('/api/db/:collection/:id', (req, res) => {
  try {
    const { collection, id } = req.params;
    const updatedFields = req.body;
    
    const db = readLocalDb();
    if (!db[collection]) {
      return res.status(404).json({ error: `Kolleksiya topilmadi: ${collection}` });
    }
    
    if (!Array.isArray(db[collection])) {
      return res.status(400).json({ error: `Kolleksiya massiv bo'lishi kerak, lekin u boshqa tipda: ${collection}` });
    }
    
    const idx = db[collection].findIndex((item: any) => item.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: `Kolleksiya elementi topilmadi, ID: ${id}` });
    }
    
    db[collection][idx] = { 
      ...db[collection][idx], 
      ...updatedFields, 
      updatedAt: new Date().toISOString() 
    };
    writeLocalDb(db);
    res.json({ success: true, item: db[collection][idx] });
  } catch (err: any) {
    console.error(`PUT /api/db/${req.params.collection}/${req.params.id} error:`, err);
    res.status(500).json({ error: err.message || "Elementni tahrirlashda xatolik yuz berdi." });
  }
});

app.delete('/api/db/:collection/:id', (req, res) => {
  try {
    const { collection, id } = req.params;
    
    const db = readLocalDb();
    if (!db[collection]) {
      return res.status(404).json({ error: `Kolleksiya topilmadi: ${collection}` });
    }
    
    if (!Array.isArray(db[collection])) {
      return res.status(400).json({ error: `Kolleksiya massiv bo'lishi kerak, lekin u boshqa tipda: ${collection}` });
    }
    
    const initialLen = db[collection].length;
    db[collection] = db[collection].filter((item: any) => item.id !== id);
    
    if (db[collection].length === initialLen) {
      return res.status(404).json({ error: `O'chirish uchun element topilmadi, ID: ${id}` });
    }
    
    writeLocalDb(db);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`DELETE /api/db/${req.params.collection}/${req.params.id} error:`, err);
    res.status(500).json({ error: err.message || "Elementni o'chirishda xatolik yuz berdi." });
  }
});

app.post('/api/db-settings', (req, res) => {
  try {
    const settings = req.body;
    const db = readLocalDb();
    db.settings = { ...db.settings, ...settings };
    writeLocalDb(db);
    res.json({ success: true, settings: db.settings });
  } catch (err: any) {
    console.error("POST /api/db-settings error:", err);
    res.status(500).json({ error: err.message || "Sozlamalarni saqlashda xatolik yuz berdi." });
  }
});

async function startServer() {
  // Run boostrap sync
  await syncDatabaseOnBoot().catch(e => console.error("Boot sync failed:", e));

  // Server Frontend via Vite or Static Files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only start listening if NOT in a Vercel serverless environment
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Backend Server] Server http://localhost:${PORT} portida ishga tushdi.`);
    });
  } else {
    console.log("[Backend Server] Vercel serverless environment detected. Skipping listen.");
  }
}

startServer().catch((err) => {
  console.error("Backend serverni ishga tushirishda xatolik:", err);
});

export default app;
