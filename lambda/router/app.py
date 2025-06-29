import json
import logging
import os
import boto3
import datetime
import time
import re
from botocore.exceptions import ClientError, NoCredentialsError, ParamValidationError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')
dynamodb_client = boto3.client('dynamodb')
sns_client = boto3.client('sns')
ses_client = boto3.client('ses')

# Environment variables
ROUTED_BUCKET_NAME = os.environ.get("ROUTED_BUCKET_NAME")
DYNAMODB_TABLE_NAME = os.environ.get("DYNAMODB_TABLE_NAME")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN")
ACCOUNTING_EMAIL = os.environ.get("ACCOUNTING_EMAIL")
LEGAL_EMAIL = os.environ.get("LEGAL_EMAIL")

def lambda_handler(event, context):
    logger.info(f"Received event for routing: {json.dumps(event)}")

    bucket_name = event['bucket_name']
    object_key = event['object_key']
    document_type = event['document_type']
    extracted_data = event['extracted_data']

    logger.info(f"Router Lambda received: bucket_name={bucket_name}, object_key={object_key}")

    try:
        # 1. Move file to organized folder in S3
        destination_prefix = f"organized/{document_type}s/"
        new_object_key = destination_prefix + os.path.basename(object_key)

        # Verify object existence before copying
        try:
            s3_client.head_object(Bucket=bucket_name, Key=object_key)
            logger.info(f"Object {object_key} exists in {bucket_name}.")
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                logger.error(f"Object {object_key} not found in {bucket_name} before copy. Error: {e}")
            else:
                logger.error(f"Error checking object {object_key} existence in {bucket_name}: {e}")
            raise e # Re-raise to fail the Lambda

        # Explicitly construct CopySource string
        copy_source_string = f"/{bucket_name}/{object_key}"
        logger.info(f"Attempting to copy from CopySource: {copy_source_string} to {ROUTED_BUCKET_NAME}/{new_object_key}")

        s3_client.copy_object(
            Bucket=ROUTED_BUCKET_NAME,
            CopySource=copy_source_string,
            Key=new_object_key
        )
        # s3_client.delete_object(Bucket=bucket_name, Key=object_key) # Removed delete for debugging
        logger.info(f"Moved {object_key} to {new_object_key}")

        # 2. Store metadata in DynamoDB
        item = {
            'document_id': {'S': context.aws_request_id},
            'document_type': {'S': document_type},
            'original_s3_path': {'S': f"s3://{bucket_name}/{object_key}"},
            'routed_s3_path': {'S': f"s3://{ROUTED_BUCKET_NAME}/{new_object_key}"},
            'timestamp': {'S': datetime.datetime.now().isoformat()},
            'extracted_data': {'S': json.dumps(extracted_data)}
        }
        dynamodb_client.put_item(TableName=DYNAMODB_TABLE_NAME, Item=item)
        logger.info(f"Stored metadata for {object_key} in DynamoDB.")

        # 3. Send notifications
        # Sanitize and truncate subject for SNS
        raw_subject = f"New {document_type.capitalize()} Document Processed: {os.path.basename(object_key)}"
        subject = re.sub(r'[^a-zA-Z0-9 ._\-]', '', raw_subject) # Remove invalid characters
        subject = subject[:100] # Truncate to 100 characters

        message = f"A new {document_type} document has been processed and routed.\n\n"
        message += f"Original Path: s3://{bucket_name}/{object_key}\n"
        message += f"Routed Path: s3://{ROUTED_BUCKET_NAME}/{new_object_key}\n"
        message += f"Extracted Data: {json.dumps(extracted_data, indent=2)}\n"

        if document_type == "invoice" and ACCOUNTING_EMAIL:
            ses_client.send_email(
                Source=ACCOUNTING_EMAIL,
                Destination={'ToAddresses': [ACCOUNTING_EMAIL]},
                Message={'Subject': {'Data': subject},'Body': {'Text': {'Data': message}}}
            )
            logger.info(f"Sent email notification to Accounting for {object_key}")
        elif document_type == "contract" and LEGAL_EMAIL:
            ses_client.send_email(
                Source=LEGAL_EMAIL,
                Destination={'ToAddresses': [LEGAL_EMAIL]},
                Message={'Subject': {'Data': subject},'Body': {'Text': {'Data': message}}}
            )
            logger.info(f"Sent email notification to Legal for {object_key}")
        elif SNS_TOPIC_ARN:
            sns_client.publish(TopicArn=SNS_TOPIC_ARN, Subject=subject, Message=message)
            logger.info(f"Sent SNS notification for {object_key}")

    except Exception as e:
        logger.error(f"Error routing document {object_key}: {e}", exc_info=True)
        raise e

    return {
        'statusCode': 200,
        'body': json.dumps('Document routing initiated!')
    }