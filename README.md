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
[Lambda: DocumentRouter]
 ├─ Store Metadata (DynamoDB)
 ├─ Move File (S3 Organized Folder)
 └─ Send Notifications (SNS/SES)
```

## 🔧 Lambda Functions Explained

| Lambda Function   | Responsibility                                  |
| ----------------- | ----------------------------------------------- |
| **UploadHandler** | Handles document uploads via a Function URL and stores them in the incoming S3 bucket. |

| **DocumentClassifier**    | Classifies document type using Amazon Bedrock.        |
| ------------------------- | ----------------------------------------------------- |
| **DocumentDataExtractor** | Extracts structured data from documents.              |
| **DocumentRouter**        | Routes files, logs metadata, and sends notifications. |

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

## ⬆️ Document Upload

Documents can be uploaded to the system via the `UploadHandler` Lambda's Function URL. This URL is exposed as a CloudFormation output.

**Upload Command Example (using `curl`):**

```bash
curl -X POST -H "x-file-name: your_document_name.pdf" --data-binary "@./path/to/your_document.pdf" <YOUR_UPLOAD_FUNCTION_URL>/upload
```

Replace `<YOUR_UPLOAD_FUNCTION_URL>` with the actual URL from your CloudFormation stack outputs (e.g., `aws cloudformation describe-stacks --stack-name SdrLambdasStack --query 'Stacks[0].Outputs[?OutputKey==`UploadUrl`].OutputValue' --output text`).

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

