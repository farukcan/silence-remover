FROM python:3.11-slim-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY packages/silence_core /app/packages/silence_core
COPY apps/worker/requirements.txt /app/apps/worker/requirements.txt

RUN pip install --no-cache-dir -U pip \
  && pip install --no-cache-dir /app/packages/silence_core \
  && pip install --no-cache-dir -r /app/apps/worker/requirements.txt

COPY apps/worker/worker.py /app/apps/worker/worker.py

WORKDIR /app/apps/worker
ENV PYTHONUNBUFFERED=1
CMD ["python", "worker.py"]
