FROM node:20-slim

WORKDIR /usr/src/app

# Install dependencies required to build native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Create a script to handle data directory setup
RUN echo '#!/bin/sh\n\
if [ ! -d "/data" ]; then\n\
    echo "Data directory does not exist. Creating..."\n\
    mkdir -p /data\n\
    echo "Setting permissions for /data directory..."\n\
    chmod 777 /data\n\
    chown node:node /data\n\
else\n\
    echo "Data directory already exists. Checking permissions..."\n\
    # Ensure permissions are correct even if directory exists\n\
    chmod 777 /data\n\
    chown node:node /data\n\
fi\n\
\n\
echo "Starting application..."\n\
exec npm start' > /usr/src/app/docker-entrypoint.sh && \
chmod +x /usr/src/app/docker-entrypoint.sh

# Switch to non-root user
USER node

# Set Render flag and enable Node.js logging
ENV RENDER=true
ENV NODE_ENV=production
ENV NODE_OPTIONS="--trace-warnings"
ENV DEBUG="*"

EXPOSE 5000

# Use the entrypoint script
CMD ["/usr/src/app/docker-entrypoint.sh"]