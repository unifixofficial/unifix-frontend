import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebase/firebaseConfig";

export default function ComplaintSuccessScreen() {
  const { ticketId, complaintId } = useLocalSearchParams();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const [status, setStatus] = useState<"searching" | "assigned" | "queued">(
    "searching",
  );
  const [assignedName, setAssignedName] = useState("");
  const [noStaffTimeout, setNoStaffTimeout] = useState(false);

  useEffect(() => {
    loopRef.current = Animated.loop(
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loopRef.current.start();
    return () => loopRef.current?.stop();
  }, []);

  // Stop bar animation when assigned
  useEffect(() => {
    if (status === "assigned") {
      loopRef.current?.stop();
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [status]);

  // Show "queued" message after 2 minutes if still searching
  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (status === "searching") setNoStaffTimeout(true);
      },
      2 * 60 * 1000,
    );
    return () => clearTimeout(timer);
  }, []);

  // Firestore onSnapshot listener
  useEffect(() => {
    if (!complaintId) return;
    const unsub = onSnapshot(
      doc(db, "complaints", complaintId as string),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.status === "assigned" || data.status === "in_progress") {
          setAssignedName(data.assignedToName || "Staff");
          setStatus("assigned");
        } else if (data.status === "rejected") {
          setStatus("queued");
        }
      },
    );
    return () => unsub();
  }, [complaintId]);

  const translateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  return (
    <View style={s.container}>
      <View style={s.card}>
        <View style={s.iconCircle}>
          <Ionicons name="checkmark" size={36} color="#16a34a" />
        </View>
        <Text style={s.title}>Complaint Submitted!</Text>
        {status === "searching" && (
          <>
            <Text style={s.sub}>
              {noStaffTimeout
                ? "Taking longer than usual..."
                : "Searching for available staff..."}
            </Text>
            <View style={s.progressTrack}>
              <Animated.View
                style={[s.progressBar, { transform: [{ translateX }] }]}
              />
            </View>
            <Text style={s.searchingText}>
              {noStaffTimeout
                ? "Your complaint is queued"
                : "Searching in progress"}
            </Text>
            {noStaffTimeout && (
              <View style={s.queuedBox}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color="#7c3aed"
                  style={{ marginRight: 8 }}
                />
                <Text style={s.queuedText}>
                  No staff available yet. Your complaint is in the queue and
                  will be assigned shortly.
                </Text>
              </View>
            )}
          </>
        )}

        {status === "assigned" && (
          <View style={s.assignedBox}>
            <Ionicons
              name="checkmark-circle"
              size={28}
              color="#16a34a"
              style={{ marginBottom: 8 }}
            />
            <Text style={s.assignedTitle}>Staff Assigned!</Text>
            <Text style={s.assignedName}>{assignedName}</Text>
            <Text style={s.assignedSub}>
              is on the way to resolve your complaint.
            </Text>
          </View>
        )}

        {status === "queued" && (
          <View style={s.queuedBox}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color="#7c3aed"
              style={{ marginRight: 8 }}
            />
            <Text style={s.queuedText}>
              No staff accepted this complaint. It has been escalated
              automatically.
            </Text>
          </View>
        )}
        <View style={s.ticketBox}>
          <Text style={s.ticketLabel}>Your Ticket ID</Text>
          <Text style={s.ticketId}>{ticketId}</Text>
          <Text style={s.ticketHint}>Save this ID to track your complaint</Text>
        </View>
        <TouchableOpacity
          style={s.trackBtn}
          onPress={() => router.replace("/" as any)}
          activeOpacity={0.85}
        >
          <Ionicons
            name="search-outline"
            size={16}
            color="#fff"
            style={s.btnIcon}
          />
          <Text style={s.trackBtnText}>Track My Complaint</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.homeBtn}
          onPress={() => router.replace("/" as any)}
          activeOpacity={0.85}
        >
          <Ionicons
            name="home-outline"
            size={16}
            color="#374151"
            style={s.btnIcon}
          />
          <Text style={s.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f0fdf4",
    borderWidth: 2,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
    marginBottom: 8,
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  ticketBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    width: "100%",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#86efac",
  },
  ticketLabel: {
    fontSize: 12,
    color: "#065f46",
    fontWeight: "600",
    marginBottom: 6,
  },
  ticketId: {
    fontSize: 20,
    fontWeight: "800",
    color: "#16a34a",
    letterSpacing: 1.5,
    marginBottom: 6,
    textAlign: "center",
  },
  ticketHint: { fontSize: 11, color: "#6b7280", textAlign: "center" },
  progressTrack: {
    width: "100%",
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
    marginTop: 4,
  },
  progressBar: {
    width: "50%",
    height: "100%",
    backgroundColor: "#16a34a",
    borderRadius: 4,
  },
  searchingText: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "600",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  assignedBox: {
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    padding: 20,
    width: "100%",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  assignedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#16a34a",
    marginBottom: 4,
  },
  assignedName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  assignedSub: { fontSize: 13, color: "#64748b", textAlign: "center" },
  queuedBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f3e8ff",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e9d5ff",
  },
  queuedText: {
    fontSize: 13,
    color: "#7c3aed",
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
  },
  trackBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "center",
  },
  trackBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  homeBtn: {
    backgroundColor: "#f3f4f6",
    borderRadius: 14,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  homeBtnText: { color: "#374151", fontSize: 15, fontWeight: "600" },
  btnIcon: { marginRight: 8 },
});
