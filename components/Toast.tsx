import { Ionicons } from "@expo/vector-icons"
import { useEffect, useRef } from "react"
import { Animated, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type ToastType = "success" | "error" | "warning" | "info"

interface ToastProps {
  visible: boolean
  message: string
  type?: ToastType
  onHide: () => void
  duration?: number
}

const CONFIG: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }> = {
  success: { icon: "checkmark-circle", bg: "#f0fdf4", color: "#16a34a" },
  error:   { icon: "alert-circle",     bg: "#fef2f2", color: "#dc2626" },
  warning: { icon: "warning",          bg: "#fffbeb", color: "#d97706" },
  info:    { icon: "information-circle", bg: "#f0f9ff", color: "#0ea5e9" },
}

export default function Toast({ visible, message, type = "info", onHide, duration = 3000 }: ToastProps) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(-80)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const config = CONFIG[type]

  useEffect(() => {
    if (visible) {
      if (timer.current) clearTimeout(timer.current)
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start()
      timer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -80, duration: 220, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start(() => onHide())
      }, duration)
    }
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [visible, message])

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 12, backgroundColor: config.bg, opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Ionicons name={config.icon} size={20} color={config.color} />
      <Text style={[styles.message, { color: config.color }]} numberOfLines={2}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
})