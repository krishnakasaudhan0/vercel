import fs from 'fs';
import path from 'path'; // 1. Added missing import

export default function getAllFiles(folderPath) {
    let response = [];

    // Read everything inside the current directory
    const allFileAndFolders = fs.readdirSync(folderPath);

    allFileAndFolders.forEach(element => {
        const localFilePath = path.join(folderPath, element);
        
        // 2. Check if the element is a directory or a file
        if (fs.statSync(localFilePath).isDirectory()) {
            // If it's a folder, recursively get files inside it and merge them
            response = response.concat(getAllFiles(localFilePath));
        } else {
            // If it's a file, push its absolute path to our response array
            response.push(localFilePath);
        }
    });

    return response; // 3. Return the array containing all paths
}

// Example usage:
const files = getAllFiles('/Users/krishnakasaudhan/vercel/deploy-services/s3files/1792254495555/dist');
console.log(files);
