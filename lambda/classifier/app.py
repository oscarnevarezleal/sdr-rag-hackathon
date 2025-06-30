import json
import logging
import os
import boto3
import io
import PyPDF2

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')
bedrock_runtime_client = boto3.client('bedrock-runtime')
lambda_client = boto3.client('lambda')

# Environment variables for Bedrock model ID and Extractor Lambda ARN
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-instant-v1")
EXTRACTOR_LAMBDA_ARN = os.environ.get("EXTRACTOR_LAMBDA_ARN")

def lambda_handler(event, context):
    for record in event['Records']:
        bucket_name = record['s3']['bucket']['name']
        object_key = record['s3']['object']['key']

        logger.info(f"Processing document {object_key} from bucket {bucket_name}")

        try:
            # Get the document content from S3
            response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
            # Read the PDF content as bytes
            pdf_content = response['Body'].read()
            
            # Use PyPDF2 to extract text
            pdf_file = io.BytesIO(pdf_content)
            reader = PyPDF2.PdfReader(pdf_file)
            document_content = ""
            for page_num in range(len(reader.pages)):
                document_content += reader.pages[page_num].extract_text() or ""
            
            logger.info(f"Document content extracted (first 100 chars): {document_content[:100]}...")

            # Prepare prompt for Bedrock classification
            prompt = f"Human: Document types: [\"invoice\", \"receipt\", \"shipping_order\", \"purchase_order\", \"contract\", \"inventory_report\", \"unknown\"]\nClassify this document clearly into one type, if it is not one of the types, return \"unknown\". Do not return any other text than the type.\n\nDocument Content:\n{document_content}\nAssistant:"
            logger.info(f"Prompt prepared: {prompt[:100]}...") # Log first 100 chars of prompt

            # Invoke Bedrock for classification
            bedrock_response = bedrock_runtime_client.invoke_model(
                modelId=BEDROCK_MODEL_ID,
                contentType="application/json",
                accept="application/json",
                body=json.dumps({
                    "prompt": prompt,
                    "max_tokens_to_sample": 100,
                    "temperature": 0.1,
                })
            )
            logger.info("Bedrock invocation successful.")

            response_body = json.loads(bedrock_response['body'].read())
            classification = response_body['completion'].strip().lower()

            logger.info(f"Document {object_key} classified as: {classification}")

            # Invoke Extractor Lambda
            if EXTRACTOR_LAMBDA_ARN:
                payload = {
                    "bucket_name": bucket_name,
                    "object_key": object_key,
                    "document_type": classification,
                    "document_content": document_content # Pass extracted content
                }
                lambda_client.invoke(
                    FunctionName=EXTRACTOR_LAMBDA_ARN,
                    InvocationType='Event',  # Asynchronous invocation
                    Payload=json.dumps(payload)
                )
                logger.info(f"Invoked Extractor Lambda for {object_key}")
            else:
                logger.warning("EXTRACTOR_LAMBDA_ARN not set. Skipping Extractor Lambda invocation.")

        except Exception as e:
            logger.error(f"Error processing document {object_key}: {e}", exc_info=True) # Log full traceback
            raise e

    return {
        'statusCode': 200,
        'body': json.dumps('Document classification initiated!')
    }