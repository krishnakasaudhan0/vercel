import "dotenv/config";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const s3 = new S3Client({ region: process.env.AWS_REGION });

const BASE_DIR = "/Users/krishnakasaudhan/vercel/backend/github-repos";

async function uploadFile(localPath) {  
  // "/Users/.../github-repos/1792254495555/.git/HEAD" -> "1792254495555/.git/HEAD"
  const key = path.relative(BASE_DIR, localPath).split(path.sep).join("/");

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

export async function uploadFiles(files, concurrency = 10) {
  const keys = [];
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    keys.push(...(await Promise.all(batch.map(uploadFile))));
  }
  return keys;
}
