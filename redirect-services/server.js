import express from 'express'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import "dotenv/config";

const app=express()




const s3Client = new S3Client({ 

    region: process.env.AWS_REGION 
});
const bucketName = process.env.S3_BUCKET;

app.get("/*", async (req, res) => {
    const host = req.hostname;
    // On localhost, use ?id=<projectId> as fallback (local dev only)
    const id = host === "localhost" ? req.query.id : host.split(".")[0];

    // If the path ends with "/" or has no extension, serve index.html
    let filePath = req.path;
    if (filePath === "/" || !path.extname(filePath)) {
        filePath = "/index.html";
    }

    // S3 key: dist/<id>/index.html  or  dist/<id>/assets/main.js etc.
    const s3Key = `dist/${id}${filePath}`;

    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
        });

        const s3Response = await s3Client.send(command);

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
})

app.listen(3001,()=>{
    console.log("server is running")
})