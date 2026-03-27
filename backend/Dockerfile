FROM python:3.11-slim

WORKDIR /app

# System Dependencies
RUN apt-get update && apt-get install -y \
    libpng-dev libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# Python Dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Code
COPY *.py ./

# Non-root User
RUN useradd -m appuser
USER appuser

# Port
ENV PORT=8080
EXPOSE 8080

# Start
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]