import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseOrder } from './parseOrder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Читаем данные о сотрудниках
const employeesPath = path.join(__dirname, '../db/employees.json');
const employees = JSON.parse(readFileSync(employeesPath, 'utf8'));

// Читаем данные о поставщиках
const suppliersPath = path.join(__dirname, '../db/suppliers.json');
const suppliers = JSON.parse(readFileSync(suppliersPath, 'utf8'));

// Функция для проверки, есть ли продукт в базе данных
function isProductInDatabase(productName) {
    const normalizedProduct = productName.toLowerCase().trim();
    for (const supplier of suppliers) {
        for (const supplierProduct of supplier.products) {
            if (supplierProduct.toLowerCase().includes(normalizedProduct) || 
                normalizedProduct.includes(supplierProduct.toLowerCase())) {
                return true;
            }
        }
    }
    return false;
}

// Функция для разбиения заказа на продукты
function splitOrderIntoProducts(orderText) {
    // Разбиваем по запятым, "и" и пробелам
    return orderText
        .split(/[,и]/)
        .map(item => item.trim())
        .filter(item => item)
        .map(item => {
            // Ищем количество (число перед кг или шт)
            const quantityMatch = item.match(/(\d+)\s*(кг|шт)/i);
            if (quantityMatch) {
                const quantity = quantityMatch[1];
                const unit = quantityMatch[2].toLowerCase();
                const productName = item.substring(0, quantityMatch.index).trim();
                return `${productName} ${quantity} ${unit}`;
            }
            return item;
        });
}

// Функция для распределения продуктов по поставщикам
function distributeProductsBySupplier(products) {
    const distribution = new Map();
    
    for (const product of products) {
        let found = false;
        for (const supplier of suppliers) {
            for (const supplierProduct of supplier.products) {
                if (supplierProduct.toLowerCase().includes(product.toLowerCase()) || 
                    product.toLowerCase().includes(supplierProduct.toLowerCase())) {
                    if (!distribution.has(supplier.name)) {
                        distribution.set(supplier.name, []);
                    }
                    distribution.get(supplier.name).push(product);
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
    }
    
    return distribution;
}

export async function handleOrder(sock, from, text, session, suppliers, ownerNumber) {
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
        
        // Разбиваем заказ на отдельные продукты
        const orderItems = splitOrderIntoProducts(text);
        console.log('📦 Разбитые продукты:', orderItems);
        
        // Разделяем продукты на известные и неизвестные
        const knownProducts = [];
        const unknownProducts = [];
        
        for (const item of orderItems) {
            if (isProductInDatabase(item)) {
                knownProducts.push(item);
            } else {
                unknownProducts.push(item);
            }
        }
        
        console.log('✅ Известные продукты:', knownProducts);
        console.log('❌ Неизвестные продукты:', unknownProducts);
        
        // Распределяем известные продукты по поставщикам
        const productDistribution = distributeProductsBySupplier(knownProducts);
        console.log('📊 Распределение по поставщикам:', Object.fromEntries(productDistribution));
        
        // Создаем объект заказа
        const orderId = uuidv4();
        const order = {
            id: orderId,
            location: session.location,
            datetime: session.datetime,
            items: knownProducts,
            unknownItems: unknownProducts,
            status: 'pending',
            sender: {
                name: senderName,
                phone: senderPhone
            },
            orderText: text
        };
        console.log('📋 Создан объект заказа:', order);

        // Отправляем сообщение владельцу
        let ownerMsg = `🆕 *Новый заказ*

📍 *Заведение:* ${order.location}
📅 *Дата:* ${order.datetime}
👤 *От:* ${order.sender.name} (${order.sender.phone})

📝 *Заказ:*
${knownProducts.map(item => `• ${item}`).join('\n')}`;

        // Если есть неизвестные продукты, добавляем их в отдельный список
        if (unknownProducts.length > 0) {
            ownerMsg += `\n\n⚠️ *Продукты, которых нет в базе данных:*
${unknownProducts.map(item => `• ${item}`).join('\n')}

❗️ *Пожалуйста, проверьте эти продукты и добавьте их в базу данных, если они должны быть доступны.*`;
        }

        ownerMsg += `\n\n❗️ *Команды для управления заказом:*

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
${knownProducts.map(item => `• ${item}`).join('\n')}`;

        if (unknownProducts.length > 0) {
            olzhasMsg += `\n\n⚠️ *Продукты, которых нет в базе данных:*
${unknownProducts.map(item => `• ${item}`).join('\n')}

❗️ *Пожалуйста, проверьте эти продукты и добавьте их в базу данных, если они должны быть доступны.*`;
        }

        olzhasMsg += `\n\n❗️ *Команды для управления заказом:*

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
        
        // Отправляем подтверждение отправителю с распределением по поставщикам
        let confirmationMsg = `✅ *Заказ принят*

Ваш заказ успешно создан и отправлен на подтверждение.

📍 *Заведение:* ${order.location}
📅 *Дата:* ${order.datetime}

📝 *Распределение заказа по поставщикам:*`;

        // Добавляем информацию о распределении продуктов
        for (const [supplier, products] of productDistribution) {
            confirmationMsg += `\n\n*${supplier}:*
${products.map(item => `• ${item}`).join('\n')}`;
        }

        confirmationMsg += `\n\n❗️ *Команды для управления заказом:*

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
} 