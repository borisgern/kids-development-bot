# Телеграм-бот «Квесты Развития»

Автоматический Telegram бот для ежедневной отправки развивающих задач детям. Бот ежедневно в 7:00 WEST отправляет 3 случайные задачи для каждого ребенка (Даня и Тёма) всем подписчикам.

## 🚀 Возможности

- **Автоматическая рассылка**: Ежедневная отправка задач в 7:00 WEST
- **Случайный выбор**: 3 уникальные задачи для каждого ребенка каждый день
- **Управление подпиской**: Команды `/start` и `/stop` для подписки/отписки
- **Отслеживание прогресса**: Система не повторяет задачи до исчерпания пула
- **Автосброс**: Автоматическое обновление пула при исчерпании задач
- **Обработка ошибок**: Устойчивость к сбоям и автоматическое логирование

## 🏗️ Архитектура

### Технологический стек

- **Framework**: Next.js 13+ с API Routes
- **Language**: TypeScript
- **Bot Library**: Grammy (Telegram Bot Framework)
- **Database**: Локальный JSON файл (`db.json`)
- **Scheduler**: Node-cron для автоматических задач
- **Process Manager**: PM2 для production
- **Testing**: Jest для unit и integration тестов

### Структура проекта

```
├── src/
│   ├── pages/api/          # Next.js API routes
│   │   ├── telegram/       # Telegram webhook handlers
│   │   └── cron/          # Cron job endpoints
│   ├── services/          # Основная бизнес-логика
│   │   ├── taskParser.ts  # Парсинг MD файлов
│   │   ├── taskService.ts # Управление пулом задач
│   │   ├── broadcastService.ts # Рассылка сообщений
│   │   └── loggerService.ts    # Логирование
│   └── bot/               # Telegram bot setup
├── data/                  # Данные приложения
│   ├── db.json           # База данных (subscribers, task pools)
│   ├── Dans_current_development_progress.md
│   └── Temas_current_development_progress.md
├── scripts/              # Скрипты деплоя
└── docs/                 # Документация
```

## 📋 Предварительные требования

### Для разработки
- Node.js 18+
- npm или yarn
- Telegram Bot Token (получить у @BotFather)

### Для продакшена
- VPS с Ubuntu 20.04+
- Доступ по SSH
- Домен (опционально, для webhook)

## 🛠️ Установка и настройка

### Локальная разработка

1. **Клонирование репозитория**
```bash
git clone https://github.com/borisgern/kids-development-bot.git
cd kids-development-bot
```

2. **Установка зависимостей**
```bash
npm install
```

3. **Настройка переменных окружения**
```bash
cp .env.example .env
nano .env
```

Заполните:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
NODE_ENV=development
PORT=3000
```

4. **Создание тестовых данных**
```bash
mkdir -p data
# Добавьте задачи в markdown файлы или используйте существующие примеры
```

5. **Запуск в режиме разработки**
```bash
npm run dev    # Next.js development server
npm run bot    # Telegram bot (в отдельном терминале)
```

### Деплой на VPS

#### Автоматическая установка
```bash
# На VPS
wget https://raw.githubusercontent.com/borisgern/kids-development-bot/main/scripts/vps-setup.sh
chmod +x vps-setup.sh
bash vps-setup.sh
```

#### Ручная установка
Следуйте инструкциям в [docs/deployment.md](docs/deployment.md)

## 🎮 Использование

### Команды бота

- `/start` - Подписаться на ежедневные задачи
- `/stop` - Отписаться от рассылки

### Формат задач в MD файлах

```markdown
# Развивающие задачи для Данилы

## Физическое развитие
- [ ] Попрыгать на одной ноге 10 раз
- [ ] Сделать 5 приседаний

## Творческое развитие  
- [ ] Нарисовать любимое животное
- [ ] Слепить из пластилина фигурку
```

### Управление через API

```bash
# Ручной запуск рассылки
curl -X POST http://localhost:3000/api/cron/daily-tasks

# Проверка здоровья приложения
curl http://localhost:3000/api/health
```

## 🔧 Разработка

### Доступные команды

```bash
# Разработка
npm run dev          # Запуск Next.js dev server
npm run bot          # Запуск Telegram bot
npm run build        # Сборка для продакшена
npm run start        # Запуск продакшн версии

# Тестирование
npm test            # Запуск всех тестов
npm run test:watch  # Тесты в watch режиме

# Линтинг и проверки
npm run lint        # ESLint проверка
npm run type-check  # TypeScript проверка
```

### Структура данных

#### db.json
```json
{
  "subscribers": ["123456789", "987654321"],
  "taskPools": {
    "danya": {
      "tasks": [
        { "text": "Задача 1", "sent": false },
        { "text": "Задача 2", "sent": true }
      ],
      "lastReset": "2025-09-09T00:00:00Z"
    },
    "tema": {
      "tasks": [...],
      "lastReset": "2025-09-09T00:00:00Z"
    }
  }
}
```

### Добавление новых задач

1. Отредактируйте соответствующий MD файл в папке `data/`
2. Добавьте задачи в формате `- [ ] Текст задачи`
3. Перезапустите сервис или дождитесь автоматического обновления

## 🚀 Деплой

### Быстрый деплой
```bash
# На VPS
cd ~/kids-development-bot
git pull origin main
npm install
npm run build
pm2 restart kids-bot
```

### Мониторинг
```bash
# Статус приложения
pm2 status

# Логи
pm2 logs kids-bot

# Мониторинг ресурсов
pm2 monit
```

## 🐛 Диагностика проблем

### Частые проблемы

**Бот не отвечает**
```bash
# Проверить токен
grep TELEGRAM_BOT_TOKEN .env

# Проверить логи
pm2 logs kids-bot
```

**Задачи не отправляются**
```bash
# Проверить cron
crontab -l
grep CRON /var/log/syslog

# Ручной запуск
curl -X POST http://localhost:3000/api/cron/daily-tasks
```

**Нет задач для отправки**
```bash
# Проверить MD файлы
ls -la data/*.md
cat data/Dans_current_development_progress.md
```

### Логи

- **PM2 логи**: `pm2 logs kids-bot`
- **Системные логи**: `/var/log/syslog`
- **Приложение**: Встроенное логирование в консоль

## 🧪 Тестирование

### Запуск тестов
```bash
npm test                    # Все тесты
npm test taskParser        # Конкретный файл
npm run test:watch         # Watch режим
```

### Покрытие тестов
- TaskParser: Парсинг MD файлов
- TaskService: Управление пулом задач
- BroadcastService: Отправка сообщений
- Integration tests: End-to-end сценарии

## 📝 Логирование

Приложение ведет детальные логи:
- **DEBUG**: Подробная информация о работе
- **INFO**: Общая информация о процессах
- **WARN**: Предупреждения и временные ошибки
- **ERROR**: Критические ошибки

## 🔒 Безопасность

- Переменные окружения для секретов
- Валидация входных данных
- Ограничения на размер файлов
- Обработка ошибок без раскрытия внутренней информации
- Файрвол и SSH настройки на VPS

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Создайте Pull Request

## 📄 Лицензия

Этот проект создан для личного использования. Все права защищены.

## 📞 Поддержка

При возникновении проблем:

1. Проверьте [docs/deployment.md](docs/deployment.md) для деплоя
2. Изучите логи приложения
3. Проверьте конфигурацию в `.env`
4. Убедитесь, что все сервисы запущены

---

**Версия**: 1.0.0  
**Последнее обновление**: Сентябрь 2025  
**Статус**: Готов к продакшену