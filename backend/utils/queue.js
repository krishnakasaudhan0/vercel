
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

export const myQueue = new Queue("vercel", {
  connection,
});

export async function addJobs(id) {
  await myQueue.add("deploy", { id });
  console.log(`Job added: ${id}`);
}

try {
  await addJobs("adsfad");
  await addJobs("adfad");
} catch (error) {
  console.error("Failed to add jobs:", error);
} finally {
  await myQueue.close();
  await connection.quit();
}
