const { resolve } = require("node:path");

require("node:child_process").spawnSync(
  "node",
  [
    "--watch",
    "--watch-path",
    resolve(__dirname, "./src"),
    "-C",
    "__vibe-forge__",
    "-r",
    "esbuild-register",
    resolve(__dirname, "./src/index.ts"),
  ],
  {
    stdio: "inherit",
  },
);
