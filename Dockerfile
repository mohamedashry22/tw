# Use the official Node.js image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Install dependencies required to build native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Clean up any existing node_modules and cache
RUN rm -rf node_modules
RUN npm cache clean --force

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Create data directory and set permissions
RUN mkdir -p /data && chown -R node:node /data /usr/src/app

# Switch to a non-root user for better security
USER node

# Set environment variables
ENV DATABASE_URL=sqlite:/data/database.sqlite

# Expose the application port
EXPOSE 5000

# Add an entrypoint script to ensure proper permissions
CMD ["sh", "-c", "mkdir -p /data && npm start"]