FROM public.ecr.aws/lambda/python:3.12

COPY app.py requirements.txt /var/task/

RUN pip install -r requirements.txt

CMD ["app.lambda_handler"]
