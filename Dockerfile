# Back office Sujee Design : FastAPI + SQLite + Jinja2.
#
# Ce service ne sert plus la vitrine (site Next.js déployé séparément) : il
# expose l'administration et l'API de contenu consommée au build par la vitrine.
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

# Tout le nécessaire (gabarits admin, CSS/JS, défauts de contenu) vit dans app/.
COPY app ./app

RUN mkdir -p /data && useradd --system --uid 10001 --home /app site \
 && chown -R site:site /app /data
USER site

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/sante" || exit 1

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*' --log-level warning"]
