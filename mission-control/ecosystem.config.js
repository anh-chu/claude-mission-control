const os = require("os");
const path = require("path");

module.exports = {
  apps: [
    {
      name: "mission-control",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0"
      },
      // Auto-restart on crash
      autorestart: true,
      // Watch for file changes (disable in production)
      watch: false,
      // Max memory before restart
      max_memory_restart: "512M",
      // Merge stdout and stderr logs
      merge_logs: true,
      out_file: path.join(os.homedir(), ".cmc", "logs", "pm2-out.log"),
      error_file: path.join(os.homedir(), ".cmc", "logs", "pm2-error.log"),
    },
  ],
};
