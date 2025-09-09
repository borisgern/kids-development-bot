module.exports = {
  apps: [{
    name: 'kids-bot',
    script: 'npm',
    args: 'start',
    cwd: '/home/ubuntu/kids-development-bot', // Adjust path as needed
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      TZ: 'Europe/Lisbon'
    },
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    autorestart: true,
    listen_timeout: 50000,
    kill_timeout: 5000
  }]
};