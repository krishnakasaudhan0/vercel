
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { downloadS3Folder } from "./utils/downloadFromS3.js";
import { buildProject } from "./utils/buildproject.js";

const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "vercel",
  async (job) => {
    await downloadS3Folder(job.data.id)
    console.log("downloaded ", job.data.id);
    const type = await checkType(job.data.id)
    if (type === "vite" || type === "cra") {
      await buildProject(job.data.id)
    }

    console.log("built ", job.data.id);
    await uploadDist(job.data.id)
    console.log("uploaded dist to s3 ", job.data.id);

  },
  { connection },
);