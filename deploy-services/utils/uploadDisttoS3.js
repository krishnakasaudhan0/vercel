import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mime from "mime-types";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import getAllFiles from "./getAllFiles.js";
import checkType from "./checkProjectType.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const s3 = new S3Client({ region: process.env.AWS_REGION });

// Derive BASE_DIR relative to this file so it works regardless of CWD
const BASE_DIR = path.join(__dirname, "../s3files");

// ─── Framework output configuration ──────────────────────────────────────────

/**
 * Maps each framework type to:
 *  - subDir   : the sub-directory inside the project folder that contains
 *               the built output (null = project root)
 *  - s3Prefix : the top-level S3 key prefix used when storing the files
 *
 * This drives BOTH which local folder we read from AND how we build the S3 key,
 * so the redirect service can resolve files consistently.
 */
const FRAMEWORK_OUTPUT = {
  vite:    { subDir: "dist",           s3Prefix: "dist" },
  astro:   { subDir: "dist",           s3Prefix: "dist" },
  cra:     { subDir: "build",          s3Prefix: "build" },
  next:    { subDir: "out",            s3Prefix: "out" },
  // Nuxt 3 uses .output/public; Nuxt 2 uses dist/ — resolved at runtime below
  nuxt:    { subDir: null,             s3Prefix: "dist" },
  remix:   { subDir: path.join("build", "client"), s3Prefix: "build" },
  svelte:  { subDir: "build",          s3Prefix: "build" },
  // Angular outputPath is defined in angular.json; resolved at runtime below
  angular: { subDir: null,             s3Prefix: "dist" },
  plain:   { subDir: null,             s3Prefix: "" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the local source directory that contains the built files.
 * For most frameworks this is straightforward; Angular and Nuxt need
 * their config files inspected.
 */
function resolveSourceDir(id, type, projectPath) {
  const cfg = FRAMEWORK_OUTPUT[type] || FRAMEWORK_OUTPUT.plain;

  if (type === "angular") {
    // Read angular.json to get the configured outputPath
    const ngConfigPath = path.join(projectPath, "angular.json");
    const ngConfig = JSON.parse(fs.readFileSync(ngConfigPath, "utf8"));
    const projects = ngConfig.projects || {};
    const projectName = ngConfig.defaultProject || Object.keys(projects)[0];
    const buildOptions =
      projects[projectName]?.architect?.build?.options ||
      projects[projectName]?.targets?.build?.options;
    return path.join(projectPath, buildOptions.outputPath);
  }

  if (type === "nuxt") {
    // Nuxt 3 → .output/public  |  Nuxt 2 → dist/
    const nuxt3OutputDir = path.join(projectPath, ".output", "public");
    return fs.existsSync(nuxt3OutputDir)
      ? nuxt3OutputDir
      : path.join(projectPath, "dist");
  }

  if (cfg.subDir) {
    return path.join(projectPath, cfg.subDir);
  }

  // plain / fallback – upload from project root
  return projectPath;
}

/**
 * Build the S3 key for a single file.
 * Pattern: `<s3Prefix>/<id>/<relative-path-within-output-dir>`
 * For plain sites the prefix is empty so the pattern is just `<id>/<relative>`.
 */
function buildS3Key(localFilePath, sourceDir, id, s3Prefix) {
  const relative = path.relative(sourceDir, localFilePath).split(path.sep).join("/");
  return s3Prefix ? `${s3Prefix}/${id}/${relative}` : `${id}/${relative}`;
}

/**
 * Upload a single file to S3 and return the S3 key.
 */
async function uploadFile(localPath, s3Key) {
  await new Upload({
    client: s3,
    params: {
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: fs.createReadStream(localPath),
      ContentType: mime.lookup(localPath) || "application/octet-stream",
    },
  }).done();

  console.log(`[uploadDist] Uploaded: ${s3Key}`);
  return s3Key;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Detect the framework, collect all output files, and upload them to S3 in
 * parallel batches.
 *
 * @param {string} id          - Deployment ID
 * @param {number} concurrency - Number of parallel uploads (default 10)
 * @returns {Promise<string[]>} - Array of uploaded S3 keys
 */
export async function uploadDist(id, concurrency = 10) {
  const projectPath = path.join(BASE_DIR, id);

  if (!fs.existsSync(projectPath)) {
    throw new Error(`[uploadDist] Project directory not found: ${projectPath}`);
  }

  const type = checkType(id);
  console.log(`[uploadDist] Framework: ${type}, id: ${id}`);

  const cfg = FRAMEWORK_OUTPUT[type] || FRAMEWORK_OUTPUT.plain;
  const sourceDir = resolveSourceDir(id, type, projectPath);

  if (!fs.existsSync(sourceDir)) {
    throw new Error(
      `[uploadDist] Output directory not found: ${sourceDir}. ` +
        "Did the build step complete successfully?"
    );
  }

  const files = getAllFiles(sourceDir);
  console.log(`[uploadDist] Found ${files.length} files to upload from ${sourceDir}`);

  const keys = [];
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchKeys = await Promise.all(
      batch.map((f) => uploadFile(f, buildS3Key(f, sourceDir, id, cfg.s3Prefix)))
    );
    keys.push(...batchKeys);
  }

  console.log(`[uploadDist] Upload complete. ${keys.length} files uploaded.`);
  return keys;
}
