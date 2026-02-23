import { spawnSync } from "node:child_process";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

const repoRoot = process.cwd();
const args = process.argv.slice(2);

const options = {
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
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--packages" || arg === "-p") {
    const value = args[i + 1];
    if (!value) {
      throw new Error("缺少 --packages 参数值");
    }
    options.packages.push(
      ...value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
    i += 1;
    continue;
  }
  if (arg === "--package") {
    const value = args[i + 1];
    if (!value) {
      throw new Error("缺少 --package 参数值");
    }
    options.packages.push(value);
    i += 1;
    continue;
  }
  if (arg === "--publish") {
    options.publish = true;
    continue;
  }
  if (arg === "--access") {
    const value = args[i + 1];
    if (!value) {
      throw new Error("缺少 --access 参数值");
    }
    options.access = value;
    i += 1;
    continue;
  }
  if (arg === "--tag") {
    const value = args[i + 1];
    if (!value) {
      throw new Error("缺少 --tag 参数值");
    }
    options.tag = value;
    i += 1;
    continue;
  }
  if (arg === "--bump") {
    const value = args[i + 1];
    if (!value) {
      throw new Error("缺少 --bump 参数值");
    }
    options.bump = value;
    i += 1;
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
  throw new Error(`未知参数: ${arg}`);
}

const bumpKinds = new Set(["major", "minor", "patch"]);

const bumpVersion = (rawVersion, kind) => {
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
};

const shouldRetry = async (pkgName) => {
  if (!options.confirmRetry || !process.stdin.isTTY) {
    return true;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `发布失败: ${pkgName}，是否重试？(y/N): `,
  );
  rl.close();
  const normalized = answer.trim().toLowerCase();
  return normalized === "y" || normalized === "yes";
};

const workspaceConfig = await readFile(
  path.join(repoRoot, "pnpm-workspace.yaml"),
  "utf8",
);
const workspacePatterns = workspaceConfig
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("- "))
  .map((line) => line.slice(2).trim())
  .filter(Boolean);

const workspaceDirs = new Set();

for (const pattern of workspacePatterns) {
  if (pattern.endsWith("/*")) {
    const baseDir = path.join(repoRoot, pattern.slice(0, -2));
    try {
      const entries = await readdir(baseDir);
      for (const entry of entries) {
        const fullPath = path.join(baseDir, entry);
        const stats = await stat(fullPath);
        if (stats.isDirectory()) {
          workspaceDirs.add(fullPath);
        }
      }
    } catch {
      continue;
    }
  } else {
    workspaceDirs.add(path.join(repoRoot, pattern));
  }
}

const packages = new Map();

for (const dir of workspaceDirs) {
  const packagePath = path.join(dir, "package.json");
  try {
    const raw = await readFile(packagePath, "utf8");
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

const selected = new Set();
const queue = [];

if (options.packages.length > 0) {
  for (const name of options.packages) {
    if (!packages.has(name)) {
      throw new Error(`未找到包: ${name}`);
    }
    queue.push(name);
  }
} else {
  for (const name of packages.keys()) {
    selected.add(name);
  }
}

const dependencyFields = [
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
];

while (queue.length > 0) {
  const name = queue.shift();
  if (!name || selected.has(name)) {
    continue;
  }
  selected.add(name);
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
      if (packages.has(depName) && !selected.has(depName)) {
        queue.push(depName);
      }
    }
  }
}

if (!options.includePrivate) {
  for (const name of selected) {
    const pkg = packages.get(name);
    if (pkg?.private) {
      throw new Error(`包 ${name} 为 private，无法发布`);
    }
  }
}

const nodes = Array.from(selected).filter((name) => {
  const pkg = packages.get(name);
  if (!pkg) {
    return false;
  }
  if (options.includePrivate) {
    return true;
  }
  return !pkg.private;
});

const adjacency = new Map();
const indegree = new Map();

for (const name of nodes) {
  adjacency.set(name, new Set());
  indegree.set(name, 0);
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
      if (!selected.has(depName)) {
        continue;
      }
      const depPkg = packages.get(depName);
      if (depPkg?.private && !options.includePrivate) {
        throw new Error(`包 ${name} 依赖 private 包 ${depName}，无法发布`);
      }
      if (!adjacency.get(depName)) {
        continue;
      }
      if (!adjacency.get(depName).has(name)) {
        adjacency.get(depName).add(name);
        indegree.set(name, (indegree.get(name) ?? 0) + 1);
      }
    }
  }
}

const order = [];
const ready = nodes.filter((name) => (indegree.get(name) ?? 0) === 0).sort();

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

const result = order.map((name) => {
  const pkg = packages.get(name);
  return {
    name,
    dir: pkg?.dir ?? "",
  };
});

if (options.json) {
  console.log(JSON.stringify({ order: result }, null, 2));
} else {
  console.log("发布顺序:");
  result.forEach((item, index) => {
    console.log(
      `${index + 1}. ${item.name} (${path.relative(repoRoot, item.dir)})`,
    );
  });
}

if (options.bump) {
  for (const item of result) {
    const pkg = packages.get(item.name);
    if (!pkg) {
      continue;
    }
    const nextVersion = bumpVersion(pkg.json.version, options.bump);
    pkg.json.version = nextVersion;
    await writeFile(
      path.join(pkg.dir, "package.json"),
      `${JSON.stringify(pkg.json, null, 2)}\n`,
      "utf8",
    );
  }
}

if (options.publish) {
  const failures = [];
  for (const item of result) {
    const pkgDir = item.dir;
    const pkgName = item.name;
    const command = ["publish", "--access", options.access];
    if (options.tag) {
      command.push("--tag", options.tag);
    }
    if (options.dryRun) {
      command.push("--dry-run");
    }
    if (options.noGitChecks) {
      command.push("--no-git-checks");
    }
    let success = false;
    let lastStatus = 1;
    while (true) {
      const res = spawnSync("pnpm", command, {
        stdio: "inherit",
        cwd: pkgDir,
      });
      lastStatus = res.status ?? 1;
      if (lastStatus === 0) {
        success = true;
        break;
      }
      const confirmed = await shouldRetry(pkgName);
      if (!confirmed) {
        break;
      }
    }
    if (!success) {
      failures.push({ name: pkgName, status: lastStatus });
    }
  }
  if (failures.length > 0) {
    console.log("发布失败的包:");
    for (const item of failures) {
      console.log(`- ${item.name} (status ${item.status})`);
    }
    process.exitCode = 1;
  }
}
