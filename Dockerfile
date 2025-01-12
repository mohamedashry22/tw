FROM node:20-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3

COPY package*.json ./

RUN rm -rf node_modules

RUN npm cache clean --force
RUN npm uninstall sqlite3

RUN npm install

RUN npm install sqlite3 --build-from-source

COPY . .

EXPOSE 5000

CMD ["npm", "start"]