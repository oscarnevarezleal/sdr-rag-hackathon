AWS_PROFILE ?= default
UPLOAD_FILE ?= data/CompanyDocuments/invoices/invoice_10249.pdf
CHAT_QUERY ?= What is the order ID for the invoice from Karin Josephs?

.PHONY: test enable-pgvector chat

enable-pgvector:
	@echo "Fetching PgVectorEnablerLambdaArn..."
	$(eval PGVECTOR_ENABLER_LAMBDA_ARN := $(shell aws cloudformation describe-stacks --stack-name SdrPostgresStack --query 'Stacks[0].Outputs[?OutputKey==`PgVectorEnablerLambdaArn`].OutputValue' --output text --profile $(AWS_PROFILE)))

	@if [ -z "$(PGVECTOR_ENABLER_LAMBDA_ARN)" ]; then echo "Error: PgVectorEnablerLambdaArn not found. Ensure SdrPostgresStack is deployed."; exit 1; fi

	@echo "Invoking PgVectorEnablerLambda ($(PGVECTOR_ENABLER_LAMBDA_ARN))..."
	@aws lambda invoke --function-name $(PGVECTOR_ENABLER_LAMBDA_ARN) --payload '{}' response.json --profile $(AWS_PROFILE)
	@echo "PgVectorEnablerLambda invocation complete. Check response.json for details."


test:
	@echo "Fetching CloudFormation outputs..."
	$(eval UPLOAD_URL := $(shell aws cloudformation describe-stacks --stack-name SdrLambdasStack --query 'Stacks[0].Outputs[?OutputKey==`UploadUrl`].OutputValue' --output text --profile $(AWS_PROFILE)))
	$(eval CHAT_API_URL := $(shell aws cloudformation describe-stacks --stack-name SdrChatStack --query 'Stacks[0].Outputs[?OutputKey==`ChatApiUrl`].OutputValue' --output text --profile $(AWS_PROFILE)))

	@echo "UPLOAD_URL: $(UPLOAD_URL)"
	@echo "CHAT_API_URL: $(CHAT_API_URL)"

	@if [ -z "$(UPLOAD_URL)" ]; then echo "Error: UploadUrl not found. Ensure SdrLambdasStack is deployed."; exit 1; fi
	@if [ -z "$(CHAT_API_URL)" ]; then echo "Error: ChatApiUrl not found. Ensure SdrChatStack is deployed."; exit 1; fi

	@echo "Uploading $(UPLOAD_FILE) to $(UPLOAD_URL)upload..."
	@curl -X POST -H "x-file-name: $(notdir $(UPLOAD_FILE))" --data-binary "@$(UPLOAD_FILE)" $(UPLOAD_URL)upload

	@echo "Waiting for document processing (10 seconds)..."
	@sleep 10

	@echo "Querying chat API at $(CHAT_API_URL)chat with prompt: \"$(CHAT_QUERY)\""
	@curl -X POST -H "Content-Type: application/json" -d '{"query": "$(subst ",\",$(CHAT_QUERY))"}' $(CHAT_API_URL)chat

upload:

	$(eval UPLOAD_URL := $(shell aws cloudformation describe-stacks --stack-name SdrLambdasStack --query 'Stacks[0].Outputs[?OutputKey==`UploadUrl`].OutputValue' --output text --profile $(AWS_PROFILE)))
	
	@echo "Uploading $(UPLOAD_FILE) to $(UPLOAD_URL)upload..."
	@curl -X POST -H "x-file-name: $(notdir $(UPLOAD_FILE))" --data-binary "@$(UPLOAD_FILE)" $(UPLOAD_URL)upload

	@echo "Waiting for document processing (10 seconds)..."
	@sleep 10

chat:
	$(eval CHAT_API_URL := $(shell aws cloudformation describe-stacks --stack-name SdrChatStack --query 'Stacks[0].Outputs[?OutputKey==`ChatApiUrl`].OutputValue' --output text --profile $(AWS_PROFILE)))

	@if [ -z "$(CHAT_API_URL)" ]; then \
		echo "Error: ChatApiUrl not found. Ensure SdrChatStack is deployed."; \
		exit 1; \
	fi

	@curl -X POST -H "Content-Type: application/json" \
		-d '{"query": "$(subst ",\",$(CHAT_QUERY))"}' \
		$(CHAT_API_URL)/chat

.PHONY: clean
clean:
	@echo "Cleaning up generated files..."
	@rm -f response.json