const { resolve } = require("node:path");
const process = require("node:process");

const dotenv = require("dotenv");

const loadDotenv = (options = {}) => {
  const workspaceFolder =
    options.workspaceFolder ??
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ??
    process.cwd();
  const envFiles = process.env.__VF_PROJECT_DOTENV_FILES__
    ? process.env.__VF_PROJECT_DOTENV_FILES__
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  const files = options.files ?? envFiles ?? [".env", ".env.dev"];
  const packageDir = process.env.__VF_PROJECT_PACKAGE_DIR__;
  const roots =
    packageDir && packageDir !== workspaceFolder
      ? [workspaceFolder, packageDir]
      : [workspaceFolder];

  for (const root of roots) {
    for (const file of files) {
      dotenv.config({
        quiet: true,
        path: resolve(root, file),
      });
    }
  }
};

loadDotenv();
