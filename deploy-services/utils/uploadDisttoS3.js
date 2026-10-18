import "dotenv/config";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import getAllFiles from "./getAllFiles.js";

import checkType from "./checkProjectType.js";

const s3 = new S3Client({ region: process.env.AWS_REGION });

const BASE_DIR = "/Users/krishnakasaudhan/vercel/deploy-services/s3files";

async function uploadFile(localPath, id, type) {
  let relative, key;

  if (type === "vite") {
    relative = path.relative(path.join(BASE_DIR, id, "dist"), localPath)
      .split(path.sep).join("/");
    key = `dist/${id}/${relative}`;
  } else if (type === "cra") {
    relative = path.relative(path.join(BASE_DIR, id, "build"), localPath)
      .split(path.sep).join("/");
    key = `build/${id}/${relative}`;
  } else {
    // plain — upload directly from project root
    relative = path.relative(path.join(BASE_DIR, id), localPath)
      .split(path.sep).join("/");
    key = `${id}/${relative}`;
  }

  await new Upload({
    client: s3,
    params: {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: fs.createReadStream(localPath),
      ContentType: mime.lookup(localPath) || "application/octet-stream",
    },
  }).done();

  return key;
}

export async function uploadDist(id, concurrency = 10) {
  const type = checkType(id);

  let sourcePath;
  if (type === "vite") {
    sourcePath = path.join(BASE_DIR, id, "dist");
  } else if (type === "cra") {
    sourcePath = path.join(BASE_DIR, id, "build");
  } else {
    sourcePath = path.join(BASE_DIR, id);
  }

  const files = getAllFiles(sourcePath);
  const keys = [];

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    keys.push(...(await Promise.all(batch.map(f => uploadFile(f, id, type)))));
  }
  return keys;
}

await uploadDist("1792254495555").then(() => console.log("Upload complete!")).catch((error) => console.error("Upload failed:", error));
