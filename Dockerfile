# Site sujeedesign.com : application FastAPI (pages publiques + back office).
FROM node:22.12.0-alpine AS editor-assets
WORKDIR /build/sujee_editor/editor/frontend
COPY sujee_editor/editor/frontend/package.json sujee_editor/editor/frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY sujee_editor/editor/frontend/ ./
RUN npm run build

FROM python:3.13-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SITE_DATA=/data \
    PORT=8080

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY theme ./theme
COPY seed ./seed
# Le paquet de l'éditeur est importé par l'application : sans lui, le conteneur
# meurt à l'import (`ModuleNotFoundError: No module named 'sujee_editor'`).
COPY sujee_editor ./sujee_editor
COPY --from=editor-assets /build/sujee_editor/editor/static/visual/ ./sujee_editor/editor/static/visual/
# Valeurs par défaut du contenu éditorial : le back office les sert à l'API
# `/api/v1/content/{slug}` et le build Next les récupère. Sans ce fichier,
# l'API répond 500 (FileNotFoundError) dans le conteneur.
COPY web/content/home.default.json ./web/content/home.default.json

RUN mkdir -p /data && useradd --system --uid 10001 --home /app site \
 && chown -R site:site /app /data
USER site

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*' --log-level warning"]
