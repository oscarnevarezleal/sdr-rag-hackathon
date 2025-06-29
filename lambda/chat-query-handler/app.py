

import json
import boto3
import os
import psycopg2

secretsmanager = boto3.client('secretsmanager')
bedrock = boto3.client('bedrock-runtime', region_name='us-west-2') # Explicitly set region

def get_db_credentials():
    secret_arn = os.environ['DB_SECRET_ARN']
    response = secretsmanager.get_secret_value(SecretId=secret_arn)
    return json.loads(response['SecretString'])

def get_db_connection(credentials):
    return psycopg2.connect(
        host=os.environ['DB_CLUSTER_ENDPOINT'],
        port=5432,
        user=credentials['username'],
        password=credentials['password'],
        database=credentials['dbname']
    )

def generate_embedding(text):
    response = bedrock.invoke_model(
        modelId='amazon.titan-embed-text-v1',
        body=json.dumps({'inputText': text})
    )
    response_body = json.loads(response['body'].read())
    return response_body['embedding']

def handler(event, context):
    # This is a test comment to force redeployment.
    credentials = get_db_credentials()
    conn = get_db_connection(credentials)

    body = json.loads(event['body'])
    query = body['query']

    query_embedding = generate_embedding(query)

    with conn.cursor() as cur:
        cur.execute("""
        SELECT chunk_text
        FROM document_embeddings
        ORDER BY embedding <-> %s
        LIMIT 5;
        """, (query_embedding,))
        results = [row[0] for row in cur.fetchall()]

    context = "\n".join(results)

    prompt = f"""Human: You are a helpful assistant. Please answer the following question based on the provided context.\n\nContext:\n{context}\n\nQuestion: {query}\n\nAssistant:"""

    response = bedrock.invoke_model(
        modelId=os.environ['BEDROCK_MODEL_ID'],
        body=json.dumps({
            "prompt": prompt,
            "max_tokens_to_sample": 500
        })
    )

    response_body = json.loads(response['body'].read())

    return {
        'statusCode': 200,
        'body': json.dumps({'response': response_body['completion']})
    }

