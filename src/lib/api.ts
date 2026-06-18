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
export async function getDb(): Promise<DBState> {
  const res = await fetch('/api/db');
  if (!res.ok) throw new Error('API serverdan ma’lumotlarni o‘qib bo‘lmadi.');
  return res.json();
}

export async function getCollection(collectionName: string): Promise<any[]> {
  const res = await fetch(`/api/db/${collectionName}`);
  if (!res.ok) throw new Error(`${collectionName} kolleksiyasini o‘qib bo‘lmadi.`);
  return res.json();
}

export async function createItem(collectionName: string, item: any): Promise<any> {
  const res = await fetch(`/api/db/${collectionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`${collectionName} kolleksiyasiga ma’lumot yozishda xatolik yuz berdi.`);
  const data = await res.json();
  return data.item;
}

export async function updateItem(collectionName: string, id: string, updatedFields: any): Promise<any> {
  const res = await fetch(`/api/db/${collectionName}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedFields),
  });
  if (!res.ok) throw new Error(`${collectionName} kolleksiyasidagi (${id}) tahrirlashda xatolik yuz berdi.`);
  const data = await res.json();
  return data.item;
}

export async function deleteItem(collectionName: string, id: string): Promise<boolean> {
  const res = await fetch(`/api/db/${collectionName}/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`${collectionName} kolleksiyasidagi (${id}) o‘chirishda xatolik yuz berdi.`);
  const data = await res.json();
  return !!data.success;
}

export async function updateSettings(settings: any): Promise<any> {
  const res = await fetch('/api/db-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Sozlamalarni saqlashda xatolik yuz berdi.');
  const data = await res.json();
  return data.settings;
}
