import json
import logging
import os
import boto3
import re

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client("s3")
bedrock_runtime_client = boto3.client("bedrock-runtime")
lambda_client = boto3.client("lambda")

# Environment variables
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-instant-v1")
ROUTER_LAMBDA_ARN = os.environ.get("ROUTER_LAMBDA_ARN")
EMBEDDING_GENERATOR_LAMBDA_ARN = os.environ.get("EMBEDDING_GENERATOR_LAMBDA_ARN")

# Define extraction fields per document type
FIELDS_BY_TYPE = {
    "waybill": [
        "waybill_document_number",
        "waybill_document_number_2",
        "waybill_document_number_3",
        "alphanumeric_code",
        "alphanumeric_code_2",
        "alphanumeric_code_3",
        "origen_address",
        "origen_city",
        "origen_state",
        "origen_zip",
        "origen_country",
        "origen_phone",
        "origen_email",
        "ship_name",
        "ship_address",
        "ship_city",
        "ship_state",
        "ship_zip",
        "ship_country",
        "ship_phone",
        "ship_email",
        "total_amount",
        "creation_date",
        "total_weight",
        "total_volume",
        "total_quantity",
        "total_items",
        "total_packages",
        "type_of_journey",
        "type_of_vehicle",
        "type_of_transport",
        "type_of_goods",
        "type_of_goods_description",
        "type_of_goods_quantity",
        "type_of_goods_weight",
        "vat_number",
        "invoice_number",
        "invoice_date",
        "invoice_amount",
        "invoice_currency",
        "invoice_status",
        "invoice_type",
    ],
    "invoice": [
        "order_id",
        "customer_id",
        "customer_name",
        "total_amount",
        "order_date",
    ],
    "shipping_order": [
        "order_id",
        "customer_id",
        "ship_name",
        "ship_address",
        "total_amount",
        "order_date",
    ],
    "purchase_order": ["order_id", "customer_name", "total_amount", "order_date"],
    "receipt": ["vendor_name", "transaction_date", "total_amount", "payment_method"],
    "report": ["report_title", "report_date", "author", "summary"],
}


def lambda_handler(event, context):
    bucket_name = event["bucket_name"]
    object_key = event["object_key"]
    document_type = event.get("document_type", "unknown").lower()
    document_content = event.get("document_content", "")

    logger.info(
        f"Extracting data from document {object_key} (Type: {document_type}) from bucket {bucket_name}"
    )

    try:
        logger.info(
            f"Document content received (first 100 chars): {document_content[:100]}..."
        )

        # Use fields by document_type or fallback to default
        fields_to_extract = FIELDS_BY_TYPE.get(
            document_type, ["vendor_name", "document_number", "date", "amount"]
        )

        # Construct dynamic prompt
        prompt = (
            f"Human: You are a strict JSON API. Do not include explanations, comments, or markdown.\n\n"
            f"Extract the following fields from the document and return a valid, parsable JSON object with keys for each of the following fields (even if the value is null): `{fields_to_extract}`.\n\n"
            f"Respond with ONLY a JSON object and nothing else.\n\n"
            "Your response **must start with** '{' and end with '}'. Do not include triple backticks or markdown syntax.\n\n"
            f"Document:\n ```text\n{document_content}\n```\nAssistant:"
        )
        logger.info(f"Extraction prompt prepared: {prompt[:100]}...")

        # Call Bedrock
        bedrock_response = bedrock_runtime_client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(
                {
                    "prompt": prompt,
                    "max_tokens_to_sample": 1000,
                    "temperature": 0.0,
                }
            ),
        )
        logger.info("Bedrock extraction invocation successful.")

        response_body = json.loads(bedrock_response["body"].read())
        bedrock_completion = response_body["completion"].strip()
        logger.info(f"Bedrock raw completion: {bedrock_completion}")

        # Extract JSON from completion
        json_match = re.search(r"```json\\n(.*?)```", bedrock_completion, re.DOTALL)
        if json_match:
            json_string = json_match.group(1).strip()
        else:
            json_string = bedrock_completion

        try:
            extracted_data = json.loads(json_string)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON from Bedrock completion: {e}")
            extracted_data = {
                "error": "JSONDecodeError",
                "raw_completion": bedrock_completion,
            }

        logger.info(f"Extracted data for {object_key}: {json.dumps(extracted_data)}")

        # Invoke downstream Lambdas
        if ROUTER_LAMBDA_ARN:
            lambda_client.invoke(
                FunctionName=ROUTER_LAMBDA_ARN,
                InvocationType="Event",
                Payload=json.dumps(
                    {
                        "bucket_name": bucket_name,
                        "object_key": object_key,
                        "document_type": document_type,
                        "extracted_data": extracted_data,
                    }
                ),
            )
            logger.info(f"Invoked Router Lambda for {object_key}")

        if EMBEDDING_GENERATOR_LAMBDA_ARN:
            lambda_client.invoke(
                FunctionName=EMBEDDING_GENERATOR_LAMBDA_ARN,
                InvocationType="Event",
                Payload=json.dumps(
                    {"document_id": object_key, "extracted_text": document_content}
                ),
            )
            logger.info(f"Invoked Embedding Generator Lambda for {object_key}")

    except Exception as e:
        logger.error(
            f"Error extracting data from document {object_key}: {e}", exc_info=True
        )
        raise e

    return {
        "statusCode": 200,
        "body": json.dumps("Document data extraction initiated!"),
    }
