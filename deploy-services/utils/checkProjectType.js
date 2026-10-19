// Detect the JS framework used in a project by inspecting package.json.
// Supported frameworks: vite, cra, next, nuxt, astro, svelte, remix, angular, plain

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localFilesPath = path.join(__dirname, "../s3files");

/**
 * Each entry describes one detectable framework.
 *  - type      : the string returned to callers
 *  - packages  : one or more package names whose presence (in deps or devDeps)
 *                identifies the framework. The FIRST match wins, so order matters.
 */
const FRAMEWORK_SIGNATURES = [
  // ── React family ────────────────────────────────────────────────────────────
  { type: "cra",     packages: ["react-scripts"] },
  { type: "vite",    packages: ["vite"] },

  // ── Meta-frameworks ──────────────────────────────────────────────────────────
  { type: "next",    packages: ["next"] },
  { type: "nuxt",    packages: ["nuxt"] },
  { type: "remix",   packages: ["@remix-run/node", "@remix-run/react"] },
  { type: "astro",   packages: ["astro"] },

  // ── Component frameworks ─────────────────────────────────────────────────────
  { type: "svelte",  packages: ["@sveltejs/kit", "svelte"] },
  { type: "angular", packages: ["@angular/core"] },
];

/**
 * Returns true if any of the given package names appear in the project's
 * dependencies or devDependencies.
 */
function hasPackage(packageJson, ...pkgNames) {
  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};
  return pkgNames.some((pkg) => pkg in deps || pkg in devDeps);
}

/**
 * Detects the framework for the project identified by `id`.
 *
 * @param {string} id - The deployment ID (used to locate the project folder).
 * @returns {string}  - One of the FRAMEWORK_SIGNATURES types, or "plain".
 */
export default function checkType(id) {
  const pkgJsonPath = path.join(localFilesPath, id, "package.json");

  try {
    if (!fs.existsSync(pkgJsonPath)) {
      // No package.json → treat as plain static HTML/CSS/JS
      return "plain";
    }

    const packageJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));

    for (const { type, packages } of FRAMEWORK_SIGNATURES) {
      if (hasPackage(packageJson, ...packages)) {
        console.log(`[checkProjectType] Detected framework: ${type}`);
        return type;
      }
    }

    // package.json exists but no recognised framework dependency found
    console.log("[checkProjectType] No recognised framework found, treating as plain");
    return "plain";
  } catch (err) {
    console.error("[checkProjectType] Error reading package.json:", err.message);
    // Default to plain so the pipeline can still attempt an upload
    return "plain";
  }
}