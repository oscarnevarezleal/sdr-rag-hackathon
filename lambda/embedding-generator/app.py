import json
import boto3
import os
import psycopg2
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

secretsmanager = boto3.client('secretsmanager')
bedrock = boto3.client('bedrock-runtime', region_name='us-west-2')

def get_db_credentials():
    logger.info("Attempting to retrieve DB credentials.")
    secret_arn = os.environ['DB_SECRET_ARN']
    try:
        response = secretsmanager.get_secret_value(SecretId=secret_arn)
        credentials = json.loads(response['SecretString'])
        logger.info("Successfully retrieved DB credentials.")
        return credentials
    except Exception as e:
        logger.error(f"Error retrieving DB credentials: {e}")
        raise

def get_db_connection(credentials):
    logger.info("Attempting to connect to the database.")
    try:
        conn = psycopg2.connect(
            host=os.environ['DB_CLUSTER_ENDPOINT'],
            port=5432,
            user=credentials['username'],
            password=credentials['password'],
            database=credentials['dbname']
        )
        logger.info("Successfully connected to the database.")
        return conn
    except Exception as e:
        logger.error(f"Error connecting to the database: {e}")
        raise

def create_table_if_not_exists(conn):
    logger.info("Attempting to create table if not exists.")
    try:
        with conn.cursor() as cur:
            cur.execute("""
            CREATE EXTENSION IF NOT EXISTS vector;
            CREATE TABLE IF NOT EXISTS document_embeddings (
                id SERIAL PRIMARY KEY,
                document_id VARCHAR(255) NOT NULL,
                chunk_text TEXT NOT NULL,
                embedding vector(1024)
            );
            """)
            conn.commit()
        logger.info("Table creation/check completed successfully.")
    except Exception as e:
        logger.error(f"Error creating table: {e}")
        raise
    
    
    
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                system_name TEXT DEFAULT 'SmartDocumentRouter', -- Optional LLM/system role
                topic TEXT,             -- e.g., "ACME April Invoice Audit"
                purpose TEXT,           -- e.g., "invoice QA", "policy review"
                metadata JSONB,         -- e.g., {"document_ids": [...], "tags": ["invoice"]}
                context JSONB,          -- Optional running state (for summarization, etc.)
                status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'archived', 'closed'
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
            """)
            conn.commit()
        logger.info("Table `conversations` creation/check completed successfully.")
    except Exception as e:
        logger.error(f"Error creating table `conversations` : {e}")
        raise

    try:
        with conn.cursor() as cur:
            cur.execute("""
            CREATE TABLE IF NOT EXISTS conversation_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('user', 'system', 'assistant')),
                content TEXT NOT NULL,
                document_refs JSONB,  -- Optional: linked document IDs or extracted fields
                token_count INT,      -- For prompt budget accounting
                embedding VECTOR(1536),  -- pgvector must be enabled
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
            """)
            conn.commit()
        logger.info("Table `conversation_messages` creation/check completed successfully.")
    except Exception as e:
        logger.error(f"Error creating table `conversation_messages` : {e}")
        raise

def chunk_text(text, chunk_size=256, overlap=20):
    tokens = text.split()
    chunks = []
    for i in range(0, len(tokens), chunk_size - overlap):
        chunks.append(" ".join(tokens[i:i + chunk_size]))
    return chunks

def generate_embedding(text):
    logger.info("Attempting to generate embedding.")
    try:
        response = bedrock.invoke_model(
            modelId=os.environ['BEDROCK_MODEL_ID'],
            body=json.dumps({'inputText': text})
        )
        response_body = json.loads(response['body'].read())
        logger.info("Successfully generated embedding.")
        return response_body['embedding']
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise

def handler(event, context):
    logger.info(f"Received event: {json.dumps(event)}")
    try:
        credentials = get_db_credentials()
        conn = get_db_connection(credentials)
        create_table_if_not_exists(conn)

        document_id = event['document_id']
        text = event['extracted_text']

        chunks = chunk_text(text)
        logger.info(f"Generated {len(chunks)} chunks.")

        with conn.cursor() as cur:
            for i, chunk in enumerate(chunks):
                logger.info(f"Processing chunk {i+1}/{len(chunks)} for document {document_id}")
                embedding = generate_embedding(chunk)
                cur.execute(
                    "INSERT INTO document_embeddings (document_id, chunk_text, embedding) VALUES (%s, %s, %s)",
                    (document_id, chunk, embedding)
                )
            conn.commit()
        logger.info(f"Successfully generated and stored {len(chunks)} embeddings for document {document_id}")
        conn.close()

        return {
            'statusCode': 200,
            'body': json.dumps(f'Successfully generated and stored {len(chunks)} embeddings for document {document_id}')
        }
    except Exception as e:
        logger.error(f"Unhandled error in EmbeddingGenerator: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error processing document: {e}')
        }