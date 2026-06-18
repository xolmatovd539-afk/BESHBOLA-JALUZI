// Unified High-Reliability API Client for Express REST backend
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

// Simple direct request helpers
async function extractError(res: Response, defaultMsg: string): Promise<string> {
  try {
    const errJson = await res.json();
    return errJson.error || errJson.message || JSON.stringify(errJson);
  } catch (e) {
    try {
      const text = await res.text();
      return text || `${res.status} ${res.statusText}`;
    } catch (ex) {
      return `${res.status} ${res.statusText}`;
    }
  }
}

export async function getDb(): Promise<DBState> {
  const res = await fetch('/api/db');
  if (!res.ok) {
    const errMsg = await extractError(res, 'API serverdan ma’lumotlarni o‘qib bo‘lmadi.');
    throw new Error(`API serverdan ma’lumotlarni o‘qib bo‘lmadi: ${errMsg}`);
  }
  return res.json();
}

export async function getCollection(collectionName: string): Promise<any[]> {
  const res = await fetch(`/api/db/${collectionName}`);
  if (!res.ok) {
    const errMsg = await extractError(res, `${collectionName} kolleksiyasini o‘qib bo‘lmadi.`);
    throw new Error(`${collectionName} kolleksiyasini o‘qib bo‘lmadi: ${errMsg}`);
  }
  return res.json();
}

export async function createItem(collectionName: string, item: any): Promise<any> {
  const res = await fetch(`/api/db/${collectionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const errMsg = await extractError(res, `${collectionName} kolleksiyasiga ma’lumot yozishda xatolik yuz berdi.`);
    throw new Error(`${collectionName} kolleksiyasiga ma’lumot yozishda xatolik yuz berdi: ${errMsg}`);
  }
  const data = await res.json();
  return data.item;
}

export async function updateItem(collectionName: string, id: string, updatedFields: any): Promise<any> {
  const res = await fetch(`/api/db/${collectionName}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedFields),
  });
  if (!res.ok) {
    const errMsg = await extractError(res, `${collectionName} kolleksiyasidagi (${id}) tahrirlashda xatolik yuz berdi.`);
    throw new Error(`${collectionName} kolleksiyasidagi (${id}) tahrirlashda xatolik yuz berdi: ${errMsg}`);
  }
  const data = await res.json();
  return data.item;
}

export async function deleteItem(collectionName: string, id: string): Promise<boolean> {
  const res = await fetch(`/api/db/${collectionName}/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errMsg = await extractError(res, `${collectionName} kolleksiyasidagi (${id}) o‘chirishda xatolik yuz berdi.`);
    throw new Error(`${collectionName} kolleksiyasidagi (${id}) o‘chirishda xatolik yuz berdi: ${errMsg}`);
  }
  const data = await res.json();
  return !!data.success;
}

export async function updateSettings(settings: any): Promise<any> {
  const res = await fetch('/api/db-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const errMsg = await extractError(res, 'Sozlamalarni saqlashda xatolik yuz berdi.');
    throw new Error(`Sozlamalarni saqlashda xatolik yuz berdi: ${errMsg}`);
  }
  const data = await res.json();
  return data.settings;
}
