# Stage 1: Build dependencies
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt


# Stage 2: Runtime
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# libpq-dev : client Postgres.
# libpango / libharfbuzz / libcairo : dependances natives de WeasyPrint.
# Sans elles, "import weasyprint" leve une OSError que finance/pdf.py et
# treasury/pdf.py rattrapent en desactivant la generation PDF : app
# demarre, mais factures, recus de versement et pieces de caisse ne sont
# plus telechargeables, en silence. Ces paquets ne sont pas optionnels.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .

RUN pip install --no-cache /wheels/*

COPY . /app/
RUN chmod +x /app/entrypoint.sh

# SECRET_KEY only needs to be *set* (not secret) at build time for
# collectstatic to import settings.py; the real value is injected at
# runtime by the deployment platform.
RUN SECRET_KEY=build-time-placeholder python manage.py collectstatic --noinput

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]
