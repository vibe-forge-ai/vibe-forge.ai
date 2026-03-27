import { spawnSync } from "node:child_process";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

export const dependencyFields = [
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
];

export const bumpKinds = new Set(["major", "minor", "patch"]);

export const defaultOptions = {
  packages: [],
  publish: false,
  access: "public",
  tag: "",
  dryRun: false,
  noGitChecks: false,
  bump: "",
  confirmRetry: true,
  json: false,
  includePrivate: false,
  help: false,
};

const defaultFs = {
  async readText(filePath) {
    return readFile(filePath, "utf8");
  },
  readdir,
  stat,
  async writeText(filePath, content) {
    return writeFile(filePath, content, "utf8");
  },
};

export const helpText = `用法:
  pnpm tools publish-plan [options]

选项:
  -p, --packages <names>    逗号分隔的包名列表
      --package <name>      指定单个包，可重复传入
      --publish             按顺序执行 pnpm publish
      --access <mode>       发布 access，默认 public
      --tag <tag>           发布 tag
      --bump <kind>         统一升级版本号: major | minor | patch
      --dry-run             透传给 pnpm publish --dry-run
      --no-git-checks       透传给 pnpm publish --no-git-checks
      --confirm-retry       发布失败时询问是否重试（默认开启）
      --no-confirm-retry    发布失败时不询问重试
      --include-private     在计划中包含 private workspace 包
      --json                输出 JSON 计划
  -h, --help                显示帮助

说明:
  1. 未指定包名时，会为整个 workspace 生成发布计划。
  2. 指定包名时，只发布显式选中的包；依赖仅用于排序和兼容性分析。
  3. 默认只输出计划；传入 --publish 后才会实际发布。`;

export function parseArgs(argv) {
  const options = {
    ...defaultOptions,
    packages: [],
  };

  const readValue = (index, flag) => {
    const value = argv[index + 1];
    if (!value) {
      throw new Error(`缺少 ${flag} 参数值`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--packages" || arg === "-p") {
      const value = readValue(index, "--packages");
      options.packages.push(
        ...value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      );
      index += 1;
      continue;
    }

    if (arg === "--package") {
      const value = readValue(index, "--package");
      options.packages.push(value.trim());
      index += 1;
      continue;
    }

    if (arg === "--publish") {
      options.publish = true;
      continue;
    }

    if (arg === "--access") {
      options.access = readValue(index, "--access");
      index += 1;
      continue;
    }

    if (arg === "--tag") {
      options.tag = readValue(index, "--tag");
      index += 1;
      continue;
    }

    if (arg === "--bump") {
      options.bump = readValue(index, "--bump");
      index += 1;
      continue;
    }

    if (arg === "--no-confirm-retry") {
      options.confirmRetry = false;
      continue;
    }

    if (arg === "--confirm-retry") {
      options.confirmRetry = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--no-git-checks") {
      options.noGitChecks = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--include-private") {
      options.includePrivate = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    throw new Error(`未知参数: ${arg}`);
  }

  options.packages = Array.from(new Set(options.packages.filter(Boolean)));

  if (options.bump && !bumpKinds.has(options.bump)) {
    throw new Error(`不支持的 bump 类型: ${options.bump}`);
  }

  return options;
}

export function bumpVersion(rawVersion, kind) {
  if (!bumpKinds.has(kind)) {
    throw new Error(`不支持的 bump 类型: ${kind}`);
  }
  if (!rawVersion) {
    throw new Error("缺少版本号");
  }

  const [main] = String(rawVersion).split("-");
  const parts = main.split(".").map((item) => Number(item));
  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
    throw new Error(`版本号格式错误: ${rawVersion}`);
  }

  const [major, minor, patch] = parts;
  if (kind === "major") {
    return `${major + 1}.0.0`;
  }
  if (kind === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

export function buildPublishArgs(options) {
  const args = ["publish", "--access", options.access];
  if (options.tag) {
    args.push("--tag", options.tag);
  }
  if (options.dryRun) {
    args.push("--dry-run");
  }
  if (options.noGitChecks) {
    args.push("--no-git-checks");
  }
  return args;
}

export function parseWorkspacePatterns(workspaceConfig) {
  return workspaceConfig
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

export async function expandWorkspaceDirs(
  repoRoot,
  workspacePatterns,
  fsOps = defaultFs,
) {
  const workspaceDirs = new Set();

  for (const pattern of workspacePatterns) {
    if (pattern.endsWith("/*")) {
      const baseDir = path.join(repoRoot, pattern.slice(0, -2));
      try {
        const entries = await fsOps.readdir(baseDir);
        for (const entry of entries) {
          const fullPath = path.join(baseDir, entry);
          const stats = await fsOps.stat(fullPath);
          if (stats.isDirectory()) {
            workspaceDirs.add(fullPath);
          }
        }
      } catch {
        continue;
      }
      continue;
    }

    workspaceDirs.add(path.join(repoRoot, pattern));
  }

  return Array.from(workspaceDirs).sort();
}

export async function loadWorkspacePackages(repoRoot, fsOps = defaultFs) {
  const workspaceConfig = await fsOps.readText(
    path.join(repoRoot, "pnpm-workspace.yaml"),
  );
  const workspacePatterns = parseWorkspacePatterns(workspaceConfig);
  const workspaceDirs = await expandWorkspaceDirs(
    repoRoot,
    workspacePatterns,
    fsOps,
  );

  const packages = new Map();

  for (const dir of workspaceDirs) {
    const packagePath = path.join(dir, "package.json");
    try {
      const raw = await fsOps.readText(packagePath);
      const json = JSON.parse(raw);
      if (!json?.name) {
        continue;
      }
      packages.set(json.name, {
        name: json.name,
        dir,
        json,
        private: Boolean(json.private),
      });
    } catch {
      continue;
    }
  }

  if (packages.size === 0) {
    throw new Error("未找到任何 workspace 包");
  }

  return packages;
}

function collectRequestedPackages(packages, requestedNames) {
  const selected = new Set();

  for (const name of requestedNames) {
    const pkg = packages.get(name);
    if (!pkg) {
      throw new Error(`未找到包: ${name}`);
    }
    selected.add(name);
  }

  return selected;
}

function parseSemver(rawVersion) {
  if (!rawVersion) {
    return null;
  }

  const [main] = String(rawVersion).split("-");
  const parts = main.split(".").map((item) => Number(item));
  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
    return null;
  }

  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2],
  };
}

function compareSemver(left, right) {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  return left.patch - right.patch;
}

function normalizeWorkspaceRange(rawRange) {
  if (!rawRange) {
    return "";
  }
  return String(rawRange)
    .replace(/^workspace:/, "")
    .trim();
}

function isVersionSatisfied(version, rawRange) {
  const normalizedRange = normalizeWorkspaceRange(rawRange);
  if (!normalizedRange || normalizedRange === "*") {
    return true;
  }

  const parsedVersion = parseSemver(version);
  if (!parsedVersion) {
    return false;
  }

  const exact = normalizeWorkspaceRange(normalizedRange.replace(/^[=]/, ""));
  const exactVersion = parseSemver(exact);
  if (exactVersion && /^\d/.test(exact)) {
    return compareSemver(parsedVersion, exactVersion) === 0;
  }

  if (normalizedRange.startsWith("^")) {
    const base = parseSemver(normalizedRange.slice(1));
    if (!base || compareSemver(parsedVersion, base) < 0) {
      return false;
    }

    if (base.major > 0) {
      return parsedVersion.major === base.major;
    }
    if (base.minor > 0) {
      return parsedVersion.major === 0 && parsedVersion.minor === base.minor;
    }
    return (
      parsedVersion.major === 0 &&
      parsedVersion.minor === 0 &&
      parsedVersion.patch === base.patch
    );
  }

  if (normalizedRange.startsWith("~")) {
    const base = parseSemver(normalizedRange.slice(1));
    if (!base || compareSemver(parsedVersion, base) < 0) {
      return false;
    }
    return (
      parsedVersion.major === base.major && parsedVersion.minor === base.minor
    );
  }

  return false;
}

function buildReverseDependencies(packages, includePrivate) {
  const reverseDependencies = new Map();

  for (const [name, pkg] of packages) {
    if (pkg.private && !includePrivate) {
      continue;
    }

    for (const field of dependencyFields) {
      const deps = pkg.json[field];
      if (!deps) {
        continue;
      }

      for (const [depName, range] of Object.entries(deps)) {
        if (!packages.has(depName)) {
          continue;
        }

        const depPkg = packages.get(depName);
        if (depPkg?.private && !includePrivate) {
          continue;
        }

        if (!reverseDependencies.has(depName)) {
          reverseDependencies.set(depName, []);
        }

        reverseDependencies.get(depName).push({
          name,
          range: String(range),
          field,
        });
      }
    }
  }

  for (const dependents of reverseDependencies.values()) {
    dependents.sort((left, right) => left.name.localeCompare(right.name));
  }

  return reverseDependencies;
}

function analyzeDependentImpacts(name, nextVersion, reverseDependencies) {
  const dependents = reverseDependencies.get(name) ?? [];
  return dependents
    .map((dependent) => ({
      ...dependent,
      requiresRangeUpdate: !isVersionSatisfied(nextVersion, dependent.range),
    }))
    .filter((dependent) => dependent.requiresRangeUpdate);
}

function collectAllPackages(packages, includePrivate) {
  const selected = new Set();
  const skippedPrivate = [];

  for (const [name, pkg] of packages) {
    if (pkg.private && !includePrivate) {
      skippedPrivate.push(name);
      continue;
    }
    selected.add(name);
  }

  return {
    selected,
    skippedPrivate: skippedPrivate.sort(),
  };
}

export function createPublishPlan(packages, options) {
  const requestedNames = Array.from(new Set(options.packages));
  const explicitSelection = requestedNames.length > 0;
  const skippedPrivate = [];
  const selected = explicitSelection
    ? collectRequestedPackages(packages, requestedNames)
    : collectAllPackages(packages, options.includePrivate).selected;

  if (!explicitSelection && !options.includePrivate) {
    skippedPrivate.push(...collectAllPackages(packages, false).skippedPrivate);
  }

  if (explicitSelection && !options.includePrivate) {
    for (const name of requestedNames) {
      const pkg = packages.get(name);
      if (pkg?.private) {
        throw new Error(
          `包 ${name} 为 private，若要包含请传入 --include-private`,
        );
      }
    }
  }

  const nodes = Array.from(selected)
    .filter((name) => {
      const pkg = packages.get(name);
      if (!pkg) {
        return false;
      }
      return options.includePrivate || !pkg.private;
    })
    .sort();

  if (nodes.length === 0) {
    throw new Error("没有可发布的包");
  }

  const reverseDependencies = buildReverseDependencies(
    packages,
    options.includePrivate,
  );
  const adjacency = new Map();
  const indegree = new Map();
  const internalDependencies = new Map();

  for (const name of nodes) {
    adjacency.set(name, new Set());
    indegree.set(name, 0);
    internalDependencies.set(name, []);
  }

  for (const name of nodes) {
    const pkg = packages.get(name);
    if (!pkg) {
      continue;
    }

    for (const field of dependencyFields) {
      const deps = pkg.json[field];
      if (!deps) {
        continue;
      }

      for (const depName of Object.keys(deps)) {
        if (!packages.has(depName)) {
          continue;
        }

        const depPkg = packages.get(depName);
        if (depPkg?.private && !options.includePrivate) {
          throw new Error(
            `包 ${name} 依赖 private 包 ${depName}，无法生成发布计划`,
          );
        }

        internalDependencies.get(name).push(depName);

        if (!selected.has(depName) || !adjacency.has(depName)) {
          continue;
        }

        if (!adjacency.get(depName).has(name)) {
          adjacency.get(depName).add(name);
          indegree.set(name, (indegree.get(name) ?? 0) + 1);
        }
      }
    }
  }

  const ready = nodes.filter((name) => (indegree.get(name) ?? 0) === 0).sort();
  const order = [];

  while (ready.length > 0) {
    const name = ready.shift();
    if (!name) {
      continue;
    }
    order.push(name);

    for (const next of adjacency.get(name) ?? []) {
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) {
        ready.push(next);
        ready.sort();
      }
    }
  }

  if (order.length !== nodes.length) {
    throw new Error("检测到循环依赖，无法生成发布顺序");
  }

  const items = order.map((name) => {
    const pkg = packages.get(name);
    const version = pkg?.json.version ?? "";
    return {
      name,
      dir: pkg?.dir ?? "",
      version,
      nextVersion: options.bump ? bumpVersion(version, options.bump) : "",
      private: Boolean(pkg?.private),
      internalDependencies: Array.from(
        new Set(internalDependencies.get(name) ?? []),
      ).sort(),
      impactedDependents: options.bump
        ? analyzeDependentImpacts(
            name,
            bumpVersion(version, options.bump),
            reverseDependencies,
          )
        : [],
    };
  });

  return {
    explicitSelection,
    requestedNames,
    skippedPrivate,
    items,
  };
}

export function formatPlan(plan, repoRoot, options) {
  const publishArgs = buildPublishArgs(options);
  const mode = options.publish
    ? options.dryRun
      ? "执行发布（dry-run）"
      : "执行发布"
    : "仅生成计划";

  const lines = [`模式: ${mode}`, `包数量: ${plan.items.length}`];

  if (options.bump) {
    lines.push(`版本升级: ${options.bump}`);
  }
  if (options.publish) {
    lines.push(`发布命令: pnpm ${publishArgs.join(" ")}`);
  }
  if (plan.skippedPrivate.length > 0) {
    lines.push(`跳过 private 包: ${plan.skippedPrivate.join(", ")}`);
  }

  lines.push("", "发布顺序:");

  plan.items.forEach((item, index) => {
    const versionPart = item.version
      ? item.nextVersion
        ? `${item.version} -> ${item.nextVersion}`
        : item.version
      : "未声明版本";
    const depsPart =
      item.internalDependencies.length > 0
        ? ` | 依赖: ${item.internalDependencies.join(", ")}`
        : "";
    const impactsPart =
      item.impactedDependents.length > 0
        ? ` | 可能影响: ${item.impactedDependents.map((dependent) => `${dependent.name}(${dependent.range})`).join(", ")}`
        : "";
    lines.push(
      `${index + 1}. ${item.name}@${versionPart} (${path.relative(repoRoot, item.dir)})${depsPart}${impactsPart}`,
    );
  });

  return lines.join("\n");
}

export function serializePlan(plan, repoRoot, options) {
  return {
    summary: {
      mode: options.publish
        ? options.dryRun
          ? "publish-dry-run"
          : "publish"
        : "plan",
      packageCount: plan.items.length,
      skippedPrivate: plan.skippedPrivate,
      bump: options.bump || null,
      command: options.publish ? ["pnpm", ...buildPublishArgs(options)] : null,
    },
    order: plan.items.map((item, index) => ({
      index: index + 1,
      name: item.name,
      version: item.version || null,
      nextVersion: item.nextVersion || null,
      dir: path.relative(repoRoot, item.dir),
      internalDependencies: item.internalDependencies,
      impactedDependents: item.impactedDependents,
    })),
  };
}

export async function applyVersionBump(
  plan,
  packages,
  kind,
  fsOps = defaultFs,
) {
  const updates = [];

  for (const item of plan.items) {
    const pkg = packages.get(item.name);
    if (!pkg) {
      continue;
    }

    const nextVersion = bumpVersion(pkg.json.version, kind);
    const nextJson = {
      ...pkg.json,
      version: nextVersion,
    };

    await fsOps.writeText(
      path.join(pkg.dir, "package.json"),
      `${JSON.stringify(nextJson, null, 2)}\n`,
    );

    pkg.json = nextJson;
    updates.push({
      name: item.name,
      version: nextVersion,
    });
  }

  return updates;
}

export async function promptRetry(pkgName, options, io = process) {
  if (!options.confirmRetry || !io.stdin?.isTTY) {
    return true;
  }

  const rl = createInterface({
    input: io.stdin,
    output: io.stdout,
  });
  const answer = await rl.question(`发布失败: ${pkgName}，是否重试？(y/N): `);
  rl.close();

  const normalized = answer.trim().toLowerCase();
  return normalized === "y" || normalized === "yes";
}

export async function executePublishPlan(
  plan,
  options,
  runCommand = spawnSync,
  retryPrompt = promptRetry,
) {
  const failures = [];
  const attempts = [];
  const args = buildPublishArgs(options);

  for (const item of plan.items) {
    let success = false;
    let lastStatus = 1;
    let attemptCount = 0;

    while (true) {
      attemptCount += 1;
      const result = runCommand("pnpm", args, {
        cwd: item.dir,
        stdio: "inherit",
      });
      lastStatus = result.status ?? 1;

      if (lastStatus === 0) {
        success = true;
        break;
      }

      const shouldRetry = await retryPrompt(item.name, options);
      if (!shouldRetry) {
        break;
      }
    }

    attempts.push({
      name: item.name,
      status: lastStatus,
      attempts: attemptCount,
      success,
    });

    if (!success) {
      failures.push({
        name: item.name,
        status: lastStatus,
      });
    }
  }

  return {
    failures,
    attempts,
  };
}

export async function runPublishPlanCli(
  argv = process.argv.slice(2),
  runtime = {},
) {
  const repoRoot = runtime.repoRoot ?? process.cwd();
  const stdout = runtime.stdout ?? process.stdout;
  const fsOps = runtime.fsOps ?? defaultFs;
  const runCommand = runtime.runCommand ?? spawnSync;
  const retryPrompt = runtime.retryPrompt ?? promptRetry;

  const options = parseArgs(argv);
  if (options.help) {
    stdout.write(`${helpText}\n`);
    return {
      kind: "help",
      options,
    };
  }

  const packages = await loadWorkspacePackages(repoRoot, fsOps);
  const plan = createPublishPlan(packages, options);

  if (options.json) {
    stdout.write(
      `${JSON.stringify(serializePlan(plan, repoRoot, options), null, 2)}\n`,
    );
  } else {
    stdout.write(`${formatPlan(plan, repoRoot, options)}\n`);
  }

  let updates = [];
  if (options.bump) {
    updates = await applyVersionBump(plan, packages, options.bump, fsOps);
  }

  let publishResult = null;
  if (options.publish) {
    publishResult = await executePublishPlan(
      plan,
      options,
      runCommand,
      retryPrompt,
    );
    if (publishResult.failures.length > 0) {
      stdout.write("发布失败的包:\n");
      for (const item of publishResult.failures) {
        stdout.write(`- ${item.name} (status ${item.status})\n`);
      }
    }
  }

  return {
    kind: "plan",
    options,
    plan,
    updates,
    publishResult,
  };
}
