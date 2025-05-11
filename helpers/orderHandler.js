import { v4 as uuidv4 } from 'uuid';
import { parseOrder, isSimilar } from './parseOrder.js';
import { readFileSync } from 'fs';

const employees = JSON.parse(readFileSync('./db/employees.json', 'utf-8'));

// Функция для проверки соответствия продукта
function findMatchingSupplier(product, suppliers) {
  console.log('🔍 Поиск поставщика для продукта:', product);
  
  const normalizedProduct = product.toLowerCase().trim();
  console.log('📝 Нормализованное название продукта:', normalizedProduct);
  
  for (const supplier of suppliers) {
    console.log('🔎 Проверка поставщика:', supplier.name);
    for (const supplierProduct of supplier.products) {
      const normalizedSupplierProduct = supplierProduct.toLowerCase().trim();
      console.log('📦 Проверка продукта поставщика:', normalizedSupplierProduct);
      
      // Используем функцию isSimilar для более гибкого сравнения
      if (isSimilar(normalizedProduct, normalizedSupplierProduct)) {
        console.log('✅ Найден подходящий поставщик:', supplier.name);
        return supplier.name;
      }
    }
  }
  console.log('❌ Поставщик не найден для продукта:', product);
  return null;
}

export const handleOrder = async (sock, from, text, session, suppliers, ownerNumber) => {
  try {
    console.log('📨 Начало обработки заказа');
    console.log('📝 Текст заказа:', text);
    console.log('👤 Отправитель:', from);
    console.log('🏬 Локация:', session.location);
    console.log('📅 Дата:', session.datetime);
    
    // Получаем информацию об отправителе
    const senderPhone = from.split('@')[0];
    const senderName = 'Сотрудник';
    console.log('📱 Телефон отправителя:', senderPhone);

    // Парсим заказ
    console.log('🔄 Начало парсинга заказа');
    const items = parseOrder(text);
    console.log('📦 Распарсенные товары:', items);
    
    if (!items || items.length === 0) {
      console.log('❌ Ошибка: пустой заказ');
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
    
    console.log('🔍 Начало проверки продуктов');
    for (const item of items) {
      console.log('📦 Проверка товара:', item);
      // Извлекаем название продукта до первого числа
      const productName = item.split(/\d/)[0].trim();
      console.log('📝 Название продукта:', productName);
      
      const supplier = findMatchingSupplier(productName, suppliers);
      
      if (supplier) {
        console.log('✅ Товар найден у поставщика:', supplier);
        matchedItems.push(item);
      } else {
        console.log('❌ Товар не найден у поставщиков');
        unmatchedItems.push(item);
      }
    }

    // Если есть несоответствующие продукты, отправляем предупреждение
    if (unmatchedItems.length > 0) {
      console.log('⚠️ Найдены несоответствующие товары:', unmatchedItems);
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
    console.log('📋 Создан объект заказа:', order);

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

    console.log('📤 Отправка сообщения владельцу');
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
    console.log('🔍 Поиск поставщика Олжас');
    const olzhasSupplier = suppliers.find(s => s.name === 'Олжас');
    if (olzhasSupplier) {
      console.log('📤 Отправка сообщения Олжасу');
      await sock.sendMessage(olzhasSupplier.phone + '@s.whatsapp.net', { text: olzhasMsg });
    } else {
      console.log('⚠️ Поставщик Олжас не найден');
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

    console.log('📤 Отправка подтверждения отправителю');
    await sock.sendMessage(from, { text: confirmationMsg });

    console.log('✅ Заказ успешно обработан');
    return { orderId, order };
  } catch (error) {
    console.error('❌ Ошибка при обработке заказа:', error);
    console.error('Stack trace:', error.stack);
    await sock.sendMessage(from, { 
      text: `❌ *Ошибка при создании заказа*

Пожалуйста, попробуйте создать заказ еще раз.` 
    });
    return { orderId: null, order: null };
  }
}; 