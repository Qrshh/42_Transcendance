# Frontend Dockerfile
FROM node:20-bookworm  
WORKDIR /app

COPY package*.json ./
RUN npm ci        # plus rapide / reproductible que npm install

COPY . .
EXPOSE 5173
CMD ["npm", "run", "build", "--", "--host", "0.0.0.0"]
