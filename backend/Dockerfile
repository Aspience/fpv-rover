FROM python:3.14.5-slim

WORKDIR /app

ARG DOCKER_VERSION=28.0.4
ARG COMPOSE_VERSION=2.34.0

# Docker CLI + compose plugin only (daemon runs on host via /var/run/docker.sock).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    i2c-tools \
    v4l-utils \
    && ARCH="$(dpkg --print-architecture)" \
    && case "${ARCH}" in \
         amd64) DOCKER_ARCH=x86_64; COMPOSE_ARCH=x86_64 ;; \
         arm64) DOCKER_ARCH=aarch64; COMPOSE_ARCH=aarch64 ;; \
         *) echo "unsupported architecture: ${ARCH}" >&2; exit 1 ;; \
       esac \
    && curl -fsSL "https://download.docker.com/linux/static/stable/${DOCKER_ARCH}/docker-${DOCKER_VERSION}.tgz" \
    | tar -xz -C /tmp \
    && mv /tmp/docker/docker /usr/local/bin/docker \
    && rm -rf /tmp/docker \
    && mkdir -p /usr/local/lib/docker/cli-plugins \
    && curl -fsSL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}" \
         -o /usr/local/lib/docker/cli-plugins/docker-compose \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev

COPY . .

ENV PYTHONPATH=/app

CMD ["uv", "run", "fpv-rover"]
