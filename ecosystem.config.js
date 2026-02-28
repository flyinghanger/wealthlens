/**
 * PM2 生态系统配置
 * 
 * 用法：
 *   pm2 start ecosystem.config.js
 *   pm2 logs
 *   pm2 status
 *   pm2 restart all
 *   pm2 stop all
 */

module.exports = {
  apps: [
    // 1. Python 富途微服务
    {
      name: 'futu-service',
      cwd: './backend-futu',
      script: 'start.sh',
      interpreter: 'bash',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        PYTHONUNBUFFERED: '1',
        FUTU_HOST: '127.0.0.1',
        FUTU_PORT: '11111'
      },
      error_file: './logs/futu-error.log',
      out_file: './logs/futu-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },

    // 2. Python IBKR 微服务
    {
      name: 'ibkr-service',
      cwd: './backend-ibkr',
      script: 'start.sh',
      interpreter: 'bash',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        PYTHONUNBUFFERED: '1',
        IB_HOST: '127.0.0.1',
        IB_PORT: '4001',
        IB_CLIENT_ID: '10'
      },
      error_file: './logs/ibkr-error.log',
      out_file: './logs/ibkr-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },

    // 3. Node.js NestJS 后端
    {
      name: 'api-server',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: '3001'
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },

    // 4. Next.js 前端
    {
      name: 'web-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3001'
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
