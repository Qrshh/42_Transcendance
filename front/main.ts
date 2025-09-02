import './assets/main.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import SocketPlugin from './views/plugins/socket'

const app = createApp(App)

app.use(router)

// 👇 monte le plugin socket (l’URL WS peut venir du .env)
app.use(SocketPlugin,
)

app.mount('#app')
