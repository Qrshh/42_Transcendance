import { ref, readonly } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
  label: string
  onClick?: () => void
}

export interface GlobalToast {
  id: number
  message: string
  title?: string
  type: ToastType
  icon?: string
  timeout?: number
  action?: ToastAction
}

const _toasts = ref<GlobalToast[]>([])
let _id = 0

function iconFor(type?: ToastType) {
  return type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '🔔'
}

function removeToast(id: number) {
  const i = _toasts.value.findIndex(t => t.id === id)
  if (i !== -1) _toasts.value.splice(i, 1)
}

function addToast(input: { message: string; title?: string; type?: ToastType; icon?: string; timeout?: number; action?: ToastAction }) {
  const id = ++_id
  const type = input.type || 'info'
  const toast: GlobalToast = {
    id,
    message: input.message,
    title: input.title,
    type,
    icon: input.icon || iconFor(type),
    timeout: input.timeout ?? 3000,
    action: input.action,
  }
  _toasts.value.push(toast)
  if (toast.timeout && toast.timeout > 0) {
    window.setTimeout(() => removeToast(id), toast.timeout)
  }
  return id
}

function showToast(message: string, type: ToastType = 'info', opts?: { title?: string; icon?: string; timeout?: number; action?: ToastAction }) {
  return addToast({ message, type, title: opts?.title, icon: opts?.icon, timeout: opts?.timeout, action: opts?.action })
}

export function useGlobalToasts() {
  return {
    toasts: readonly(_toasts),
    addToast,
    showToast,
    removeToast,
  }
}
