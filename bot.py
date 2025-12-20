import logging
from telegram import KeyboardButton, ReplyKeyboardMarkup, Update, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters
)

import os
from dotenv import load_dotenv

# Настройки логирования
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

load_dotenv()

BOT_TOKEN = os.getenv('TELEGRAM_TOKEN')
if not BOT_TOKEN:
    raise ValueError("❌ TELEGRAM_TOKEN не найден в .env файле!")

# Словарь для отслеживания уже обработанных закреплённых сообщений
pinned_messages_processed = {}


# Функция для создания кнопки с игрой (для приватного чата)
def get_game_button():
    return ReplyKeyboardMarkup.from_button(
        KeyboardButton(
            text="🎮 Открыть игру",
            web_app=WebAppInfo(
                url="https://n0kr0s.github.io/tyaga-game/"
            ),
        ),
    )


# Функция для создания кнопки с ссылкой на игру (для группового чата)
def get_game_link_button():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(
            text="🎮 Начать игру",
            url="https://t.me/tyaga_game_bot?startapp=param"
        )],
        [InlineKeyboardButton(
            text="💬 Написать боту",
            url="https://t.me/tyaga_game_bot"
        )]
    ])


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /start с кнопкой открытия игры"""
    await update.message.reply_text(
        "🎮 Добро пожаловать в Tyaga Game!\n\n"
        "Нажми на кнопку ниже, чтобы начать играть:",
        reply_markup=get_game_button()
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /help"""
    await update.message.reply_text(
        "📖 *Справка по боту:*\n\n"
        "/start - Начать игру\n"
        "/help - Показать эту справку\n"
        "/about - О проекте\n",
        parse_mode="Markdown"
    )


async def about_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /about"""
    await update.message.reply_text(
        "ℹ️ *Tyaga Game*\n\n"
        "Разработано с ❤️\n\n"
        "Нажми /start чтобы начать",
        parse_mode="Markdown"
    )


async def check_pinned_messages(context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Периодическая проверка закреплённых сообщений в чате
    Запускается каждые 10 секунд
    """
    global pinned_messages_processed

    try:
        # ID чата комментариев Tyaga game
        chat_ids_to_check = [-1003407091490]

        for chat_id in chat_ids_to_check:
            try:
                # Получаем информацию о чате
                chat = await context.bot.get_chat(chat_id)

                # Проверяем есть ли закреплённое сообщение
                if chat.pinned_message:
                    pinned_msg_id = chat.pinned_message.message_id

                    # Если это новое закреплённое сообщение (которое мы ещё не обработали)
                    if chat_id not in pinned_messages_processed or \
                            pinned_messages_processed[chat_id] != pinned_msg_id:
                        logger.info(
                            f"✅ Обнаружено закреплённое сообщение в чате {chat_id} "
                            f"(ID: {pinned_msg_id})"
                        )

                        # Отправляем приглашение поиграть в ответ на закреплённое сообщение
                        # Используем обычную URL кнопку для группового чата
                        await context.bot.send_message(
                            chat_id=chat_id,
                            text=(
                                "🎮 *Приглашаем поиграть в Tyaga Game!*\n\n"
                                "Уютная аркада про Яна, который кушает клубнички и страдает "
                                "от одноразок «Waka» из его же вейпшопа 😤\n\n"
                                "Лови, уворачивайся, открывай скины, ломай рекорды! "
                                "Добро пожаловать в тягу. 🍓💨"
                            ),
                            reply_to_message_id=pinned_msg_id,
                            reply_markup=get_game_link_button(),
                            parse_mode="Markdown"
                        )

                        # Запоминаем, что мы уже обработали это сообщение
                        pinned_messages_processed[chat_id] = pinned_msg_id

            except Exception as e:
                logger.error(f"❌ Ошибка при проверке чата {chat_id}: {e}")

    except Exception as e:
        logger.error(f"❌ Ошибка в функции проверки закреплённых сообщений: {e}")


async def handle_any_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Обработчик для отслеживания ID чатов комментариев
    Помогает определить, какой ID чата использовать в check_pinned_messages
    """
    if update.message:
        chat_id = update.message.chat.id
        chat_title = update.message.chat.title or "Без названия"

        logger.info(f"📨 Сообщение в чате: {chat_title} (ID: {chat_id})")


def main() -> None:
    """Запуск бота"""
    # Создаём приложение с токеном
    application = Application.builder().token(BOT_TOKEN).build()

    # Команды
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("about", about_command))

    # Обработчик сообщений для логирования ID чатов
    application.add_handler(
        MessageHandler(filters.ALL, handle_any_message)
    )

    # Добавляем фоновую работу для проверки закреплённых сообщений
    # Проверяем каждые 10 секунд
    if application.job_queue:
        application.job_queue.run_repeating(
            check_pinned_messages,
            interval=10.0,
            first=2.0
        )
        logger.info("✅ Job Queue инициализирован успешно!")
    else:
        logger.warning("⚠️ Job Queue не инициализирован. Установи: pip install 'python-telegram-bot[job-queue]'")

    # Запускаем бота
    logger.info("🤖 Бот запущен!")
    logger.info("⏰ Проверка закреплённых сообщений будет происходить каждые 10 секунд")
    logger.info(f"📍 Отслеживаю чат: -1003407091490")

    # Запускаем с поддержкой всех типов обновлений
    application.run_polling(
        allowed_updates=Update.ALL_TYPES,
        drop_pending_updates=True
    )