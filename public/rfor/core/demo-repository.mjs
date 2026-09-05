const DB_KEY = 'rfor_demo_db_v2';

const SEED = {
  products: [
    { id: 'p1', name: 'Fone Bluetooth Pro', category: 'Eletrônicos', price: 119.9, stock: 18, reserved: 0, active: true, image: '🎧' },
    { id: 'p2', name: 'Garrafa Térmica 1L', category: 'Casa', price: 89.9, stock: 12, reserved: 0, active: true, image: '🧊' },
    { id: 'p3', name: 'Kit Organizador', category: 'Utilidades', price: 59.9, stock: 25, reserved: 0, active: true, image: '📦' },
    { id: 'p4', name: 'Smartwatch Fit', category: 'Eletrônicos', price: 179.9, stock: 9, reserved: 0, active: true, image: '⌚' },
  ],
  orders: [],
  orderCounter: 1000,
};

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

export class DemoRepository {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    if (!this.storage.getItem(DB_KEY)) this.storage.setItem(DB_KEY, JSON.stringify(SEED));
  }

  read() { return JSON.parse(this.storage.getItem(DB_KEY) || JSON.stringify(SEED)); }
  write(db) { this.storage.setItem(DB_KEY, JSON.stringify(db)); }
  async listProducts() { return clone(this.read().products); }
  async listOrders() { return clone(this.read().orders).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); }
  async getOrder(id) { return clone(this.read().orders.find((o) => o.id === id) || null); }

  async transaction(fn) {
    const db = this.read();
    const tx = {
      getProduct: async (id) => clone(db.products.find((p) => p.id === id) || null),
      updateProduct: async (id, patch) => {
        const i = db.products.findIndex((p) => p.id === id);
        if (i < 0) throw new Error('Produto não encontrado.');
        db.products[i] = { ...db.products[i], ...patch };
        return clone(db.products[i]);
      },
      getOrder: async (id) => clone(db.orders.find((o) => o.id === id) || null),
      insertOrder: async (order) => { db.orders.push(clone(order)); return clone(order); },
      updateOrder: async (id, patch) => {
        const i = db.orders.findIndex((o) => o.id === id);
        if (i < 0) throw new Error('Pedido não encontrado.');
        db.orders[i] = { ...db.orders[i], ...patch };
        return clone(db.orders[i]);
      },
      nextOrderId: async () => {
        db.orderCounter += 1;
        return `RF-${String(db.orderCounter).padStart(6, '0')}`;
      },
    };
    const result = await fn(tx);
    this.write(db);
    return clone(result);
  }

  reset() { this.storage.setItem(DB_KEY, JSON.stringify(SEED)); }
}

export class MemoryRepository {
  constructor(seed = SEED) { this.db = clone(seed); }
  async listProducts() { return clone(this.db.products); }
  async listOrders() { return clone(this.db.orders); }
  async getOrder(id) { return clone(this.db.orders.find((o) => o.id === id) || null); }
  async transaction(fn) {
    const working = clone(this.db);
    const tx = {
      getProduct: async (id) => clone(working.products.find((p) => p.id === id) || null),
      updateProduct: async (id, patch) => {
        const i = working.products.findIndex((p) => p.id === id);
        if (i < 0) throw new Error('Produto não encontrado.');
        working.products[i] = { ...working.products[i], ...patch };
        return clone(working.products[i]);
      },
      getOrder: async (id) => clone(working.orders.find((o) => o.id === id) || null),
      insertOrder: async (order) => { working.orders.push(clone(order)); return clone(order); },
      updateOrder: async (id, patch) => {
        const i = working.orders.findIndex((o) => o.id === id);
        if (i < 0) throw new Error('Pedido não encontrado.');
        working.orders[i] = { ...working.orders[i], ...patch };
        return clone(working.orders[i]);
      },
      nextOrderId: async () => { working.orderCounter += 1; return `RF-${String(working.orderCounter).padStart(6, '0')}`; },
    };
    const result = await fn(tx);
    this.db = working;
    return clone(result);
  }
}
