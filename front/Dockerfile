# Frontend Dockerfile
FROM node:20-bookworm  
WORKDIR /app

COPY package*.json ./
RUN npm ci        # plus rapide / reproductible que npm install

COPY . .
EXPOSE 5173

CMD ["sh", "-c", "npm run build && npm run preview -- --host 0.0.0.0 --port 5173"]

