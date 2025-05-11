import pkg from '@whiskeysockets/baileys';
import { makeWASocket, fetchLatestBaileysVersion, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { readFileSync } from 'fs';
import qrcode from 'qrcode-terminal';
import { handleOrder } from './helpers/orderHandler.js';
import { handleAdminCommand } from './helpers/adminHandler.js';
import { handleOrderCancellation, handleOrderEdit } from './helpers/orderManagement.js';
import { handleSupplierFeedback } from './helpers/supplierFeedback.js';
import crypto from 'crypto';
globalThis.crypto = crypto;

// Загрузка конфигурации
try {
  const suppliers = JSON.parse(readFileSync('./db/suppliers.json', 'utf-8'));
  const locations = JSON.parse(readFileSync('./db/locations.json', 'utf-8'));
  const ownerNumber = '77754723974@s.whatsapp.net';

  const sessions = {};
  const pendingOrders = {};
  const activeOrders = {};

  const startSock = async () => {
    console.log('🚀 Бот запускается...');
    try {
      const { state, saveCreds } = await useMultiFileAuthState('./sessions');
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          console.log('📱 Новый QR-код сгенерирован');
          qrcode.generate(qr, { small: true });
        }
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
          console.log('🔄 Переподключение к WhatsApp...');
          startSock();
        }
      });

      sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
          const msg = messages[0];
          if (!msg.message || msg.key.fromMe) return;

          const from = msg.key.remoteJid;
          if (from.endsWith('@g.us')) {
            console.log(`📨 Пропуск группового сообщения от ${from}`);
            return;
          }

          const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
          if (!text) return;

          console.log(`\n📨 Новое сообщение от ${from}:`);
          console.log(`📝 Текст: ${text}`);

          const isSupplier = Object.entries(suppliers).some(([_, data]) => data.phone + '@s.whatsapp.net' === from);

          // Обработка команд администратора
          if (from === ownerNumber) {
            const handled = await handleAdminCommand(sock, from, text, pendingOrders, activeOrders, suppliers, ownerNumber);
            if (handled) return;
          }

          // Обработка обратной связи от поставщиков
          const feedbackHandled = await handleSupplierFeedback(sock, from, text, activeOrders, suppliers, ownerNumber);
          if (feedbackHandled) return;

          if (isSupplier) return;

          // Обработка отмены заказа
          const cancelled = await handleOrderCancellation(sock, from, text, activeOrders, pendingOrders, suppliers);
          if (cancelled) return;

          // Обработка редактирования заказа
          const edited = await handleOrderEdit(sock, from, text, activeOrders, pendingOrders, suppliers, ownerNumber);
          if (edited) return;

          // Обработка нового заказа
          if (!sessions[from]) {
            console.log(`🆕 Начало новой сессии для ${from}`);
            sessions[from] = { step: 1 };
            let locationMsg = `*🏬 Выберите заведение*

Выберите номер заведения из списка ниже:

1️⃣ *Bookish Cafe*
📍 просп. Мангилик Ел, 35/1

2️⃣ *Book Cafe*
📍 ул. Максут Нарикбаева, 22

_Введите 1 или 2 для выбора_`;
            await sock.sendMessage(from, { text: locationMsg });
            return;
          }

          const session = sessions[from];
          console.log(`📝 Обработка шага ${session.step} для ${from}`);

          if (session.step === 1) {
            if (!locations[text]) {
              return await sock.sendMessage(from, { 
                text: `❌ *Ошибка выбора*

Пожалуйста, введите *1* или *2* для выбора заведения.

1️⃣ Bookish Cafe
2️⃣ Book Cafe` 
              });
            }
            session.location = locations[text];
            
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const day = tomorrow.getDate().toString().padStart(2, '0');
            const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
            session.datetime = `${day}.${month}`;
            
            session.step = 2;
            return await sock.sendMessage(from, { 
              text: `🛒 *Введите ваш заказ*

_Формат: Название продукта количество_

Примеры:
• *Огурцы 13 кг*
• *Помидоры 5 кг*
• *Картофель 10 кг*

❗️ Можно указать несколько продуктов через запятую или "и"` 
            });
          }

          if (session.step === 2) {
            const { orderId, order } = await handleOrder(sock, from, text, session, suppliers, ownerNumber);
            if (orderId && order) {
              pendingOrders[orderId] = order;
              delete sessions[from];
            }
          }
        } catch (error) {
          console.error('❌ Ошибка при обработке сообщения:', error);
          await sock.sendMessage(from, { 
            text: `❌ *Произошла ошибка*

Пожалуйста, попробуйте еще раз или обратитесь к администратору.` 
          });
        }
      });
    } catch (error) {
      console.error('❌ Ошибка при инициализации бота:', error);
      setTimeout(startSock, 5000); // Повторная попытка через 5 секунд
    }
  };

  console.log('🤖 Инициализация бота...');
  startSock();
} catch (error) {
  console.error('❌ Ошибка при загрузке конфигурации:', error);
  process.exit(1);
}
