
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import checkType from "./checkProjectType";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localFilesPath = path.join(__dirname, '..'); 


const execFileAsync = promisify(execFile);





export async function buildProject(id) {

    console.log("Starting build...");
    const projectPath=`${localFilesPath}/s3files/${id}`
    if(!fs.existsSync(projectPath)){
        console.log("Build files not found");
        return;
    }
    try {
        const { stdout, stderr } = await execFileAsync("docker", [
            "run",
            "--rm",

            // Mount local project into container
            "-v",
            `${projectPath}:/app`,

            // Working directory
            "-w",
            "/app",

            // Node image
            "node:22",

            // Commands inside container
            "sh",
            "-c",
            "npm install && npm run build"
        ]);

        console.log(stdout);

        if (stderr) {
            console.error(stderr);
        }

        console.log("Build completed!");
        const type=checkType(id)
        if(type=="vite" ){
            return `${projectPath}/dist`;

        }
        return `${projectPath}/build`;

        // For Vite/React projects
        
    } catch (error) {
        console.error("Build failed:");

        console.error(error.stderr || error.message);

        throw error;
    }
}

buildProject("1792254495555").then(() => console.log("Build completed!")).catch((error) => console.error("Build failed:", error));