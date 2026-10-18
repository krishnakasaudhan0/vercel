
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { downloadS3Folder } from "./utils/downloadFromS3.js";

const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "vercel",
  async (job) => {
    console.log(job.data);
  },
  { connection },
);