export const handleAdminCommand = async (sock, from, text, pendingOrders, activeOrders, suppliers, ownerNumber) => {
  if (text.toLowerCase().includes('добро') || text.toLowerCase().includes('отказ')) {
    const orderId = Object.keys(pendingOrders).find(id => pendingOrders[id].status === 'waiting');
    if (!orderId) return;

    const order = pendingOrders[orderId];
    if (text.toLowerCase().includes('добро')) {
      // Отправляем заказ всем соответствующим поставщикам
      const orderItems = order.orderText.split('\n');
      const suppliersToNotify = new Map(); // Изменяем на Map для хранения продуктов каждого поставщика
      
      // Определяем, каким поставщикам нужно отправить заказ и какие продукты
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

      // Отправляем заказ каждому поставщику
      for (const [supplier, products] of suppliersToNotify) {
        const supplierNumber = suppliers[supplier].phone + '@s.whatsapp.net';
        if (!supplierNumber) {
          await sock.sendMessage(ownerNumber, { 
            text: `❌ *Ошибка*

Поставщик ${supplier} не найден в базе данных.` 
          });
          continue;
        }

        // Отправляем заказ поставщику только с его продуктами
        await sock.sendMessage(supplierNumber, {
          text: `📦 *Новый заказ*

🏬 *Заведение:* ${order.location}
📅 *Дата и время:* ${order.datetime}

🛒 *Заказ:*

${products.join('\n')}

❗️ *Важно:* Если вы не сможете поставить какую-либо позицию, пожалуйста, сообщите об этом, указав название продукта.

Пример: *Не могу поставить: Огурцы*
или
*Проблема с: Помидоры, Картофель*`
        });
      }

      // Отправляем подтверждение клиенту
      await sock.sendMessage(order.from, { 
        text: `✅ *Заказ подтвержден*

Ваш заказ успешно подтвержден и отправлен поставщикам!

📋 *Информация о заказе:*
ID: *${orderId}*
🏬 *Заведение:* ${order.location}
📅 *Дата и время:* ${order.datetime}

_Для управления заказом используйте команды:_
• Отмена: *отмена ${orderId}*
• Редактирование: *редактировать ${orderId} [новый текст заказа]*` 
      });
      
      // Перемещаем заказ в активные
      activeOrders[orderId] = order;
      delete pendingOrders[orderId];
    } else {
      await sock.sendMessage(order.from, { 
        text: `❌ *Заказ отклонен*

Ваш заказ был отклонен администратором.

Пожалуйста, отправьте новый заказ.` 
      });
      delete pendingOrders[orderId];
    }
    return true;
  }
  return false;
}; 