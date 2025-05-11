import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Читаем данные о сотрудниках
const employeesPath = path.join(__dirname, '../db/employees.json');
const employees = JSON.parse(readFileSync(employeesPath, 'utf8'));

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
        
        // Создаем объект заказа
        const orderId = uuidv4();
        const order = {
            id: orderId,
            location: session.location,
            datetime: session.datetime,
            items: [text],
            status: 'pending',
            sender: {
                name: senderName,
                phone: senderPhone
            },
            orderText: text
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
} 