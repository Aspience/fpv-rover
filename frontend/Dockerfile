FROM node:24-alpine AS build

WORKDIR /app
COPY package*.json ./
COPY package.json package-lock.json* ./
RUN npm ci --foreground-scripts --verbose

COPY . ./

ARG VITE_RPI_HOST
ARG VITE_API_PORT
ARG VITE_WEBRTC_PORT
ENV VITE_RPI_HOST=$VITE_RPI_HOST \
    VITE_API_PORT=$VITE_API_PORT \
    VITE_WEBRTC_PORT=$VITE_WEBRTC_PORT

RUN env

RUN npm run build

FROM caddy:2-alpine
RUN adduser www-data -G www-data -u 33 -D -H
RUN chown -R www-data:www-data /config
RUN chown -R www-data:www-data /data
RUN echo ":80 {" > /etc/caddy/Caddyfile && \
  echo "  root * /srv" >> /etc/caddy/Caddyfile && \
  echo "  encode gzip zstd" >> /etc/caddy/Caddyfile && \
  echo "" >> /etc/caddy/Caddyfile && \
  echo "  @assets {" >> /etc/caddy/Caddyfile && \
  echo "    path *.js *.css *.woff *.woff2" >> /etc/caddy/Caddyfile && \
  echo "  }" >> /etc/caddy/Caddyfile && \
  echo "  header @assets Cache-Control \"public, max-age=31536000, immutable\"" >> /etc/caddy/Caddyfile && \
  echo "" >> /etc/caddy/Caddyfile && \
  echo "  route {" >> /etc/caddy/Caddyfile && \
  echo "    try_files {path} /index.html" >> /etc/caddy/Caddyfile && \
  echo "    header /index.html Cache-Control \"no-cache, no-store, must-revalidate\"" >> /etc/caddy/Caddyfile && \
  echo "    file_server" >> /etc/caddy/Caddyfile && \
  echo "  }" >> /etc/caddy/Caddyfile && \
  echo "" >> /etc/caddy/Caddyfile && \
  echo "  log" >> /etc/caddy/Caddyfile && \
  echo "}" >> /etc/caddy/Caddyfile

COPY --from=build /app/dist /srv

USER www-data
