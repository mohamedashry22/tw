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

# Create data directory and set permissions as root
RUN mkdir -p /data && \
    chown -R node:node /data && \
    chmod 777 /data && \
    chown -R node:node /usr/src/app

# Switch to non-root user
USER node

# Set Render flag and enable Node.js logging
ENV RENDER=true
ENV NODE_ENV=production
ENV DEBUG="*"

EXPOSE 5000

# Start the application
CMD ["npm", "start"]