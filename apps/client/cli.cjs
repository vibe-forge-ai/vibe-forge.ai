const { realpathSync } = require("node:fs");
const { resolve } = require("node:path");
const process = require("node:process");

require("@vibe-forge/register/dotenv");

process.env.__VF_PROJECT_WORKSPACE_FOLDER__ =
  process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd();
process.env.__VF_PROJECT_PACKAGE_DIR__ = __dirname;
process.env.HOME = resolve(
  process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
  "./.ai/.mock",
);

const cwd = realpathSync(resolve(__dirname, "./"));
const args = process.env.IS_LOCAL_DEV === "true" ? [] : ["preview"];

require("node:child_process").spawnSync("vite", args, {
  cwd,
  env: {
    ...process.env,
    PATH: `${process.env.PATH}:${resolve(cwd, "./node_modules/.bin")}`,
  },
  stdio: "inherit",
  shell: true,
});
