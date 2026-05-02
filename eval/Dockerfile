# === Build Stage ===
FROM python:3.13.13-slim-bookworm AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11.8 /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src/ src/
RUN uv sync --frozen --no-dev


# === Runtime Stage ===
FROM python:3.13.13-slim-bookworm

RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1000 eval \
    && useradd --uid 1000 --gid eval --shell /bin/bash --create-home eval

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src

ENV PATH="/app/.venv/bin:$PATH"

USER eval

EXPOSE 8090

STOPSIGNAL SIGINT

CMD ["uvicorn", "eval.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8090"]
