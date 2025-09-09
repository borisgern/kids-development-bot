# Руководство по деплою на VPS

## Предварительные требования

- VPS с Ubuntu 20.04+ или Debian 11+
- Доступ по SSH с sudo правами
- Открытый порт 3000 (или другой порт для приложения)
- Telegram Bot Token

## Быстрый деплой

### 1. Подключитесь к VPS по SSH
```bash
ssh user@your-vps-ip
```

### 2. Запустите скрипт автоматической установки
```bash
wget https://raw.githubusercontent.com/borisgern/kids-development-bot/main/scripts/vps-setup.sh
chmod +x vps-setup.sh
bash vps-setup.sh
```

### 3. Настройте переменные окружения
```bash
cd ~/kids-development-bot
nano .env
```

Добавьте:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
NODE_ENV=production
PORT=3000
```

### 4. Перезапустите приложение
```bash
pm2 restart kids-bot
```

## Ручная установка

### 1. Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Установка Node.js 18
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Установка PM2
```bash
sudo npm install -g pm2
```

### 4. Клонирование репозитория
```bash
git clone https://github.com/borisgern/kids-development-bot.git
cd kids-development-bot
```

### 5. Установка зависимостей и сборка
```bash
npm install
npm run build
```

### 6. Настройка окружения
```bash
cp .env.example .env
nano .env  # Добавить TELEGRAM_BOT_TOKEN
```

### 7. Запуск через PM2
```bash
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

### 8. Настройка Cron задачи
```bash
crontab -e
```
Добавить:
```
0 7 * * * curl -X POST http://localhost:3000/api/cron/daily-tasks > /dev/null 2>&1
```

### 9. Настройка файрвола
```bash
sudo ufw allow ssh
sudo ufw allow 3000
sudo ufw enable
```

## Управление приложением

### PM2 команды
```bash
# Статус приложения
pm2 status

# Просмотр логов
pm2 logs kids-bot

# Перезапуск
pm2 restart kids-bot

# Остановка
pm2 stop kids-bot

# Мониторинг ресурсов
pm2 monit
```

### Обновление приложения
```bash
cd ~/kids-development-bot
git pull origin main
npm install
npm run build
pm2 restart kids-bot
```

## Проверка работы

### 1. Проверка статуса приложения
```bash
pm2 status
curl http://localhost:3000/api/health
```

### 2. Проверка Telegram бота
- Найдите бота в Telegram
- Отправьте команду `/start`
- Проверьте ответ бота

### 3. Проверка cron задачи
```bash
# Ручной запуск рассылки
curl -X POST http://localhost:3000/api/cron/daily-tasks

# Проверка cron логов
grep CRON /var/log/syslog
```

## Устранение неполадок

### Приложение не запускается
```bash
# Проверить логи PM2
pm2 logs kids-bot

# Проверить переменные окружения
cat .env

# Проверить порт
netstat -tulpn | grep 3000
```

### Бот не отвечает
```bash
# Проверить токен в .env
grep TELEGRAM_BOT_TOKEN .env

# Проверить логи бота
pm2 logs kids-bot | grep telegram
```

### Cron задача не работает
```bash
# Проверить cron службу
sudo systemctl status cron

# Проверить cron задачи пользователя
crontab -l

# Тестовый запуск
curl -X POST http://localhost:3000/api/cron/daily-tasks
```

## Мониторинг

### Логирование
- PM2 логи: `pm2 logs kids-bot`
- Системные логи: `/var/log/syslog`
- Cron логи: `grep CRON /var/log/syslog`

### Мониторинг ресурсов
```bash
# PM2 мониторинг
pm2 monit

# Использование диска
df -h

# Использование памяти
free -m

# Процессы
htop
```

## Бэкапы

### Автоматический бэкап данных
```bash
# Добавить в crontab
0 2 * * * cp ~/kids-development-bot/data/db.json ~/backups/db-$(date +\%Y\%m\%d).json
```

### Ручной бэкап
```bash
mkdir -p ~/backups
cp ~/kids-development-bot/data/db.json ~/backups/db-$(date +%Y%m%d).json
```

## Безопасность

### Обновления безопасности
```bash
# Автообновления системы
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Ограничение SSH доступа
```bash
# Изменить SSH порт
sudo nano /etc/ssh/sshd_config
# Port 2222

# Перезапустить SSH
sudo systemctl restart ssh
```

### Fail2ban для защиты от брутфорса
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```