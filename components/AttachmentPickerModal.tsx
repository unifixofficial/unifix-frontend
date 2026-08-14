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
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AttachmentPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onGallery: () => void;
  onCamera: () => void;
  title?: string;
  galleryLabel?: string;
  cameraLabel?: string;
}

export default function AttachmentPickerModal({
  visible,
  onClose,
  onGallery,
  onCamera,
  title = "Add Photo",
  galleryLabel = "Choose from Gallery",
  cameraLabel = "Take a Photo",
}: AttachmentPickerModalProps) {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleGallery = () => {
    onClose();
    setTimeout(onGallery, 50);
  };

  const handleCamera = () => {
    onClose();
    setTimeout(onCamera, 50);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[styles.backdropFill, { opacity: backdropOpacity }]}
        />
      </Pressable>

      <View style={styles.sheetContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.handle} />

          <Text style={styles.title}>{title}</Text>

          <TouchableOpacity
            style={styles.row}
            onPress={handleGallery}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="image-outline" size={22} color="#16a34a" />
            </View>
      <Text style={styles.rowLabel}>{galleryLabel}</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={handleCamera}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="camera-outline" size={22} color="#16a34a" />
            </View>
         <Text style={styles.rowLabel}>{cameraLabel}</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelRow}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
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
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  sheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 1.2,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 4,
    gap: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginHorizontal: 4,
  },
  cancelRow: {
    marginTop: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  cancelLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748b",
  },
});