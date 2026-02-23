const { resolve } = require("node:path");

require("node:child_process").spawnSync("vite", [], {
  cwd: resolve(__dirname, "./"),
  stdio: "inherit",
});
