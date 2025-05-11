const fs = require('fs');
const path = require('path');

// Читаем данные о поставщиках
const suppliersPath = path.join(__dirname, '../db/suppliers.json');
const suppliers = JSON.parse(fs.readFileSync(suppliersPath, 'utf8'));

// Функция для вычисления расстояния Левенштейна
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Функция для проверки схожести слов
export function isSimilar(word1, word2) {
  // Если одно слово является подстрокой другого, считаем их похожими
  if (word1.includes(word2) || word2.includes(word1)) {
    return true;
  }
  
  const maxLength = Math.max(word1.length, word2.length);
  const distance = levenshteinDistance(word1.toLowerCase(), word2.toLowerCase());
  
  // Увеличиваем порог до 40% для более мягкого сравнения
  return distance <= maxLength * 0.4;
}

// Функция для нормализации текста
function normalizeText(text) {
    return text.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Функция для поиска продукта у поставщиков
function findProductInSuppliers(productName) {
    const normalizedProduct = normalizeText(productName);
    console.log('Поиск продукта:', normalizedProduct);
    
    for (const supplier of suppliers) {
        console.log('Проверка поставщика:', supplier.name);
        for (const supplierProduct of supplier.products) {
            const normalizedSupplierProduct = normalizeText(supplierProduct);
            console.log('Сравнение с:', normalizedSupplierProduct);
            
            if (normalizedSupplierProduct.includes(normalizedProduct) || 
                normalizedProduct.includes(normalizedSupplierProduct)) {
                console.log('Найдено совпадение!');
                return {
                    supplier,
                    product: supplierProduct
                };
            }
        }
    }
    
    console.log('Продукт не найден');
    return null;
}

// Функция для создания вариантов написания продукта
function generateProductVariants(product) {
  const variants = [product.toLowerCase()];
  
  // Добавляем нормализованную версию
  variants.push(normalizeText(product));
  
  // Добавляем версию без пробелов
  variants.push(product.toLowerCase().replace(/\s+/g, ''));
  
  // Добавляем версию с заменой букв, которые часто путают
  variants.push(product.toLowerCase()
    .replace(/о/g, 'а')
    .replace(/а/g, 'о')
    .replace(/и/g, 'е')
    .replace(/е/g, 'и')
    .replace(/с/g, 'з')
    .replace(/з/g, 'с')
    .replace(/л/g, 'л')
    .replace(/л/g, 'л'));
  
  // Добавляем версию с пропущенными буквами (для коротких слов)
  if (product.length > 3) {
    for (let i = 0; i < product.length; i++) {
      const variant = product.substring(0, i) + product.substring(i + 1);
      variants.push(variant.toLowerCase());
    }
  }
  
  return [...new Set(variants)]; // Удаляем дубликаты
}

// Функция для парсинга заказа
function parseOrder(orderText) {
    console.log('Начало парсинга заказа:', orderText);
    
    // Разбиваем текст на строки и удаляем дубликаты
    const lines = [...new Set(orderText.split('\n')
        .map(line => line.trim())
        .filter(line => line))];
    
    console.log('Уникальные строки:', lines);
    
    const orders = [];
    const processedProducts = new Set(); // Для отслеживания уже обработанных продуктов
    
    for (const line of lines) {
        // Ищем количество (число перед кг или шт)
        const quantityMatch = line.match(/(\d+)\s*(кг|шт)/i);
        if (!quantityMatch) {
            console.log('Не найдено количество в строке:', line);
            continue;
        }
        
        const quantity = parseInt(quantityMatch[1]);
        const unit = quantityMatch[2].toLowerCase();
        
        // Получаем название продукта (всё до количества)
        const productName = line.substring(0, quantityMatch.index).trim();
        const normalizedProductName = normalizeText(productName);
        
        // Пропускаем, если этот продукт уже был обработан
        if (processedProducts.has(normalizedProductName)) {
            console.log('Пропуск дубликата:', productName);
            continue;
        }
        
        console.log('Обработка продукта:', productName, 'количество:', quantity, unit);
        
        // Ищем продукт у поставщиков
        const productInfo = findProductInSuppliers(productName);
        if (!productInfo) {
            console.log('Продукт не найден у поставщиков:', productName);
            continue;
        }
        
        orders.push({
            product: productInfo.product,
            quantity,
            unit,
            supplier: productInfo.supplier,
            originalText: line
        });
        
        // Добавляем продукт в список обработанных
        processedProducts.add(normalizedProductName);
    }
    
    console.log('Результат парсинга:', orders);
    return orders;
}

module.exports = {
    parseOrder,
    findProductInSuppliers
};
