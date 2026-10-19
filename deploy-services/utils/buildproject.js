
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import checkType from "./checkProjectType.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localFilesPath = path.join(__dirname, "..");

const execFileAsync = promisify(execFile);

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve the dist-folder path for Angular projects.
 * Reads angular.json and finds the outputPath for the default project.
 * Supports both the legacy `defaultProject` key and the modern `$schema`-based
 * approach where the first entry under `projects` is used as a fallback.
 */
function resolveAngularOutputPath(projectPath) {
  const ngConfigPath = path.join(projectPath, "angular.json");
  if (!fs.existsSync(ngConfigPath)) {
    throw new Error("angular.json not found");
  }

  const ngConfig = JSON.parse(fs.readFileSync(ngConfigPath, "utf8"));
  const projects = ngConfig.projects || {};

  // Pick the target project name: prefer `defaultProject`, else first key
  const projectName = ngConfig.defaultProject || Object.keys(projects)[0];
  if (!projectName || !projects[projectName]) {
    throw new Error("Cannot resolve Angular project name from angular.json");
  }

  const buildOptions =
    projects[projectName]?.architect?.build?.options ||
    projects[projectName]?.targets?.build?.options;

  if (!buildOptions || !buildOptions.outputPath) {
    throw new Error("Cannot find outputPath in angular.json");
  }

  return path.join(projectPath, buildOptions.outputPath);
}

/**
 * Resolve the export output directory for Next.js projects.
 * next.config.js is a JS module, not JSON, so we read it as text and use a
 * regex to detect `output: 'export'` or `output: "export"`.
 * Static export puts files into `out/`.
 */
function resolveNextOutputPath(projectPath) {
  // Check both .js and .ts / .mjs variants
  const candidates = [
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
  ];

  for (const candidate of candidates) {
    const cfgPath = path.join(projectPath, candidate);
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, "utf8");
      // Matches  output: 'export'  or  output: "export"
      if (/output\s*:\s*['"]export['"]/.test(raw)) {
        return path.join(projectPath, "out");
      }
      // Next.js default output (server-side) – not statically exportable
      throw new Error(
        'Next.js project does not have `output: "export"` set in next.config.*. ' +
          "Only static exports are supported."
      );
    }
  }

  throw new Error("next.config.* not found in project root");
}

// ─── framework → dist-folder map ─────────────────────────────────────────────

/**
 * Returns the absolute path to the built output directory for the given
 * framework type.
 *
 * @param {string} type        - Framework string from checkType()
 * @param {string} projectPath - Absolute path to the downloaded project
 * @returns {string}           - Absolute path to the output directory
 */
function resolveOutputPath(type, projectPath) {
  switch (type) {
    case "vite":
    case "astro":
      // Both use `dist/` by default
      return path.join(projectPath, "dist");

    case "cra":
      return path.join(projectPath, "build");

    case "next":
      return resolveNextOutputPath(projectPath);

    case "nuxt":
      // `nuxt generate` outputs to `.output/public` (Nuxt 3) or `dist/` (Nuxt 2)
      // Check which version is in use
      return fs.existsSync(path.join(projectPath, ".output"))
        ? path.join(projectPath, ".output", "public")
        : path.join(projectPath, "dist");

    case "remix":
      // Remix (Vite-based) puts static assets in `build/client/`
      return path.join(projectPath, "build", "client");

    case "svelte":
      // SvelteKit adapter-static outputs to `build/`
      return path.join(projectPath, "build");

    case "angular":
      return resolveAngularOutputPath(projectPath);

    case "plain":
    default:
      // No build step – serve the source directly
      return projectPath;
  }
}

// ─── build commands ──────────────────────────────────────────────────────────

/**
 * Returns the shell command to run inside the Docker container for a given
 * framework type.  Most frameworks use `npm run build`, but some need extras.
 */
function getBuildCommand(type) {
  switch (type) {
    case "next":
      // next build honours `output: "export"` automatically
      return "npm install && npm run build";
    case "nuxt":
      // nuxt generate creates a fully-static site
      return "npm install && npm run generate";
    default:
      return "npm install && npm run build";
  }
}

// ─── main export ─────────────────────────────────────────────────────────────

/**
 * Builds the project identified by `id` inside a Docker container and returns
 * the absolute path to the output directory ready for upload.
 *
 * @param {string} id - Deployment ID
 * @returns {Promise<string>} - Absolute path to the built output directory
 */
export async function buildProject(id) {
  console.log(`[buildProject] Starting build for id=${id}`);

  const projectPath = path.join(localFilesPath, "s3files", id);
  if (!fs.existsSync(projectPath)) {
    throw new Error(`[buildProject] Project files not found at ${projectPath}`);
  }

  const type = checkType(id);
  console.log(`[buildProject] Framework: ${type}`);

  if (type === "plain") {
    // Plain static projects don't need a build step
    console.log("[buildProject] Plain project – skipping build step");
    return projectPath;
  }

  const buildCmd = getBuildCommand(type);
  console.log(`[buildProject] Running: ${buildCmd}`);

  try {
    const { stdout, stderr } = await execFileAsync("docker", [
      "run",
      "--rm",

      // Mount local project into container
      "-v",
      `${projectPath}:/app`,

      // Working directory inside container
      "-w",
      "/app",

      // Node LTS image
      "node:22",

      // Shell command
      "sh",
      "-c",
      buildCmd,
    ]);

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log("[buildProject] Build completed successfully");
  } catch (err) {
    console.error("[buildProject] Build failed:", err.stderr || err.message);
    throw err;
  }

  const outputPath = resolveOutputPath(type, projectPath);

  if (!fs.existsSync(outputPath)) {
    throw new Error(
      `[buildProject] Expected output directory not found: ${outputPath}`
    );
  }

  console.log(`[buildProject] Output directory: ${outputPath}`);
  return outputPath;
}
