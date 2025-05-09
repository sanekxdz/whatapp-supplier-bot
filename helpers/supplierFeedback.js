import { parseOrder } from './parseOrder.js';

export const handleSupplierFeedback = async (sock, from, text, activeOrders, suppliers, ownerNumber) => {
  // Проверяем, является ли отправитель поставщиком
  const supplier = Object.entries(suppliers).find(([_, data]) => data.phone + '@s.whatsapp.net' === from);
  if (!supplier) return false;

  // Проверяем, является ли сообщение уведомлением о проблеме с поставкой
  const isIssueReport = text.toLowerCase().includes('не могу поставить') || 
                       text.toLowerCase().includes('проблема с') ||
                       text.toLowerCase().includes('нет в наличии');

  if (!isIssueReport) return false;

  // Извлекаем названия проблемных продуктов
  let problemProducts = [];
  const parts = text.toLowerCase().split(':');
  let productText = '';

  if (parts.length > 1) {
    productText = parts[1].trim();
  } else {
    // Если двоеточие не найдено или оно в конце, ищем после фразы "не могу поставить" или "проблема с"
    if (text.toLowerCase().includes('не могу поставить')) {
      productText = text.toLowerCase().replace('не могу поставить', '').trim();
    } else if (text.toLowerCase().includes('проблема с')) {
      productText = text.toLowerCase().replace('проблема с', '').trim();
    }
  }

  if (productText) {
    const products = productText.split(',').map(p => p.trim());
    problemProducts = products.filter(p => p.length > 0);
  }

  if (problemProducts.length === 0) {
    await sock.sendMessage(from, {
      text: `❌ *Ошибка формата*

Пожалуйста, укажите продукты после фразы "не могу поставить" или используйте двоеточие.

Примеры:
• *Не могу поставить: Огурцы*
• *Не могу поставить огурцы*
• *Проблема с: Помидоры, Картофель*`
    });
    return true;
  }

  // Находим активные заказы этого поставщика
  const relevantOrders = Object.entries(activeOrders)
    .filter(([_, order]) => {
      const orderProducts = order.orderText.split('\n');
      return orderProducts.some(op => {
        return problemProducts.some(pp => op.toLowerCase().includes(pp.toLowerCase()));
      });
    });

  if (relevantOrders.length === 0) {
    await sock.sendMessage(from, {
      text: `❌ *Ошибка*

У вас нет активных заказов с указанными продуктами.`
    });
    return true;
  }

  // Отправляем уведомление администратору и клиентам
  for (const [orderId, order] of relevantOrders) {
    // Уведомление администратору
    await sock.sendMessage(ownerNumber, {
      text: `⚠️ *Проблема с поставкой*

🏬 *Заведение:* ${order.location}
📅 *Дата и время:* ${order.datetime}
👤 *Поставщик:* ${supplier[0]}

❌ *Не может поставить:*
${problemProducts.join('\n')}

📋 *ID заказа:* ${orderId}`
    });

    // Уведомление клиенту
    await sock.sendMessage(order.from, {
      text: `⚠️ *Важное уведомление по заказу*

К сожалению, поставщик сообщил о проблеме с поставкой следующих позиций:
${problemProducts.join('\n')}

📋 *ID заказа:* ${orderId}
🏬 *Заведение:* ${order.location}
📅 *Дата и время:* ${order.datetime}

Администратор уведомлен и свяжется с вами для обсуждения альтернативных вариантов.`
    });
  }

  // Отправляем подтверждение поставщику
  await sock.sendMessage(from, {
    text: `✅ *Уведомление отправлено*

Спасибо за информацию. Администратор и клиент уведомлены о проблеме с поставкой следующих позиций:
${problemProducts.join('\n')}`
  });

  return true;
}; 