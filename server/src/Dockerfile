ARG VARIANT="3.11-bookworm"
FROM mcr.microsoft.com/devcontainers/python:${VARIANT}

WORKDIR /being-between
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

COPY . .

CMD ["python3", "main.py"]
