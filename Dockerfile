FROM node:20-slim

WORKDIR /usr/src/app

# Install dependencies required to build native modules
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy application code, including package.json and preinstalled node_modules
COPY . .

# Switch to non-root user
USER node

# Set Render flag and enable Node.js logging
ENV RENDER=true
ENV NODE_ENV=production
ENV DEBUG="*"

EXPOSE 5000

# Start the application
CMD ["npm", "start"]