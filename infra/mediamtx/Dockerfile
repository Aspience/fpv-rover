# syntax=docker/dockerfile:1

ARG MEDIAMTX_VERSION=v1.19.1
ARG MEDIAMTX_RPICAMERA_VERSION=v2.6.0
ARG ARDUCAM_LIBCAMERA_VERSION=0.5.2+rpt20250909-1
ARG ARDUCAM_LIBCAMERA_RELEASE=libcamera-v0.0.5

#################################################################
# Stage 1: Build mtxrpicam helper against Arducam libcamera
#################################################################
FROM --platform=linux/arm64 debian:bookworm-slim AS rpicamera-builder

ARG MEDIAMTX_RPICAMERA_VERSION
ARG ARDUCAM_LIBCAMERA_VERSION
ARG ARDUCAM_LIBCAMERA_RELEASE

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    gnupg \
    wget \
    && wget -qO- https://archive.raspberrypi.com/debian/raspberrypi.gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/raspberrypi-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/raspberrypi-archive-keyring.gpg] http://archive.raspberrypi.com/debian/ bookworm main" \
    > /etc/apt/sources.list.d/raspi.list \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    xxd \
    git \
    cmake \
    meson \
    ninja-build \
    pkg-config \
    python3-jinja2 \
    python3-yaml \
    python3-ply \
    libpisp-dev \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    base="https://github.com/ArduCAM/Arducam-Pivariety-V4L2-Driver/releases/download/${ARDUCAM_LIBCAMERA_RELEASE}"; \
    ver="${ARDUCAM_LIBCAMERA_VERSION}"; \
    wget -q "${base}/libcamera0.5_${ver}_arm64.deb"; \
    wget -q "${base}/libcamera-dev_${ver}_arm64.deb"; \
    wget -q "${base}/libcamera-ipa_${ver}_arm64.deb"; \
    apt-get update; \
    apt-get install -y --no-install-recommends ./libcamera0.5_${ver}_arm64.deb ./libcamera-ipa_${ver}_arm64.deb ./libcamera-dev_${ver}_arm64.deb; \
    rm -f ./*.deb; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git clone --depth 1 --branch "${MEDIAMTX_RPICAMERA_VERSION}" \
    https://github.com/bluenviron/mediamtx-rpicamera.git .

RUN meson setup --wrap-mode=default build \
    && DESTDIR=./prefix ninja -C build install

#################################################################
# Stage 2: Build MediaMTX with custom mtxrpicam embedded
#################################################################
FROM golang:1.26-bookworm AS mediamtx-builder

ARG MEDIAMTX_VERSION

RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git clone --depth 1 --branch "${MEDIAMTX_VERSION}" \
    https://github.com/bluenviron/mediamtx.git .

RUN go generate ./...

COPY --from=rpicamera-builder /src/build/mtxrpicam_64 ./internal/staticsources/rpicamera/mtxrpicam_64

RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o /mediamtx .

#################################################################
# Stage 3: Minimal runtime with Arducam libcamera libraries
#################################################################
FROM --platform=linux/arm64 debian:bookworm-slim AS runtime

ARG ARDUCAM_LIBCAMERA_VERSION
ARG ARDUCAM_LIBCAMERA_RELEASE

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    gnupg \
    wget \
    && wget -qO- https://archive.raspberrypi.com/debian/raspberrypi.gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/raspberrypi-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/raspberrypi-archive-keyring.gpg] http://archive.raspberrypi.com/debian/ bookworm main" \
    > /etc/apt/sources.list.d/raspi.list \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpisp0.0.1 \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    base="https://github.com/ArduCAM/Arducam-Pivariety-V4L2-Driver/releases/download/${ARDUCAM_LIBCAMERA_RELEASE}"; \
    ver="${ARDUCAM_LIBCAMERA_VERSION}"; \
    wget -q "${base}/libcamera0.5_${ver}_arm64.deb"; \
    wget -q "${base}/libcamera-ipa_${ver}_arm64.deb"; \
    apt-get update; \
    apt-get install -y --no-install-recommends ./libcamera0.5_${ver}_arm64.deb ./libcamera-ipa_${ver}_arm64.deb; \
    rm -f ./*.deb; \
    rm -rf /var/lib/apt/lists/*

COPY --from=mediamtx-builder /mediamtx /mediamtx

ENTRYPOINT ["/mediamtx"]
