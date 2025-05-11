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
    console.log('📝 Начало парсинга текста:', text);
    
    // Разбиваем текст на строки и обрабатываем дефисы
    const lines = text
      .replace(/-/g, ' ') // Заменяем дефисы на пробелы
      .split(/[\n,]+/)
      .map(line => line.trim())
      .filter(Boolean);
    
    console.log('📋 Разбитые строки:', lines);
    
    // Массив для хранения обработанных позиций
    const parsedItems = [];
    
    for (const line of lines) {
      console.log('🔍 Обработка строки:', line);
      
      // Ищем количество в строке
      const quantityMatch = line.match(/(\d+(?:\.\d+)?)\s*(кг|шт|г|л|мл)/i);
      if (quantityMatch) {
        const [_, amount, unit] = quantityMatch;
        console.log('📊 Найдено количество:', amount, unit);
        
        // Получаем название продукта, убирая количество
        const productName = line
          .replace(quantityMatch[0], '')
          .trim()
          .replace(/\s+/g, ' '); // Убираем лишние пробелы
        
        console.log('📦 Название продукта:', productName);
        
        if (productName) {
          parsedItems.push(`${productName} ${amount} ${unit}`);
        }
      } else {
        console.log('⚠️ Не найдено количество в строке:', line);
      }
    }
    
    console.log('✅ Результат парсинга:', parsedItems);
    return parsedItems;
  } catch (error) {
    console.error('❌ Ошибка при парсинге заказа:', error);
    console.error('Stack trace:', error.stack);
    return null;
  }
};
