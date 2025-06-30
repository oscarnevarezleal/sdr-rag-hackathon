# 📂 Smart Document Router (SDR)

## 📝 Problem Statement

Businesses receive numerous documents (invoices, receipts, contracts) requiring manual classification and routing. This process is costly, error-prone, and inefficient.

## 🚀 Solution

A fully automated, serverless pipeline leveraging AWS Lambda and Amazon Bedrock to classify, extract, and route documents efficiently.

## ⚙️ Architecture Overview

```
[User Document Upload → Lambda: UploadHandler (Function URL)]
        ↓
[S3 Incoming Bucket (ObjectCreated Event)]
        ↓
[Lambda: DocumentClassifier]
  └─ Amazon Bedrock Classification
        ↓
[Lambda: DocumentDataExtractor]
  └─ Extract Data (Bedrock/Textract)
        ↓
[Lambda: EmbeddingGenerator]
  └─ Generate Embeddings (Bedrock Titan)
        ↓
[PostgreSQL (pgvector)]
  └─ Store Document Embeddings
        ↓
[Lambda: DocumentRouter]
 ├─ Store Metadata (DynamoDB)
 ├─ Move File (S3 Organized Folder)
 └─ Send Notifications (SNS/SES)

[User Query → API Gateway + Lambda: ChatQueryHandler]
  ├─ Generate Query Embedding (Bedrock Titan)
  ├─ Query PostgreSQL for similar document chunks
  ├─ Construct Prompt with relevant chunks
  └─ Generate Answer (Bedrock)
```

## 🔧 Lambda Functions Explained

| Lambda Function   | Responsibility                                  |
| ----------------- | ----------------------------------------------- |
| **UploadHandler** | Handles document uploads via a Function URL and stores them in the incoming S3 bucket. |

| **DocumentClassifier**    | Classifies document type using Amazon Bedrock.        |
| ------------------------- | ----------------------------------------------------- |
| **DocumentDataExtractor** | Extracts structured data from documents.              |
| **EmbeddingGenerator**    | Generates vector embeddings from document text and stores them in PostgreSQL. |
| **DocumentRouter**        | Routes files, logs metadata, and sends notifications. |
| **ChatQueryHandler**      | Handles user queries, retrieves relevant document chunks, and generates answers. |

## 🧠 Bedrock Prompt Examples

### Classification

```
Document types: ["invoice", "receipt", "contract", "report", "other"]
Classify this document clearly into one type:

Document Content:
<<DOCUMENT_TEXT>>
```

### Extraction

```
Extract fields: ["vendor_name", "invoice_number", "total_amount", "due_date"] from the document below as structured JSON.

Document:
<<DOCUMENT_TEXT>>
```

## 🚀 Deployment

This project is deployed using the AWS CDK. The following steps outline the deployment process:

### 1. Prerequisites

*   Node.js and npm installed
*   AWS CLI configured with your credentials
*   AWS CDK installed (`npm install -g aws-cdk`)

### 2. Install Dependencies

Navigate to the `cdk` directory and install the required npm packages:

```bash
cd cdk
npm install
```

### 3. Deploy the Stacks

The CDK application is divided into multiple stacks. Deploy them in the following order:

```bash
cdk deploy SdrBucketsStack
cdk deploy SdrDatabaseStack
cdk deploy SdrPostgresStack
cdk deploy SdrChatStack
cdk deploy SdrLambdasStack
```

### 4. Enable pgvector Extension

After deploying the `SdrPostgresStack`, you need to manually enable the `pgvector` extension in the PostgreSQL database. A Makefile command is provided for this purpose:

```bash
make enable-pgvector
```

This command invokes a Lambda function that connects to the database and executes the necessary SQL command.

## ⬆️ Document Upload

Documents can be uploaded to the system via the `UploadHandler` Lambda's Function URL. This URL is exposed as a CloudFormation output.

**Upload Command Example (using `curl`):**

```bash
curl -X POST -H "x-file-name: your_document_name.pdf" --data-binary "@./path/to/your_document.pdf" <YOUR_UPLOAD_FUNCTION_URL>/upload
```

Replace `<YOUR_UPLOAD_FUNCTION_URL>` with the actual URL from your CloudFormation stack outputs (e.g., `aws cloudformation describe-stacks --stack-name SdrLambdasStack --query 'Stacks[0].Outputs[?OutputKey==`UploadUrl`].OutputValue' --output text`).

## 🧪 Testing with Make

To simplify testing, a `Makefile` is provided with the following commands:

*   `make enable-pgvector`: Manually invokes the Lambda function to enable the `pgvector` extension in your PostgreSQL database. This needs to be run once after the `SdrPostgresStack` is deployed.

*   `make test`: Uploads a sample document, waits for processing, and then queries the chat API with a predefined question. You can override the default `UPLOAD_FILE` and `CHAT_QUERY` variables.

    ```bash
    make test UPLOAD_FILE=data/CompanyDocuments/invoices/invoice_10249.pdf CHAT_QUERY="What is the total amount of the invoice?"
    ```

*   `make chat`: Directly queries the chat API with a predefined or overridden question. Useful for quick iterations on chat prompts.

    ```bash
    make chat CHAT_QUERY="What is the order ID for the invoice from Karin Josephs?"
    ```

## 💬 Chat with your PDF

After a document has been uploaded and processed (which includes embedding generation), you can chat with it using the exposed API Gateway endpoint.

**Chat Command Example (using `curl`):**

```bash
curl -X POST -H "Content-Type: application/json" -d '{"query": "What is the total amount of invoice INV-2321?"}' <YOUR_CHAT_API_URL>/chat
```

Replace `<YOUR_CHAT_API_URL>` with the actual URL from your CloudFormation stack outputs (e.g., `aws cloudformation describe-stacks --stack-name SdrChatStack --query 'Stacks[0].Outputs[?OutputKey==`ChatApiUrl`].OutputValue' --output text`).

## 📦 Example Data Flow JSON

```json
{
  "document_type": "invoice",
  "fields": {
    "vendor_name": "ACME Corp.",
    "invoice_number": "INV-2321",
    "total_amount": "USD 1,245.00",
    "due_date": "2025-07-20"
  },
  "original_s3_path": "uploads/incoming/doc123.pdf",
  "routed_s3_path": "organized/invoices/doc123.pdf",
  "timestamp": "2025-06-28T12:00:00Z"
}
```

## 🔔 Notifications and Routing

**S3 Folder Structure:**

```
s3://company-documents/
├── organized/
│   ├── invoices/
│   ├── contracts/
│   ├── receipts/
│   └── other/
└── uploads/
    └── incoming/
```

**Notifications:**

- Email to Accounting for invoices
- Email to Legal for contracts

## 🛠️ Implementation Roadmap

### Step 1: AWS Resources Setup

- S3 buckets for documents
- DynamoDB table for metadata
- SNS/SES for alerts

### Step 2: Lambda Development

- Develop classification, extraction, and routing Lambdas

### Step 3: Integration and Testing

- Validate classification and extraction accuracy
- Ensure correct routing and alerts

### Step 4: Monitoring

- Set up CloudWatch alarms
- Automate periodic summaries

## 🔐 Security Best Practices

- Minimal IAM permissions
- Encryption at rest/in-transit
- Audit trails (CloudTrail, DynamoDB logs)

## 💰 Cost Estimation (Monthly \~5,000 documents)

| Service                | Estimated Monthly Cost |
| ---------------------- | ---------------------- |
| Lambda                 | \$1.00                 |
| S3 Storage/Requests    | \$2.00                 |
| Bedrock (Claude/Titan) | \$25.00                |
| DynamoDB               | \$1.00                 |
| SNS/SES Notifications  | \$1.00                 |
| **Total**              | **\~\$30/month**       |

## 🧪 Future Enhancements

- Real-time analytics dashboard
- AI-generated periodic summaries
- Human feedback loop for improved accuracy

## 🎥 Demo Submission Outline

### GitHub Repository Structure

```
smart-document-router/
├── README.md
├── lambda/
│   ├── classifier/
│   ├── extractor/
│   └── router/
├── tests/
```

---

🎯 **Next Steps**

- Implement initial Lambdas
- Develop comprehensive tests
- Fine-tune Bedrock prompts for maximum accuracy

# sdr-rag-hackathon
