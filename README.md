# Transcendance

Base du projet, avec un componant home et login, histoire de commencer j'ai fait aussi un useradd pour integrer sal

setup without docker:

install nvm pour maj node car trop vieux pour vue(v12):

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

charger le nvm:

```sh
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
```

et source:
```sh 
source ~/.zshrc
 ```

pour check si la maj a ete faite:

```sh
node -v
```

maj node: 

```sh
nvm install --lts
```

pour use la latest version:

```sh
nvm use --lts
```

installer une app vue (normalement pas besoin):

```sh
npm create vue@latest
```

j'ai selectionne lors de la creation les point suivant(normalement pas besoin):

TypeScript
Router

pour install axios(back)

```sh
npm install axios
```

pour install tailwindcss(dans le dossier front)

```sh
npm install -D tailwindcss@3

npx tailwindcss init
```

et sa les npm pour dans le dossier back:
```sh 
npm install fastify @fastify/cors sqlite3
```

pour run le site(a exec dans le dossier front):

```sh
npm run dev
```

pour run le serveur back(depuis le  dossier back):

```sh
node server.js
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```
