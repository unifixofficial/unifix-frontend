import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ModalVariant = "confirm" | "success" | "error" | "info";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  variant?: ModalVariant;
  showIcon?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

const VARIANT_CONFIG: Record<ModalVariant, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  confirm: { icon: "help-circle-outline", color: "#16a34a" },
  success: { icon: "checkmark-circle-outline", color: "#16a34a" },
  error: { icon: "alert-circle-outline", color: "#dc2626" },
  info: { icon: "information-circle-outline", color: "#0ea5e9" },
};

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  variant = "confirm",
  showIcon = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const isSingleButton = !onCancel;
  const config = VARIANT_CONFIG[variant];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.92, duration: 150, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleBackdropPress = () => {
    if (onCancel) onCancel();
    else onConfirm();
  };

  const confirmColor =
    variant === "error" || destructive
      ? "#dc2626"
      : variant === "success"
      ? "#16a34a"
      : variant === "info"
      ? "#0ea5e9"
      : "#16a34a";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleBackdropPress}
      accessible
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Animated.View style={[styles.backdropFill, { opacity: backdropOpacity }]} />
      </Pressable>

      <View style={styles.centeredView} pointerEvents="box-none">
        <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale }] }]}>
{showIcon && (
            <View style={styles.iconWrap}>
              <View style={[styles.iconCircle, { backgroundColor: config.color + "18" }]}>
                <Ionicons name={config.icon} size={28} color={config.color} />
              </View>
            </View>
          )}

          <Text style={[styles.title, !showIcon && { paddingTop: 28 }]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.divider} />

          <View style={styles.actions}>
            {!isSingleButton && (
              <>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onCancel}
                  activeOpacity={0.7}
                  accessibilityLabel={cancelText}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>{cancelText}</Text>
                </TouchableOpacity>
                <View style={styles.actionDivider} />
              </>
            )}
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={onConfirm}
              activeOpacity={0.7}
              accessibilityLabel={confirmText}
              accessibilityRole="button"
            >
              <Text style={[styles.confirmText, { color: confirmColor }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
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
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 24,
    paddingBottom: 24,
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
  confirmBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#16a34a",
  },
});