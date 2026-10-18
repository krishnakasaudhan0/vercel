import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import "dotenv/config";


const s3Client = new S3Client({ region: process.env.AWS_REGION });

const bucketName = process.env.S3_BUCKET;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localFilesPath = path.join(__dirname, '..'); 


export async function downloadS3Folder(id) {
  const s3Folder = `${id}/`;
  const localDirPath = path.join(localFilesPath, "s3files", id);

  try {
    console.log("Bucket:", bucketName);
    console.log("Searching for prefix:", s3Folder);

    let continuationToken;
    let downloadedCount = 0;

    do {
      const listResponse = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: s3Folder,
          ContinuationToken: continuationToken,
        })
      );

      const objects = (listResponse.Contents ?? []).filter(
        (object) => object.Key && !object.Key.endsWith("/")
      );

      console.log(
        "Matching S3 keys:",
        objects.map((object) => object.Key)
      );

      for (const object of objects) {
        const fileKey = object.Key;
        const relativePath = fileKey.slice(s3Folder.length);
        const destinationPath = path.join(localDirPath, relativePath);

        fs.mkdirSync(path.dirname(destinationPath), {
          recursive: true,
        });

        const response = await s3Client.send(
          new GetObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
          })
        );

        if (!response.Body) {
          throw new Error(`Empty response body for ${fileKey}`);
        }

        await new Promise((resolve, reject) => {
          const output = fs.createWriteStream(destinationPath);

          response.Body.pipe(output);
          response.Body.on("error", reject);
          output.on("error", reject);
          output.on("finish", resolve);
        });

        downloadedCount++;
        console.log(`Downloaded: ${fileKey} -> ${destinationPath}`);
      }

      continuationToken = listResponse.IsTruncated
        ? listResponse.NextContinuationToken
        : undefined;
    } while (continuationToken);

    if (downloadedCount === 0) {
      console.log(
        "No matching files found. Check the S3 object keys and prefix."
      );
      return;
    }

    console.log(`Download complete. Files downloaded: ${downloadedCount}`);
  } catch (error) {
    console.error("S3 download failed:", error);
  }
}

// --- Execute the Function ---
// const BUCKET = "my-awesome-bucket";
 // Include the trailing slash
// const LOCAL_PATH = "./downloads/images";

 downloadS3Folder("2wr5g");
