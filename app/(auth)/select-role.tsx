import { Ionicons } from "@expo/vector-icons";
import { setAccessToken, setRefreshToken } from '@/utils/secureAuth';
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { authAPI } from "../../services/api";

type Role = "student" | "teacher";

const ROLE_OPTIONS: {
  label: string;
  value: Role;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}[] = [
  {
    label: "Student",
    value: "student",
    icon: "school-outline",
    description: "Submit campus repair requests and track maintenance updates",
  },
  {
    label: "Teacher",
    value: "teacher",
    icon: "person-outline",
    description: "Report campus issues and monitor complaint resolution",
  },
];

export default function SelectRoleScreen() {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    if (!selectedRole) return setError("Please select your account type to continue.");
    setError("");
    setLoading(true);
    try {
      const data = await authAPI.selectRole(selectedRole);
      const token = data.token ?? data.data?.token;
      const refreshToken = data.refreshToken ?? data.data?.refreshToken;

     if (token) await setAccessToken(token);
      if (refreshToken) await setRefreshToken(refreshToken);

      router.replace("/complete-profile" as any);
    } catch (err: any) {
      setError(err.message || "Failed to set account type. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={s.header}>
        <View style={s.logoCircle}>
          <Ionicons name="people-outline" size={28} color="#16a34a" />
        </View>
        <Text style={s.title}>Select Account Type</Text>
        <Text style={s.subtitle}>
          Choose the role that best describes you at VCET
        </Text>
      </View>

      <View style={s.optionsContainer}>
        {ROLE_OPTIONS.map((option) => {
          const active = selectedRole === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[s.optionCard, active && s.optionCardActive]}
              onPress={() => setSelectedRole(option.value)}
              activeOpacity={0.85}
              disabled={loading}
            >
              <View style={[s.optionIconWrap, active && s.optionIconWrapActive]}>
                <Ionicons
                  name={option.icon}
                  size={32}
                  color={active ? "#16a34a" : "#94a3b8"}
                />
              </View>
              <View style={s.optionTextWrap}>
                <Text style={[s.optionLabel, active && s.optionLabelActive]}>
                  {option.label}
                </Text>
                <Text style={s.optionDescription}>{option.description}</Text>
              </View>
              <View style={[s.radioOuter, active && s.radioOuterActive]}>
                {active && <View style={s.radioInner} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[s.continueBtn, (!selectedRole || loading) && s.btnDisabled]}
        onPress={handleContinue}
        disabled={!selectedRole || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.continueBtnText}>Continue</Text>
        )}
      </TouchableOpacity>

      <Text style={s.footer}>
        This cannot be changed after profile completion.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: { alignItems: "center", marginBottom: 40 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
  },
  optionsContainer: { gap: 14, marginBottom: 24 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    gap: 14,
  },
  optionCardActive: {
    borderColor: "#16a34a",
    backgroundColor: "#f0fdf4",
  },
  optionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconWrapActive: { backgroundColor: "#dcfce7" },
  optionTextWrap: { flex: 1 },
  optionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  optionLabelActive: { color: "#16a34a" },
  optionDescription: { fontSize: 13, color: "#64748b", lineHeight: 18 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: { borderColor: "#16a34a" },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#16a34a",
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: { color: "#dc2626", fontSize: 13, textAlign: "center", fontWeight: "500" },
  continueBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 16,
  },
  btnDisabled: { opacity: 0.45 },
  continueBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  footer: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
  },
});