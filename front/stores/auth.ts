import { ref } from 'vue'

export const isLoggedIn = ref(!!localStorage.getItem('username'))

export function login(username: string, email: string, avatar: string){
  localStorage.setItem('username', username)
  localStorage.setItem('email', email)
  localStorage.setItem('avatar', avatar)
  isLoggedIn.value = true
}

export function logout(){
	localStorage.removeItem('username')
	isLoggedIn.value = false
}