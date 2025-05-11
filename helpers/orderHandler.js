import { v4 as uuidv4 } from 'uuid';
import { parseOrder, isSimilar } from './parseOrder.js';
import { readFileSync } from 'fs';
import path from 'path';

// Читаем данные о сотрудниках
const employeesPath = path.join(__dirname, '../db/employees.json');
const employees = JSON.parse(readFileSync(employeesPath, 'utf8'));

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

// Функция для обработки заказа
async function handleOrder(message, client) {
    try {
        console.log('Начало обработки заказа:', message.body);
        
        // Парсим заказ
        const orders = parseOrder(message.body);
        if (!orders || orders.length === 0) {
            console.log('Не удалось распознать заказ');
            await client.sendMessage(message.from, '❌ Не удалось распознать заказ. Пожалуйста, проверьте формат.');
            return;
        }
        
        // Формируем текст заказа
        let orderText = '📋 *Новый заказ:*\n\n';
        for (const order of orders) {
            orderText += `• ${order.product} - ${order.quantity} ${order.unit}\n`;
            orderText += `  Поставщик: ${order.supplier.name}\n\n`;
        }
        
        // Отправляем подтверждение отправителю
        await client.sendMessage(message.from, 
            '✅ *Ваш заказ принят!*\n\n' + orderText
        );
        
        // Отправляем уведомление владельцу
        const ownerNumber = '77719119695';
        await client.sendMessage(ownerNumber, 
            '🔔 *Новый заказ!*\n\n' + orderText
        );
        
        console.log('Заказ успешно обработан');
        
    } catch (error) {
        console.error('Ошибка при обработке заказа:', error);
        await client.sendMessage(message.from, '❌ Произошла ошибка при обработке заказа. Пожалуйста, попробуйте позже.');
    }
}

module.exports = {
    handleOrder
}; 