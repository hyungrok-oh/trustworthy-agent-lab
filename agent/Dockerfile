# === Build Stage ===
# Install dependencies in a separate stage so build tools
# don't end up in the final image (smaller + safer)
FROM python:3.13.13-slim-bookworm AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11.8 /uv /uvx /bin/

WORKDIR /app

# Install dependencies first (Docker cache layer)
# Changes to source code won't bust this cache
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy source and install the project
COPY src/ src/
RUN uv sync --frozen --no-dev


# === Runtime Stage ===
# Fresh slim image — no build tools, no cache, minimal attack surface
FROM python:3.13.13-slim-bookworm

# Security: apply latest patches
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Security: non-root user
RUN groupadd --gid 1000 agent \
    && useradd --uid 1000 --gid agent --shell /bin/bash --create-home agent

WORKDIR /app

# Copy only the virtual environment from builder (no build tools)
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src

# Ensure venv binaries are on PATH
ENV PATH="/app/.venv/bin:$PATH"

# Switch to non-root user
USER agent

EXPOSE 8081

# Graceful shutdown: uvicorn catches SIGINT and shuts down cleanly
STOPSIGNAL SIGINT

CMD ["uvicorn", "agent.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8081"]
