import json
import boto3
import os
import psycopg2
import uuid
import re

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
        database='sdr'
    )

def generate_embedding(text):
    response = bedrock.invoke_model(
        modelId='amazon.titan-embed-text-v1',
        body=json.dumps({'inputText': text})
    )
    response_body = json.loads(response['body'].read())
    return response_body['embedding']

def extract_identifier(query):
    # Regex to find numbers, could be improved for specific formats
    match = re.search(r'\d+', query)
    return match.group(0) if match else None

def handler(event, context):
    credentials = get_db_credentials()
    conn = get_db_connection(credentials)
    
    body = json.loads(event['body'])
    query = body['query']
    
    conversation_id = (event.get('pathParameters') or {}).get('conversation_id')

    with conn.cursor() as cur:
        if conversation_id:
            # Retrieve conversation history
            cur.execute("SELECT content FROM conversation_messages WHERE conversation_id = %s ORDER BY created_at", (conversation_id,))
            history = [row[0] for row in cur.fetchall()]
            context = "\n".join(history)
        else:
            # Create new conversation
            conversation_id = str(uuid.uuid4())
            cur.execute("INSERT INTO conversations (id) VALUES (%s)", (conversation_id,))
            context = ""

        # Save user message
        cur.execute(
            "INSERT INTO conversation_messages (conversation_id, role, content) VALUES (%s, %s, %s)",
            (conversation_id, 'user', query)
        )

        results = []
        identifier = extract_identifier(query)
        if identifier:
            cur.execute("SELECT chunk_text FROM document_embeddings WHERE chunk_text ILIKE %s", (f'%{identifier}%',))
            results = [row[0] for row in cur.fetchall()]

        if not results:
            query_embedding = generate_embedding(query)
            cur.execute("""
            SELECT chunk_text
            FROM document_embeddings
            ORDER BY embedding <-> %s::vector
            LIMIT 5;
            """, (query_embedding,))
            results = [row[0] for row in cur.fetchall()]

        if not results and identifier:
            completion = f"I couldn't find invoice {identifier}."
        else:
            context += "\n" + "\n".join(results)

            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"You are a helpful assistant. Please answer the following question based on the provided context.\n\nContext:\n{context}\n\nQuestion: {query}"
                        }
                    ]
                }
            ]

            bedrock_request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "messages": messages,
                "max_tokens": 500
            }

            response = bedrock.invoke_model(
                modelId=os.environ['BEDROCK_MODEL_ID'],
                contentType="application/json",
                accept="application/json",
                body=json.dumps(bedrock_request_body)
            )

            response_body = json.loads(response['body'].read())
            
            completion = ""
            for content_block in response_body['content']:
                if content_block['type'] == 'text':
                    completion += content_block['text']

        # Save assistant message
        cur.execute(
            "INSERT INTO conversation_messages (conversation_id, role, content) VALUES (%s, %s, %s)",
            (conversation_id, 'assistant', completion)
        )
        conn.commit()

    return {
        'statusCode': 200,
        'body': json.dumps({'response': completion, 'conversation_id': conversation_id})
    }
