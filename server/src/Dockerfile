FROM python:3.11-slim

# logs show up in Cloud Run right away, and no debugger or reloader
ENV PYTHONUNBUFFERED=1 \
    DEBUG=0

WORKDIR /app
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
