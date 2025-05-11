import { v4 as uuidv4 } from 'uuid';
import { parseOrder } from './parseOrder.js';
import { readFileSync } from 'fs';

const employees = JSON.parse(readFileSync('./db/employees.json', 'utf-8'));

// Функция для проверки соответствия продукта
function findMatchingSupplier(product, suppliers) {
  const normalizedProduct = product.toLowerCase().trim();
  
  for (const supplier of suppliers) {
    for (const supplierProduct of supplier.products) {
      if (normalizedProduct.includes(supplierProduct.toLowerCase()) || 
          supplierProduct.toLowerCase().includes(normalizedProduct)) {
        return supplier.name;
      }
    }
  }
  return null;
}

export const handleOrder = async (sock, from, text, session, suppliers, ownerNumber) => {
  try {
    // Получаем информацию об отправителе
    const senderPhone = from.split('@')[0];
    const senderName = 'Сотрудник'; // Упрощаем логику, используем фиксированное имя

    // Парсим заказ
    const items = parseOrder(text);
    if (!items || items.length === 0) {
      await sock.sendMessage(from, { 
        text: `❌ *Ошибка в формате заказа*

Пожалуйста, укажите товары в формате:
_название количество_

Примеры:
• Булочки 30 шт
• Пельмени 5 кг
• Страчателла 1 кг` 
      });
      return { orderId: null, order: null };
    }

    // Проверяем каждый продукт на соответствие поставщикам
    const matchedItems = [];
    const unmatchedItems = [];
    
    for (const item of items) {
      const productName = item.split(/\d/)[0].trim();
      const supplier = findMatchingSupplier(productName, suppliers);
      
      if (supplier) {
        matchedItems.push(item);
      } else {
        unmatchedItems.push(item);
      }
    }

    // Если есть несоответствующие продукты, отправляем предупреждение
    if (unmatchedItems.length > 0) {
      await sock.sendMessage(from, {
        text: `⚠️ *Внимание!*

Следующие продукты не найдены в базе данных поставщиков:
${unmatchedItems.map(item => `• ${item}`).join('\n')}

Пожалуйста, проверьте названия продуктов и попробуйте снова.`
      });
      return { orderId: null, order: null };
    }
    
    // Создаем объект заказа
    const orderId = uuidv4();
    const order = {
      id: orderId,
      location: session.location,
      datetime: session.datetime,
      items: matchedItems,
      status: 'pending',
      sender: {
        name: senderName,
        phone: senderPhone
      },
      orderText: matchedItems.join('\n')
    };

    // Отправляем сообщение владельцу
    const ownerMsg = `🆕 *Новый заказ*

📍 *Заведение:* ${order.location}
📅 *Дата:* ${order.datetime}
👤 *От:* ${order.sender.name} (${order.sender.phone})

📝 *Заказ:*
${order.items.map(item => `• ${item}`).join('\n')}

❗️ *Команды для управления заказом:*

✅ *Подтвердить заказ:*
\`добро\`

❌ *Отменить заказ:*
\`отказ\`

✏️ *Редактировать заказ:*
\`редактировать\``;

    await sock.sendMessage(ownerNumber, { text: ownerMsg });

    // Отправляем сообщение только Олжасу на подтверждение
    const olzhasMsg = `🆕 *Новый заказ на подтверждение*

📍 *Заведение:* ${order.location}
📅 *Дата:* ${order.datetime}
👤 *От:* ${order.sender.name} (${order.sender.phone})

📝 *Заказ:*
${order.items.map(item => `• ${item}`).join('\n')}

❗️ *Команды для управления заказом:*

✅ *Подтвердить заказ:*
\`добро\`

❌ *Отменить заказ:*
\`отказ\`

✏️ *Редактировать заказ:*
\`редактировать\``;

    // Отправляем сообщение только Олжасу
    const olzhasSupplier = suppliers.find(s => s.name === 'Олжас');
    if (olzhasSupplier) {
      await sock.sendMessage(olzhasSupplier.phone + '@s.whatsapp.net', { text: olzhasMsg });
    }

    // Отправляем подтверждение отправителю
    const confirmationMsg = `✅ *Заказ принят*

Ваш заказ успешно создан и отправлен на подтверждение.

📍 *Заведение:* ${order.location}
📅 *Дата:* ${order.datetime}

📝 *Заказ:*
${order.items.map(item => `• ${item}`).join('\n')}

❗️ *Команды для управления заказом:*

❌ *Отменить заказ:*
\`отказ\`

✏️ *Редактировать заказ:*
\`редактировать\``;

    await sock.sendMessage(from, { text: confirmationMsg });

    return { orderId, order };
  } catch (error) {
    console.error('Error handling order:', error);
    await sock.sendMessage(from, { 
      text: `❌ *Ошибка при создании заказа*

Пожалуйста, попробуйте создать заказ еще раз.` 
    });
    return { orderId: null, order: null };
  }
}; 