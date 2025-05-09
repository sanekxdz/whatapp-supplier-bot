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
function isSimilar(word1, word2) {
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
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^а-яa-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

export const parseOrder = (text) => {
  try {
    // Разбиваем текст на строки
    const lines = text.split(/[\n,]+/).map(line => line.trim()).filter(Boolean);
    
    // Массив для хранения обработанных позиций
    const parsedItems = [];
    
    // Временные переменные для хранения текущего товара и его количества
    let currentItem = null;
    let currentQuantity = null;
    
    for (const line of lines) {
      // Проверяем, содержит ли строка количество
      const hasQuantity = /\d+(\.\d+)?\s*(кг|шт|г|л|мл)/.test(line);
      
      if (hasQuantity) {
        // Если это строка с количеством и у нас есть предыдущий товар без количества
        if (currentItem && !currentQuantity) {
          parsedItems.push(`${currentItem} ${line}`);
          currentItem = null;
          currentQuantity = null;
        } else {
          // Если это просто строка с количеством, сохраняем ее
          currentQuantity = line;
        }
      } else {
        // Если это название товара
        if (currentQuantity) {
          // Если у нас есть сохраненное количество, объединяем с текущим товаром
          parsedItems.push(`${line} ${currentQuantity}`);
          currentItem = null;
          currentQuantity = null;
        } else {
          // Если это просто название товара, сохраняем его
          if (currentItem) {
            // Если у нас уже есть сохраненный товар, добавляем его как есть
            parsedItems.push(currentItem);
          }
          currentItem = line;
        }
      }
    }
    
    // Обрабатываем оставшиеся данные
    if (currentItem && currentQuantity) {
      parsedItems.push(`${currentItem} ${currentQuantity}`);
    } else if (currentItem) {
      parsedItems.push(currentItem);
    } else if (currentQuantity) {
      parsedItems.push(currentQuantity);
    }
    
    return parsedItems;
  } catch (error) {
    console.error('Error parsing order:', error);
    return null;
  }
};
