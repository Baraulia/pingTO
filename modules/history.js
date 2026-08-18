// modules/history.js
export class HistoryManager {
  constructor(storage) {
    this.storage = storage;
    this.key = 'api_history';
    this.items = [];
    this.loaded = false;
  }

  async load() {
    this.items = await this.storage.get(this.key, []);
    this.loaded = true;
    
    // Миграция старых ID (числа → строки)
    await this.migrateIds();
    
    return this.items;
  }

  // Миграция ID для совместимости со старыми записями
  async migrateIds() {
    let migrated = false;
    
    this.items = this.items.map(item => {
      // Если ID - число или строка с десятичной точкой (старый формат)
      if (item.id !== undefined) {
        const idStr = String(item.id);
        
        // Проверяем, является ли ID числом или строкой типа "1734567890123.456"
        if (!idStr.includes('_') && /^[\d.]+$/.test(idStr)) {
          // Создаем новый ID в формате "timestamp_random"
          const timestamp = Math.floor(Number(idStr));
          const random = Math.random().toString(36).substring(2, 9);
          const newId = `${timestamp}_${random}`;
          
          // Сохраняем старый ID для обратной совместимости (опционально)
          item._oldId = item.id;
          item.id = newId;
          migrated = true;
          
          console.log(`🔄 Migrated ID: ${item._oldId} → ${item.id}`);
        }
      }
      
      // Если ID отсутствует - генерируем новый
      if (!item.id) {
        const timestamp = item.timestamp || Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        item.id = `${timestamp}_${random}`;
        migrated = true;
      }
      
      return item;
    });

    if (migrated) {
      await this.save();
      console.log('✅ History IDs migrated successfully');
    }
  }

  async add(item) {
    if (!this.loaded) await this.load();
    
    // Генерируем уникальный ID в формате "timestamp_random"
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    item.id = `${timestamp}_${random}`;
    
    // Сохраняем timestamp для сортировки
    if (!item.timestamp) {
      item.timestamp = timestamp;
    }
    
    this.items.unshift(item);
    await this.save();
    return item;
  }

  async save() {
    await this.storage.set(this.key, this.items);
  }

  getItems(limit = 50) {
    if (!this.loaded) return [];
    return this.items.slice(0, limit);
  }

  // ИСПРАВЛЕННАЯ ВЕРСИЯ - поддержка обоих типов ID
  getById(id) {
    if (!this.loaded) return null;
    // Сравниваем как строки для поддержки и чисел, и строк
    return this.items.find(item => String(item.id) === String(id));
  }

  // Поиск с поддержкой старого ID формата
  getByOldId(oldId) {
    if (!this.loaded) return null;
    return this.items.find(item => String(item._oldId) === String(oldId));
  }

  async clear() {
    this.items = [];
    await this.save();
  }

  getAll() {
    return this.items;
  }

  // Удаление записи по ID
  async remove(id) {
    if (!this.loaded) await this.load();
    const index = this.items.findIndex(item => String(item.id) === String(id));
    if (index !== -1) {
      this.items.splice(index, 1);
      await this.save();
      return true;
    }
    return false;
  }

  // Поиск по истории
  search(query) {
    if (!this.loaded) return [];
    const lowerQuery = query.toLowerCase();
    return this.items.filter(item => 
      item.url.toLowerCase().includes(lowerQuery) ||
      item.method.toLowerCase().includes(lowerQuery) ||
      (item.status && String(item.status).includes(query))
    );
  }

  // Получить последний запрос
  getLast() {
    if (!this.loaded || this.items.length === 0) return null;
    return this.items[0];
  }

  // Получить статистику
  getStats() {
    if (!this.loaded) return { total: 0, success: 0, methods: {} };
    
    const total = this.items.length;
    const success = this.items.filter(item => item.status >= 200 && item.status < 300).length;
    const methods = {};
    this.items.forEach(item => {
      methods[item.method] = (methods[item.method] || 0) + 1;
    });
    
    return {
      total,
      success,
      successRate: total ? Math.round((success / total) * 100) : 0,
      methods
    };
  }

  // Очистка старых записей (старше N дней)
  async cleanOld(days = 30) {
    if (!this.loaded) await this.load();
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const before = this.items.length;
    this.items = this.items.filter(item => {
      const timestamp = item.timestamp || parseInt(String(item.id).split('_')[0]) || Date.now();
      return timestamp >= cutoff;
    });
    const removed = before - this.items.length;
    if (removed > 0) {
      await this.save();
      console.log(`🧹 Removed ${removed} old history entries (older than ${days} days)`);
    }
    return removed;
  }

  // Дедупликация (удаляем дублирующиеся запросы)
  async deduplicate() {
    if (!this.loaded) await this.load();
    const seen = new Set();
    const before = this.items.length;
    this.items = this.items.filter(item => {
      const key = `${item.method}_${item.url}_${item.status || 0}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    const removed = before - this.items.length;
    if (removed > 0) {
      await this.save();
      console.log(`🧹 Removed ${removed} duplicate entries`);
    }
    return removed;
  }

  // Экспорт в JSON
  exportToJson() {
    return JSON.stringify(this.items, null, 2);
  }

  // Импорт из JSON (с добавлением, а не заменой)
  async importFromJson(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      if (!Array.isArray(data)) return false;
      
      if (!this.loaded) await this.load();
      
      let imported = 0;
      data.forEach(item => {
        // Проверяем, нет ли уже такого запроса
        const exists = this.items.some(existing => 
          existing.url === item.url && 
          existing.method === item.method &&
          existing.timestamp === item.timestamp
        );
        
        if (!exists) {
          // Если у импортируемого item нет ID - генерируем
          if (!item.id) {
            const timestamp = item.timestamp || Date.now();
            const random = Math.random().toString(36).substring(2, 9);
            item.id = `${timestamp}_${random}`;
          }
          this.items.push(item);
          imported++;
        }
      });
      
      if (imported > 0) {
        await this.save();
        console.log(`📥 Imported ${imported} entries`);
      }
      return imported;
    } catch (error) {
      console.error('Failed to import history:', error);
      return false;
    }
  }

  // Получить историю по URL
  getByUrl(url) {
    if (!this.loaded) return [];
    return this.items.filter(item => item.url === url);
  }

  // Получить историю по методу
  getByMethod(method) {
    if (!this.loaded) return [];
    return this.items.filter(item => item.method.toUpperCase() === method.toUpperCase());
  }
}