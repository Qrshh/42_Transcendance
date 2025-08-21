# Backend Dockerfile
FROM node:20-bookworm

WORKDIR /app

# Copier les fichiers de dependances
COPY package*.json ./

# Installer les dependances backend
RUN npm install

# Copier le code source
COPY . .

# Ecouter sur le port 3000
EXPOSE 3000

# Commande par defaut execute quand le conteneur demarre
CMD ["node", "server.js"]