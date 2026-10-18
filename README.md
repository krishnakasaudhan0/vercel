# backend - upload layer
this is the upload layer it take git repo url as input ,clone it locally and deploy it to the s3 bucket
# deploy services - build layer
take the code from s3 bucket ..build in inside a docker container and upload the dist folder back to s3
# redirect services - redirect layer
fetch the id from the url ..redirect to the s3 
