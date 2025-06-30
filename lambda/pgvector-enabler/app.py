import json
import psycopg2
import boto3
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    logger.info(f"Received event: {json.dumps(event)}")
    try:
        db_secret_arn = os.environ['DB_SECRET_ARN']
        db_instance_endpoint = os.environ['DB_INSTANCE_ENDPOINT']
        db_name = os.environ['DB_NAME']

        logger.info("Retrieving DB credentials from Secrets Manager...")
        secrets_client = boto3.client('secretsmanager')
        secret_response = secrets_client.get_secret_value(SecretId=db_secret_arn)
        credentials = json.loads(secret_response['SecretString'])
        logger.info("Successfully retrieved DB credentials.")

        logger.info(f"Connecting to PostgreSQL database: {db_instance_endpoint}/{db_name}...")
        conn = psycopg2.connect(
            host=db_instance_endpoint,
            port=5432,
            user=credentials['username'],
            password=credentials['password'],
            database=db_name
        )
        cursor = conn.cursor()
        logger.info("Executing CREATE EXTENSION IF NOT EXISTS vector;...")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.commit()
        cursor.close()
        conn.close()
        logger.info("Successfully enabled pgvector extension.")

        return {
            'statusCode': 200,
            'body': json.dumps('pgvector extension enabled successfully')
        }
    except Exception as e:
        logger.error(f"Error enabling pgvector extension: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error enabling pgvector extension: {e}')
        }
