import { parseOrder } from './parseOrder.js';

export const handleOrderCancellation = async (sock, from, text, activeOrders, pendingOrders, suppliers) => {
  if (!text.toLowerCase().startsWith('отмена') && !text.toLowerCase().startsWith('отменить')) {
    return false;
  }

  const orderId = text.split(' ')[1];
  if (!orderId) {
    await sock.sendMessage(from, { 
      text: `❌ *Ошибка*

Пожалуйста, укажите ID заказа для отмены.

Пример: *отмена 1234567890*` 
    });
    return true;
  }

  const order = activeOrders[orderId] || pendingOrders[orderId];
  if (!order) {
    await sock.sendMessage(from, { 
      text: `❌ *Заказ не найден*

Проверьте ID заказа и попробуйте снова.

Пример: *отмена 1234567890*` 
    });
    return true;
  }

  if (order.from !== from && from !== ownerNumber) {
    await sock.sendMessage(from, { 
      text: `❌ *Нет прав*

У вас нет прав для отмены этого заказа.` 
    });
    return true;
  }

  if (order.status === 'delivered') {
    await sock.sendMessage(from, { 
      text: `❌ *Невозможно отменить*

Нельзя отменить уже доставленный заказ.` 
    });
    return true;
  }

  // Определяем, каким поставщикам нужно отправить уведомление об отмене
  const orderItems = order.orderText.split('\n');
  const suppliersToNotify = new Map();
  
  // Определяем продукты каждого поставщика
  for (const [supplier, data] of Object.entries(suppliers)) {
    const supplierProducts = [];
    for (const product of data.products) {
      for (const orderItem of orderItems) {
        if (orderItem.toLowerCase().includes(product.toLowerCase())) {
          supplierProducts.push(orderItem);
        }
      }
    }
    if (supplierProducts.length > 0) {
      suppliersToNotify.set(supplier, supplierProducts);
    }
  }

  // Отправляем уведомление об отмене каждому поставщику
  for (const [supplier, products] of suppliersToNotify) {
    const supplierNumber = suppliers[supplier].phone + '@s.whatsapp.net';
    if (supplierNumber) {
      await sock.sendMessage(supplierNumber, {
        text: `🚫 *Заказ отменен*

🏬 *Заведение:* ${order.location}
📅 *Дата и время:* ${order.datetime}
🛒 *Заказ:*

${products.join('\n')}`
      });
    }
  }

  delete activeOrders[orderId];
  delete pendingOrders[orderId];

  await sock.sendMessage(from, { 
    text: `✅ *Заказ отменен*

Заказ успешно отменен.

📋 *Информация о заказе:*
ID: *${orderId}*
🏬 *Заведение:* ${order.location}
📅 *Дата и время:* ${order.datetime}` 
  });

  return true;
};

export const handleOrderEdit = async (sock, from, text, activeOrders, pendingOrders, suppliers, ownerNumber) => {
  if (!text.toLowerCase().startsWith('редактировать') && !text.toLowerCase().startsWith('изменить')) {
    return false;
  }

  const [_, orderId, ...newOrderText] = text.split(' ');
  if (!orderId || !newOrderText.length) {
    await sock.sendMessage(from, { 
      text: `❌ *Ошибка*

Пожалуйста, укажите ID заказа и новый текст заказа.

Пример: *редактировать 1234567890 Огурцы 5кг, Помидоры 3кг*` 
    });
    return true;
  }

  const order = activeOrders[orderId] || pendingOrders[orderId];
  if (!order) {
    await sock.sendMessage(from, { 
      text: `❌ *Заказ не найден*

Проверьте ID заказа и попробуйте снова.

Пример: *редактировать 1234567890 Огурцы 5кг*` 
    });
    return true;
  }

  if (order.from !== from && from !== ownerNumber) {
    await sock.sendMessage(from, { 
      text: `❌ *Нет прав*

У вас нет прав для редактирования этого заказа.` 
    });
    return true;
  }

  if (order.status === 'delivered') {
    await sock.sendMessage(from, { 
      text: `❌ *Невозможно редактировать*

Нельзя редактировать уже доставленный заказ.` 
    });
    return true;
  }

  const newOrder = parseOrder(newOrderText.join(' '), suppliers);
  if (!newOrder) {
    await sock.sendMessage(from, { 
      text: `❌ *Ошибка распознавания*

Не удалось распознать новый заказ.

Пример формата:
• *Огурцы 13 кг*
• *Помидоры 5 кг*
• *Картофель 10 кг*` 
    });
    return true;
  }

  order.orderText = newOrder;
  const newOrderItems = newOrder.split('\n');
  const suppliersToNotify = new Map();
  
  // Определяем продукты каждого поставщика в новом заказе
  for (const [supplier, data] of Object.entries(suppliers)) {
    const supplierProducts = [];
    for (const product of data.products) {
      for (const orderItem of newOrderItems) {
        if (orderItem.toLowerCase().includes(product.toLowerCase())) {
          supplierProducts.push(orderItem);
        }
      }
    }
    if (supplierProducts.length > 0) {
      suppliersToNotify.set(supplier, supplierProducts);
    }
  }

  // Отправляем уведомление об изменении каждому поставщику
  for (const [supplier, products] of suppliersToNotify) {
    const supplierNumber = suppliers[supplier].phone + '@s.whatsapp.net';
    if (supplierNumber) {
      await sock.sendMessage(supplierNumber, {
        text: `📝 *Заказ отредактирован*

🏬 *Заведение:* ${order.location}
📅 *Дата и время:* ${order.datetime}
🛒 *Новый заказ:*

${products.join('\n')}`
      });
    }
  }

  await sock.sendMessage(from, { 
    text: `✅ *Заказ отредактирован*

Заказ успешно обновлен.

📋 *Информация о заказе:*
ID: *${orderId}*
🏬 *Заведение:* ${order.location}
📅 *Дата и время:* ${order.datetime}
🛒 *Новый заказ:*

${newOrder}` 
  });

  return true;
}; 