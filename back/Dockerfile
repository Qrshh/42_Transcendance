# Backend Dockerfile
FROM node:20-bookworm

WORKDIR /app

# Copier les fichiers de dependances
COPY package*.json ./

# Installer les dependances backend
# Installer les dependances backend (explicites)
RUN npm install fastify fastify-plugin @fastify/cors sqlite3 axios @fastify/static @fastify/multipart prom-client qrcode jsonwebtoken speakeasy dotenv socket.io

# Copier le code source
COPY . .

# Ecouter sur le port 3000
EXPOSE 3000

# Commande par defaut execute quand le conteneur demarre
CMD ["node", "server.js"]
