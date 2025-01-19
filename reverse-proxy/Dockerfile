FROM nginx:latest

COPY nginx.conf /etc/nginx/nginx.conf

RUN apt-get update && apt-get install -y openssl

RUN mkdir -p /etc/ssl/private /etc/ssl/certs && \
    openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout /etc/ssl/private/nginx-selfsigned.key \
    -out /etc/ssl/certs/nginx-selfsigned.crt \
    -subj "/CN=45.32.135.95"