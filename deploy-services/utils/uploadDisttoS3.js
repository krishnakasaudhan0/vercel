import "dotenv/config";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import getAllFiles from "./getAllFiles.js";

const s3 = new S3Client({ region: process.env.AWS_REGION });

const BASE_DIR = "/Users/krishnakasaudhan/vercel/deploy-services/s3files";

async function uploadFile(localPath, id) {
  // e.g. localPath = ".../s3files/<id>/dist/index.html"
  // relative = "<id>/dist/index.html"
  // key = "dist/<id>/index.html"
  const relative = path.relative(path.join(BASE_DIR, id, "dist"), localPath)
                       .split(path.sep).join("/");
  const key = `dist/${id}/${relative}`;

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
  const distPath = path.join(BASE_DIR, id, "dist");
  const files = getAllFiles(distPath);
  const keys = [];

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    keys.push(...(await Promise.all(batch.map(f => uploadFile(f, id)))));
  }
  return keys;
}

await uploadDist("1792254495555").then(() => console.log("Upload complete!")).catch((error) => console.error("Upload failed:", error));
