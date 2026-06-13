FROM python:3.14.5-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    i2c-tools \
    v4l-utils \
    docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev

COPY . .

ENV PYTHONPATH=/app

CMD ["uv", "run", "fpv-rover"]
