#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hookPath = ".githooks";

function inspectGit(args, optional = false) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (optional) return "";
    throw error;
  }
}

function skipSetup(message) {
  console.warn(`Skipped Git hook setup: ${message}`);
  process.exit(0);
}

let topLevel;
try {
  topLevel = realpathSync(inspectGit(["rev-parse", "--show-toplevel"]));
} catch (error) {
  if (!existsSync(path.join(root, ".git"))) {
    skipSetup("this source root is outside a Git checkout");
  }
  throw new Error(`Could not inspect the Git checkout: ${error.message}`);
}

if (realpathSync(root) !== topLevel) {
  if (!existsSync(path.join(root, ".git"))) {
    skipSetup(`this source root is inside another Git worktree at ${topLevel}`);
  }
  throw new Error(`Hook setup target must be the Git worktree root: ${topLevel}`);
}

const configured = inspectGit(["config", "--get", "core.hooksPath"], true) || null;
if (configured && configured !== hookPath) {
  skipSetup(`core.hooksPath is already ${configured}; preserved the existing hook configuration`);
}

if (!configured) {
  const hooksDirectory = path.resolve(root, inspectGit(["rev-parse", "--git-path", "hooks"]));
  const activeHooks = existsSync(hooksDirectory)
    ? readdirSync(hooksDirectory).filter((name) => {
        if (name.endsWith(".sample")) return false;
        const hookFile = path.join(hooksDirectory, name);
        const stat = lstatSync(hookFile);
        return stat.isSymbolicLink() || (stat.isFile() && (stat.mode & 0o111) !== 0);
      })
    : [];
  if (activeHooks.length) {
    skipSetup(`existing hooks are installed at ${hooksDirectory}: ${activeHooks.join(", ")}`);
  }
  inspectGit(["config", "core.hooksPath", hookPath]);
}

console.log(`Git hooks enabled from ${hookPath}`);
