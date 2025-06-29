import json
import logging
import os
import boto3
import re

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')
bedrock_runtime_client = boto3.client('bedrock-runtime')
lambda_client = boto3.client('lambda')

# Environment variables for Bedrock model ID and Router Lambda ARN
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-instant-v1")
ROUTER_LAMBDA_ARN = os.environ.get("ROUTER_LAMBDA_ARN")

def lambda_handler(event, context):
    # The event from the classifier Lambda will contain the S3 object details
    # and the classification result.
    # For now, we'll assume the event directly contains the S3 object details
    # and we'll extract the classification from the event if it's passed.

    bucket_name = event['bucket_name']
    object_key = event['object_key']
    document_type = event.get('document_type', 'unknown')

    logger.info(f"Extracting data from document {object_key} (Type: {document_type}) from bucket {bucket_name}")

    try:
        # Get the document content from S3
        response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
        document_content = response['Body'].read().decode('utf-8')
        logger.info(f"Document content read: {document_content[:100]}...") # Log first 100 chars

        # Prepare prompt for Bedrock extraction
        # This prompt is generic; in a real scenario, it would be tailored per document_type
        prompt = f"Human: Extract fields: [\"vendor_name\", \"invoice_number\", \"total_amount\", \"due_date\"] from the document below as structured JSON.\n\nDocument:\n{document_content}\nAssistant:"
        logger.info(f"Extraction prompt prepared: {prompt[:100]}...") # Log first 100 chars of prompt

        # Invoke Bedrock for extraction
        bedrock_response = bedrock_runtime_client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "prompt": prompt,
                "max_tokens_to_sample": 500,
                "temperature": 0.1,
            })
        )
        logger.info("Bedrock extraction invocation successful.")

        response_body = json.loads(bedrock_response['body'].read())
        bedrock_completion = response_body['completion'].strip()
        logger.info(f"Bedrock raw completion: {bedrock_completion}")

        # Attempt to parse JSON using regex to find the JSON block
        json_match = re.search(r'```json\n(.*?)```', bedrock_completion, re.DOTALL)
        if json_match:
            json_string = json_match.group(1).strip()
        else:
            # If no code block, try to parse the whole completion as JSON
            json_string = bedrock_completion

        try:
            extracted_data = json.loads(json_string)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON from Bedrock completion: {e}")
            extracted_data = {"error": "JSONDecodeError", "raw_completion": bedrock_completion}

        logger.info(f"Extracted data for {object_key}: {json.dumps(extracted_data)}")

        # Invoke Router Lambda
        if ROUTER_LAMBDA_ARN:
            payload = {
                "bucket_name": bucket_name,
                "object_key": object_key,
                "document_type": document_type,
                "extracted_data": extracted_data
            }
            lambda_client.invoke(
                FunctionName=ROUTER_LAMBDA_ARN,
                InvocationType='Event',  # Asynchronous invocation
                Payload=json.dumps(payload)
            )
            logger.info(f"Invoked Router Lambda for {object_key}")
        else:
            logger.warning("ROUTER_LAMBDA_ARN not set. Skipping Router Lambda invocation.")

    except Exception as e:
        logger.error(f"Error extracting data from document {object_key}: {e}", exc_info=True) # Log full traceback
        raise e

    return {
        'statusCode': 200,
        'body': json.dumps('Document data extraction initiated!')
    }