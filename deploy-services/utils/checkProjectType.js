//check weather the project is vite , CRA or plain html/css/js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localFilesPath = path.join(__dirname, '../s3files');


export default function checkType(id) {
    const projectPath = localFilesPath + `/${id}/package.json`
    try {

        if (fs.existsSync(projectPath)) {
            const packageJson = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
            const inDeps = packageJson.dependencies && 'vite' in packageJson.dependencies;
            const inDevDeps = packageJson.devDependencies && 'vite' in packageJson.devDependencies;
            if (inDeps || inDevDeps) {
                return "vite"
            }
            return "cra"
        }
        else {
            return "plain"
        }
    } catch (error) {
        console.log(error)
    }

}