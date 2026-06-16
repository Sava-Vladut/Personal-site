# Build context is the grim-site/ root so we can copy both the server and the
# converter scripts it wraps (src/services/*).
FROM python:3.12-slim

# ffmpeg + ffprobe are required for MP3 transcoding and TikTok MP4 merging.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

COPY server ./server
COPY src/services ./src/services

EXPOSE 8000

# --app-dir puts server/ on sys.path so "app:app" resolves to server/app.py,
# while app.py still locates ../src/services via its own __file__.
CMD ["python", "-m", "uvicorn", "app:app", "--app-dir", "server", "--host", "0.0.0.0", "--port", "8000"]
