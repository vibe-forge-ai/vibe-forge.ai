const process = require("node:process");

if (!process.env.__IS_LOADER_CLI__) {
  const { execPath } = process;

  const args = process.argv.slice(1);

  const nodeOptions = [
    `--require=${require.resolve("@vibe-forge/register/preload")}`,
  ].join(" ");

  const child = require("node:child_process").spawn(execPath, args, {
    stdio: "inherit",
    env: {
      ...process.env,

      NODE_OPTIONS: `--conditions=__vibe-forge__ ${nodeOptions} ${process.env.NODE_OPTIONS ?? ""}`,

      __IS_LOADER_CLI__: "true",
    },
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  const cleanup = () => {
    process.off("SIGINT", handleSigint);
    process.off("SIGTERM", handleSigterm);
  };

  const handleSigint = () => forwardSignal("SIGINT");
  const handleSigterm = () => forwardSignal("SIGTERM");

  process.on("SIGINT", handleSigint);
  process.on("SIGTERM", handleSigterm);

  child.on("error", (error) => {
    cleanup();
    console.error(error.message);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    cleanup();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
} else {
  process.env.__VF_PROJECT_WORKSPACE_FOLDER__ =
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd();
  process.env.__VF_PROJECT_PACKAGE_DIR__ =
    process.env.__VF_PROJECT_PACKAGE_DIR__ ?? __dirname;
  process.env.__VF_PROJECT_CLI_PACKAGE_DIR__ = __dirname;
  require(process.env.__VF_PROJECT_CLI_BIN_SOURCE_ENTRY__);
}
