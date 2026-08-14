import { Ionicons } from "@expo/vector-icons"
import { useEffect, useRef } from "react"
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native"

interface CallConfirmationModalProps {
  visible: boolean
  name?: string
  phone: string
  onCancel: () => void
  onConfirm: () => void
}

export default function CallConfirmationModal({ visible, name, phone, onCancel, onConfirm }: CallConfirmationModalProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.92)).current
  const cardOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.92, duration: 150, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
      accessible
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Animated.View style={[styles.backdropFill, { opacity: backdropOpacity }]} />
      </Pressable>

      <View style={styles.centeredView} pointerEvents="box-none">
        <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="call" size={28} color="#16a34a" />
            </View>
          </View>

          <Text style={styles.title}>Call Staff?</Text>

          {name ? <Text style={styles.name}>{name}</Text> : null}

          <View style={styles.phoneRow}>
            <Ionicons name="phone-portrait-outline" size={14} color="#64748b" />
            <Text style={styles.phone}>{phone}</Text>
          </View>

          <Text style={styles.message}>Are you sure you want to call this number?</Text>

          <View style={styles.divider} />

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.7}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity
              style={styles.callBtn}
              onPress={onConfirm}
              activeOpacity={0.7}
              accessibilityLabel="Call"
              accessibilityRole="button"
            >
              <Ionicons name="call-outline" size={15} color="#16a34a" />
              <Text style={styles.callText}>Call</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  centeredView: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a3c2e",
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 10,
  },
  phone: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: 0.4,
  },
  message: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  actions: {
    flexDirection: "row",
    height: 52,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748b",
  },
  actionDivider: {
    width: 1,
    backgroundColor: "#f1f5f9",
  },
  callBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  callText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#16a34a",
  },
})