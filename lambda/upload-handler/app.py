import os
import base64
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext

# Environment variables
INCOMING_BUCKET_NAME = os.environ["INCOMING_BUCKET_NAME"]

# AWS clients
s3_client = boto3.client("s3")

# Powertools
logger = Logger()
app = APIGatewayHttpResolver()

@app.post("/upload")
def upload_document():
    try:
        # Get the file from the request body
        file_content = base64.b64decode(app.current_event.body)
        file_name = app.current_event.get_header_value("x-file-name", "default-name.pdf")

        # Upload to S3
        s3_client.put_object(
            Bucket=INCOMING_BUCKET_NAME,
            Key=f"incoming/{file_name}",
            Body=file_content
        )

        logger.info(f"Successfully uploaded {file_name} to {INCOMING_BUCKET_NAME}")
        return {"message": "File uploaded successfully!"}, 200

    except Exception as e:
        logger.exception(e)
        return {"message": "Internal Server Error"}, 500

@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_REST)
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)