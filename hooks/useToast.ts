import { useCallback, useRef, useState } from "react"

type ToastType = "success" | "error" | "warning" | "info"

interface ToastState {
  visible: boolean
  message: string
  type: ToastType
}

export function useToast() {
  const [state, setState] = useState<ToastState>({ visible: false, message: "", type: "info" })
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback((message: string, type: ToastType = "info") => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setState({ visible: true, message, type })
  }, [])

  const hide = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }))
  }, [])

  return {
    toast,
    toastProps: {
      visible: state.visible,
      message: state.message,
      type: state.type,
      onHide: hide,
    },
  }
}