# Stage 1: build — ARG from root .env via docker-compose
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_RPI_HOST
ARG VITE_API_PORT
ARG VITE_WEBRTC_PORT
ENV VITE_RPI_HOST=$VITE_RPI_HOST \
    VITE_API_PORT=$VITE_API_PORT \
    VITE_WEBRTC_PORT=$VITE_WEBRTC_PORT
RUN npm run build

# Stage 2: serve static SPA
FROM caddy:2-alpine
COPY --from=build /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 3000
