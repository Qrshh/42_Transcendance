# Frontend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copier les fichiers de dependances
COPY package*.json ./

# Installer les dependances (axios et tailwindcss inclus dans package.json)
RUN npm install

# Installer et configurer Tailwind CSS
RUN npm install -D tailwindcss@3
RUN npx tailwindcss init

# Copier le code source
COPY . .

# Ecouter sur le port 5173
EXPOSE 5173

# Commande par defaut execute quand le conteneur demarre
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]