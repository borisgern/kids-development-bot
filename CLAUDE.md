# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Telegram bot "Квесты Развития" (Development Quests) designed to send daily development tasks for children to subscribed parents. The bot automatically sends 3 random development tasks for each child (Даня and Тёма) every day at 7 AM WEST.

## Tech Stack

- **Framework**: Next.js with API Routes
- **Language**: TypeScript
- **UI**: Tailwind CSS (if needed)
- **Database**: Local JSON file (db.json)
- **Hosting**: VPS with Node.js, PM2, and cron support
- **Bot Library**: Use node-telegram-bot-api or grammy for Telegram integration

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run TypeScript type checking
npm run type-check

# Run linter
npm run lint

# Run tests (when implemented)
npm run test
```

## VPS Deployment Commands

```bash
# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Restart application
pm2 restart kids-bot

# Stop application
pm2 stop kids-bot

# Setup as systemd service
pm2 startup
pm2 save
```

## Architecture

### Core Components

1. **Telegram Bot Handler** (`/api/telegram-webhook` or standalone bot file)
   - Handles `/start` and `/stop` commands
   - Manages user subscriptions
   - Can run as webhook or long polling

2. **Cron Job Handler** (`/api/cron/daily-tasks` or separate cron script)
   - Runs daily at 7 AM WEST via system cron or node-cron
   - Selects 3 random tasks per child
   - Sends messages to all subscribers

3. **Data Layer**
   - Parse markdown files: `Dans_current_development_progress.md` and `Temas_current_development_progress.md`
   - Manage `db.json` for task pools and subscriber chat IDs
   - Track sent tasks to avoid repetition until cycle reset

### Data Structure

```typescript
// db.json structure
{
  "subscribers": ["chat_id_1", "chat_id_2"],
  "taskPools": {
    "danya": {
      "tasks": [
        { "text": "Task text", "sent": false }
      ],
      "lastReset": "2025-09-09T00:00:00Z"
    },
    "tema": {
      "tasks": [
        { "text": "Task text", "sent": false }
      ],
      "lastReset": "2025-09-09T00:00:00Z"
    }
  }
}
```

## Environment Variables

Create a `.env` file with:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
NODE_ENV=production
PORT=3000
```

## VPS Deployment Setup

### PM2 Configuration (ecosystem.config.js)
```javascript
module.exports = {
  apps: [{
    name: 'kids-bot',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    cron_restart: '0 7 * * *', // Alternative to system cron
  }]
}
```

### Nginx Configuration (if using webhook mode)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location /telegram-webhook {
        proxy_pass http://localhost:3000/api/telegram-webhook;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### System Cron Setup (alternative to PM2 cron)
```bash
# Add to crontab -e
0 7 * * * curl -X POST http://localhost:3000/api/cron/daily-tasks
```

## Key Implementation Notes

1. **Bot Mode**: Consider using long polling for simplicity on VPS (no SSL/domain required)
2. **Task Parsing**: Extract tasks from markdown files using regex pattern `/\[ \] (.+)/g`
3. **Error Handling**: If parsing fails for one child, send error message but continue with the other
4. **Cycle Management**: Reset all task statuses when pool is exhausted
5. **Message Format**: Use markdown formatting for Telegram messages with checkbox syntax
6. **Timezone**: All scheduling should use WEST (Western European Summer Time)
7. **Persistence**: Ensure db.json is in a persistent location on VPS (not in /tmp)

## Testing Approach

- Unit tests for task parsing logic
- Integration tests for Telegram command handlers
- Mock Telegram API for testing message sending
- Test cycle reset logic with small task pools

## VPS Security Considerations

- Use environment variables for secrets (never commit .env)
- Set up firewall rules (ufw or iptables)
- Keep Node.js and dependencies updated
- Use non-root user for running the application
- Consider using fail2ban for brute force protection

## Git Workflow

### Repository
- Remote: https://github.com/borisgern/kids-development-bot.git
- Main branch: main

### Development Process
1. **After each completed iteration:**
   - Update status in `docs/plan.md` (mark completed tasks)
   - Commit all changes with descriptive message
   - Push to remote repository

2. **Commit Guidelines:**
   ```bash
   # After completing an iteration
   git add .
   git commit -m "Complete Iteration X: [brief description]"
   git push origin main
   ```

3. **Important Files to Track:**
   - Always check `docs/plan.md` for current iteration status
   - Update iteration status before committing
   - Never commit `.env` file (only `.env.example`)
   - Keep `db.json` in `.gitignore` for production