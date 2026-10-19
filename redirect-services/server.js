import express from 'express'
import { S3Client, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import "dotenv/config";

const app = express();

const s3Client = new S3Client({
    region: process.env.AWS_REGION
});
const bucketName = process.env.S3_BUCKET;

/**
 * S3 key prefixes used by each framework, in probe order.
 * This must match the s3Prefix values in uploadDisttoS3.js → FRAMEWORK_OUTPUT.
 * We try them in order and serve the first key that exists.
 *
 *  Framework      → prefix
 *  vite / astro   → dist
 *  next           → out
 *  cra / svelte / remix → build
 *  plain          → (no prefix — just <id>/file)
 */
const S3_KEY_PREFIXES = ["dist", "out", "build", null];

/**
 * Check whether a given S3 key exists by sending a HeadObject request.
 * Returns true on success, false on 404, throws on other errors.
 */
async function s3KeyExists(key) {
    try {
        await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
        return true;
    } catch (err) {
        if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
            return false;
        }
        throw err;
    }
}

/**
 * Resolve the correct S3 key for a deployment by probing each prefix.
 * Returns the first key that exists, or null if none found.
 */
async function resolveS3Key(id, filePath) {
    for (const prefix of S3_KEY_PREFIXES) {
        const key = prefix ? `${prefix}/${id}${filePath}` : `${id}${filePath}`;
        if (await s3KeyExists(key)) {
            return key;
        }
    }
    return null;
}

app.get("/*", async (req, res) => {
    const host = req.hostname;
    // On localhost, use ?id=<projectId> as fallback (local dev only)
    const id = host === "localhost" ? req.query.id : host.split(".")[0];

    if (!id) {
        return res.status(400).send("Missing project id");
    }

    // If the path ends with "/" or has no extension, serve index.html
    let filePath = req.path;
    if (filePath === "/" || !path.extname(filePath)) {
        filePath = "/index.html";
    }

    try {
        // Probe each framework prefix to find where this project's files live
        const s3Key = await resolveS3Key(id, filePath);

        if (!s3Key) {
            return res.status(404).send("404 Not Found");
        }

        const s3Response = await s3Client.send(
            new GetObjectCommand({ Bucket: bucketName, Key: s3Key })
        );

        // Set the correct Content-Type from S3 metadata
        const contentType = s3Response.ContentType || "application/octet-stream";
        res.setHeader("Content-Type", contentType);

        // Stream the S3 body directly to the HTTP response
        Readable.from(s3Response.Body).pipe(res);

    } catch (err) {
        if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
            return res.status(404).send("404 Not Found");
        }
        console.error("S3 fetch error:", err);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(3001, () => {
    console.log("server is running on port 3001");
});