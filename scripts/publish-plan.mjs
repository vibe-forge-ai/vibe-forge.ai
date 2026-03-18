import process from "node:process";
import { pathToFileURL } from "node:url";

import { runPublishPlanCli } from "./publish-plan-core.mjs";

export * from "./publish-plan-core.mjs";

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  runPublishPlanCli().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`发布计划执行失败: ${message}`);
    process.exitCode = 1;
  });
}
