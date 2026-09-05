export const ORDER_STATUS = {
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  PREPARING: 'preparing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

export const STATUS_LABEL = {
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

export class OrderEngine {
  constructor(repository, { reservationMinutes = 30, now = () => new Date() } = {}) {
    this.repository = repository;
    this.reservationMinutes = reservationMinutes;
    this.now = now;
  }

  async cleanupExpiredReservations() {
    const now = this.now();
    const orders = await this.repository.listOrders();
    for (const order of orders) {
      if (
        order.status === ORDER_STATUS.AWAITING_PAYMENT &&
        order.reservationExpiresAt &&
        new Date(order.reservationExpiresAt) <= now
      ) {
        await this.repository.transaction(async (tx) => {
          const current = await tx.getOrder(order.id);
          if (!current || current.status !== ORDER_STATUS.AWAITING_PAYMENT) return;
          for (const item of current.items) {
            const product = await tx.getProduct(item.productId);
            if (!product) continue;
            await tx.updateProduct(product.id, {
              reserved: Math.max(0, product.reserved - item.quantity),
            });
          }
          await tx.updateOrder(current.id, {
            status: ORDER_STATUS.EXPIRED,
            updatedAt: now.toISOString(),
          });
        });
      }
    }
  }

  async quoteShipping({ state, method }) {
    if (method === 'pickup') {
      return { method: 'pickup', label: 'Retirada no local', amount: 0, estimatedDays: 0 };
    }

    const uf = String(state || '').trim().toUpperCase();
    const northeast = new Set(['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE']);
    if (uf === 'PE') {
      return { method: 'delivery', label: 'Entrega', amount: 15, estimatedDays: 4 };
    }
    if (northeast.has(uf)) {
      return { method: 'delivery', label: 'Entrega', amount: 25, estimatedDays: 7 };
    }
    return { method: 'delivery', label: 'Entrega', amount: 40, estimatedDays: 12 };
  }

  async createOrder({ customer, address, items, shippingMethod, paymentMethod }) {
    await this.cleanupExpiredReservations();
    if (!customer?.name || !customer?.phone || !customer?.email) {
      throw new Error('Dados do cliente incompletos.');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('O carrinho está vazio.');
    }

    const now = this.now();
    const shipping = await this.quoteShipping({ state: address?.state, method: shippingMethod });
    const reservationExpiresAt = new Date(now.getTime() + this.reservationMinutes * 60_000);

    return this.repository.transaction(async (tx) => {
      const normalizedItems = [];
      let subtotal = 0;

      for (const item of items) {
        const product = await tx.getProduct(item.productId);
        if (!product || !product.active) throw new Error('Produto indisponível.');
        const quantity = Number(item.quantity || 0);
        if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Quantidade inválida.');
        const available = product.stock - product.reserved;
        if (available < quantity) {
          throw new Error(`Estoque insuficiente para ${product.name}. Disponível: ${available}.`);
        }
        normalizedItems.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity,
        });
        subtotal += product.price * quantity;
      }

      for (const item of normalizedItems) {
        const product = await tx.getProduct(item.productId);
        await tx.updateProduct(product.id, { reserved: product.reserved + item.quantity });
      }

      const id = await tx.nextOrderId();
      const order = {
        id,
        customer,
        address: shippingMethod === 'pickup' ? null : address,
        items: normalizedItems,
        shipping,
        paymentMethod,
        subtotal,
        total: subtotal + shipping.amount,
        status: ORDER_STATUS.AWAITING_PAYMENT,
        reservationExpiresAt: reservationExpiresAt.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        history: [{ status: ORDER_STATUS.AWAITING_PAYMENT, at: now.toISOString(), note: 'Pedido criado e estoque reservado.' }],
      };
      await tx.insertOrder(order);
      return order;
    });
  }

  async markPaid(orderId) {
    await this.cleanupExpiredReservations();
    const now = this.now();
    return this.repository.transaction(async (tx) => {
      const order = await tx.getOrder(orderId);
      if (!order) throw new Error('Pedido não encontrado.');
      if (order.status !== ORDER_STATUS.AWAITING_PAYMENT) {
        throw new Error('Somente pedidos aguardando pagamento podem ser confirmados.');
      }
      if (new Date(order.reservationExpiresAt) <= now) throw new Error('A reserva deste pedido expirou.');

      for (const item of order.items) {
        const product = await tx.getProduct(item.productId);
        if (!product) throw new Error('Produto do pedido não encontrado.');
        if (product.stock < item.quantity || product.reserved < item.quantity) {
          throw new Error(`Inconsistência de estoque em ${product.name}.`);
        }
        await tx.updateProduct(product.id, {
          stock: product.stock - item.quantity,
          reserved: product.reserved - item.quantity,
        });
      }

      const history = [...(order.history || []), { status: ORDER_STATUS.PAID, at: now.toISOString(), note: 'Pagamento confirmado manualmente.' }];
      return tx.updateOrder(order.id, {
        status: ORDER_STATUS.PAID,
        updatedAt: now.toISOString(),
        paidAt: now.toISOString(),
        history,
      });
    });
  }

  async cancelOrder(orderId) {
    const now = this.now();
    return this.repository.transaction(async (tx) => {
      const order = await tx.getOrder(orderId);
      if (!order) throw new Error('Pedido não encontrado.');
      if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.EXPIRED, ORDER_STATUS.DELIVERED].includes(order.status)) {
        throw new Error('Este pedido não pode ser cancelado.');
      }
      if (order.status === ORDER_STATUS.AWAITING_PAYMENT) {
        for (const item of order.items) {
          const product = await tx.getProduct(item.productId);
          if (!product) continue;
          await tx.updateProduct(product.id, { reserved: Math.max(0, product.reserved - item.quantity) });
        }
      } else if ([ORDER_STATUS.PAID, ORDER_STATUS.PREPARING].includes(order.status)) {
        for (const item of order.items) {
          const product = await tx.getProduct(item.productId);
          if (!product) continue;
          await tx.updateProduct(product.id, { stock: product.stock + item.quantity });
        }
      } else if (order.status === ORDER_STATUS.SHIPPED) {
        throw new Error('Pedido enviado deve ser tratado como devolução, não cancelamento simples.');
      }

      const history = [...(order.history || []), { status: ORDER_STATUS.CANCELLED, at: now.toISOString(), note: 'Pedido cancelado.' }];
      return tx.updateOrder(order.id, { status: ORDER_STATUS.CANCELLED, updatedAt: now.toISOString(), history });
    });
  }

  async setStatus(orderId, nextStatus, note = '') {
    const allowed = {
      [ORDER_STATUS.PAID]: [ORDER_STATUS.PREPARING],
      [ORDER_STATUS.PREPARING]: [ORDER_STATUS.SHIPPED],
      [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
    };
    const now = this.now();
    return this.repository.transaction(async (tx) => {
      const order = await tx.getOrder(orderId);
      if (!order) throw new Error('Pedido não encontrado.');
      if (!(allowed[order.status] || []).includes(nextStatus)) throw new Error('Transição de status inválida.');
      const history = [...(order.history || []), { status: nextStatus, at: now.toISOString(), note }];
      return tx.updateOrder(order.id, { status: nextStatus, updatedAt: now.toISOString(), history });
    });
  }
}
