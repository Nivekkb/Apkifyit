const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const appDir = path.join(process.cwd(), 'app');
const apiDir = path.join(appDir, 'api');
const disabledDir = path.join(appDir, '_api_disabled');

const hasApi = fs.existsSync(apiDir);

const move = (from, to) => {
  if (!fs.existsSync(from)) return;
  fs.renameSync(from, to);
};

try {
  if (hasApi) {
    move(apiDir, disabledDir);
  }

  const result = spawnSync('next', ['build', '--turbopack'], {
    stdio: 'inherit',
    env: { ...process.env, NEXT_OUTPUT: 'export' }
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
} finally {
  if (fs.existsSync(disabledDir)) {
    move(disabledDir, apiDir);
  }
}
