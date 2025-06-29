import json
import cfnresponse
import psycopg2
import boto3
import os

def handler(event, context):
    if event['RequestType'] == 'Delete':
        cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
        return

    try:
        db_secret_arn = os.environ['DB_SECRET_ARN']
        db_cluster_endpoint = os.environ['DB_CLUSTER_ENDPOINT']

        # Retrieve credentials from Secrets Manager
        secrets_client = boto3.client('secretsmanager')
        secret_response = secrets_client.get_secret_value(SecretId=db_secret_arn)
        credentials = json.loads(secret_response['SecretString'])

        conn = psycopg2.connect(
            host=db_cluster_endpoint,
            port=5432,
            user=credentials['username'],
            password=credentials['password'],
            database=credentials['dbname']
        )
        cursor = conn.cursor()
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.commit()
        cursor.close()
        conn.close()
        cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
    except Exception as e:
        print(f"Error enabling pgvector: {e}")
        cfnresponse.send(event, context, cfnresponse.FAILED, {})
