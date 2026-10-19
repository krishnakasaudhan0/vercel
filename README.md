# backend - upload layer
this is the upload layer it take git repo url as input ,clone it locally and deploy it to the s3 bucket
### Api Endpoints 
  post /deploy
    fetch the github url
    clone locally
    upload to s3 bucket
    add to queue(BullMQ)
    send success json

  output 
    {
        id:folderId,
        success:true
    }
    
# deploy services - build layer
take the code from s3 bucket ..build in inside a docker container and upload the dist folder back to s3
  ### Api Endpoints
     take process from the queue (job.data.id)
     download the project from s3
     build the file 
        if the build is success full then the response is 
           {
               "build_status": "success",
               "outputPath": "/path/to/project/dist"
          }
        if build is failed then it return the potential risk and fix the response is like this
           {
                "build_status": "failed",
                "potential_cause": "The build command executed `npm run build`, but the `package.json` file is missing a \"build\" script...",
                "confidence": "high",
                "fix": "Open `package.json` and add the `build` command...",
                "additional_checks": [...]
            }


     send build  folder (output) back to s3
     
# redirect services - redirect layer
fetch the id from the url ..redirect to the s3 

   ### api endpoints
     "/*" 
       get the id from the url 
       redirect to the s3 bucket
