#!/bin/bash

# VPS Setup Script for Kids Development Bot
# Run as: bash scripts/vps-setup.sh

set -e

echo "🚀 Starting VPS setup for Kids Development Bot..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
node_version=$(node --version)
npm_version=$(npm --version)
echo "✅ Node.js version: $node_version"
echo "✅ NPM version: $npm_version"

# Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Git if not present
echo "📦 Installing Git..."
sudo apt-get install -y git

# Create application directory
APP_DIR="/home/$(whoami)/kids-development-bot"
echo "📁 Creating application directory: $APP_DIR"
mkdir -p "$APP_DIR"

# Clone repository
echo "📥 Cloning repository..."
if [ -d "$APP_DIR/.git" ]; then
    echo "Repository already exists, pulling latest changes..."
    cd "$APP_DIR"
    git pull origin main
else
    git clone https://github.com/borisgern/kids-development-bot.git "$APP_DIR"
    cd "$APP_DIR"
fi

# Install dependencies
echo "📦 Installing application dependencies..."
npm install

# Build the application
echo "🔨 Building the application..."
npm run build

# Create environment file from example
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit .env file with your Telegram bot token!"
    echo "⚠️  Run: nano $APP_DIR/.env"
else
    echo "✅ .env file already exists"
fi

# Create data directory for db.json
echo "📁 Creating data directory..."
mkdir -p data

# Set up PM2 startup
echo "🔄 Setting up PM2 startup..."
pm2 startup | tail -n 1 | sh || true

# Start application with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save

# Setup system cron for daily tasks
echo "⏰ Setting up cron job for daily tasks..."
CRON_ENTRY="0 7 * * * curl -X POST http://localhost:3000/api/cron/daily-tasks > /dev/null 2>&1"
(crontab -l 2>/dev/null | grep -v "daily-tasks"; echo "$CRON_ENTRY") | crontab -

# Install and configure UFW firewall
echo "🔒 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 3000
echo "y" | sudo ufw enable

echo ""
echo "🎉 VPS setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit environment variables: nano $APP_DIR/.env"
echo "2. Add your TELEGRAM_BOT_TOKEN"
echo "3. Restart the application: pm2 restart kids-bot"
echo "4. Check application status: pm2 status"
echo "5. View logs: pm2 logs kids-bot"
echo ""
echo "Application should be running on port 3000"
echo "Bot endpoint: http://your-server-ip:3000/api/telegram/webhook"
echo ""
echo "Useful commands:"
echo "- pm2 restart kids-bot  # Restart bot"
echo "- pm2 stop kids-bot     # Stop bot"
echo "- pm2 logs kids-bot     # View logs"
echo "- pm2 monit             # Monitor resources"