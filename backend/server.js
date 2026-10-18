import express from 'express'
import cors from 'cors'
import generateId from './utils/generateId.js'
import { simpleGit, CleanOptions } from 'simple-git';
import path from 'path'
import getAllFiles from './utils/getAllFiles.js';
import { fileURLToPath } from "url";
import {uploadFiles} from "./utils/uploadToS3.js"
import {addJobs} from "./utils/queue.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

simpleGit().clean(CleanOptions.FORCE);

const app = express()

// using cors
app.use(cors())
app.use(express.json())

// routes
app.post('/deploy',async(req,res)=>{
    const githubUrl= req.body.repoUrl
    const folderId=generateId()         
  
    const folderPath=path.join(__dirname,`github-repos/${folderId}`)
    const git=simpleGit()
    console.log("cloning...")
    await git.clone(githubUrl,folderPath)
    const files=getAllFiles(folderPath)
    console.log("cloning done")
    console.log("uploading to s3")
    const keys = await uploadFiles(files);
    console.log("uploading to s3 done")
    await  addJobs(folderId)
    console.log("job added to queue")
    res.json({
        id:folderId,
        success:true
    })

})

// listen
app.listen(3000,()=>{
    console.log('server is runing')
})