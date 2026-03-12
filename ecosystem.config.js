module.exports = {
  apps: [
    {
      name:        'dfb-api',
      script:      './dist/index.js',
      instances:   1,
      exec_mode:   'cluster',
      cwd:         '/home/donor-management.nokshaojibon.com/public_html',

      env: {
        NODE_ENV: 'production',
        PORT:     3002,
      },

      // Restart strategy
      max_restarts:        15,
      min_uptime:          '10s',
      restart_delay:       3000,
      autorestart:         true,
      watch:               false,

      // Memory management
      max_memory_restart: '512M',

      // Log management
      out_file:            '/home/donor-management.nokshaojibon.com/logs/pm2-out.log',
      error_file:          '/home/donor-management.nokshaojibon.com/logs/pm2-error.log',
      merge_logs:          true,
      log_date_format:     'YYYY-MM-DD HH:mm:ss.SSS',
      log_type:            'json',

      // Graceful shutdown
      kill_timeout:  5000,
      wait_ready:    false,
    },
  ],
};
