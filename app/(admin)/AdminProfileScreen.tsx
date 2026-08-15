import { Ionicons } from "@expo/vector-icons";
import ConfirmModal from "@/components/ConfirmModal";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { getValidAccessToken, clearAuthTokens } from '@/utils/secureAuth';
import { clearUserCache } from '@/utils/cache';
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";

import React, { memo, useCallback, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ProfileScreenProps {
  adminData: any;
  allComplaints: any[];
}

export default memo(function AdminProfileScreen({ adminData, allComplaints }: ProfileScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
const [pwModalVisible, setPwModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
 const [pwSuccess, setPwSuccess] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
const { toast, toastProps } = useToast();
 
const [profileScreen, setProfileScreen] = useState<"main" | "legal" | "settings" | "changePassword">("main");

  const resolvedCount = useMemo(() => allComplaints.filter((c) => c.status === "completed").length, [allComplaints]);
  const totalCount = useMemo(() => allComplaints.length, [allComplaints]);
  const efficiency = useMemo(() => totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0, [resolvedCount, totalCount]);
  const flaggedCount = useMemo(() => allComplaints.filter((c) => c.flagged && !c.flagResolved).length, [allComplaints]);

const handleLogout = useCallback(async () => {
    try {
      const { getMessaging, getToken } = require("@react-native-firebase/messaging");
      const fcmToken = await getToken(getMessaging()).catch(() => null);
      const { authAPI } = require("../../services/api");
      await authAPI.logoutAllDevices(fcmToken);
    } catch {}
    await clearAuthTokens();
    clearUserCache();
    const { mmkvDelete } = require('@/utils/mmkv');
    mmkvDelete("unifix_cached_user");
    mmkvDelete("unifix_active_tab");
    mmkvDelete("unifix_staff_active_tab");
    mmkvDelete("unifix_admin_active_tab");
    mmkvDelete("unifix_push_token");
    mmkvDelete("lf_feed_hash");
    mmkvDelete("lf_claims_hash");
    mmkvDelete("lr_feed_hash");
    mmkvDelete("lf_feed_synced_at");
    mmkvDelete("lf_claims_synced_at");
    mmkvDelete("lr_feed_synced_at");
    mmkvDelete("lf_myposts_synced_at");
    mmkvDelete("student_complaints_hash");
    mmkvDelete("student_complaints_synced_at");
    mmkvDelete("staff_complaints_hash");
    mmkvDelete("staff_complaints_synced_at");
    mmkvDelete("admin_complaints_hash");
    mmkvDelete("admin_complaints_synced_at");
    const { useLoadingStore } = require('@/store/loadingStore');
    useLoadingStore.getState().clearPersistedState();
    const { resetDb } = require('../../db/database');
    await resetDb();
    router.replace("/(auth)/login" as any);
  }, [router]);

  const handlePickPhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      const formData = new FormData();
      const name = uri.split("/").pop() || `upload_${Date.now()}.jpg`;
      formData.append("file", { uri, type: "image/jpeg", name } as any);
      formData.append("upload_preset", "unifix_upload");
      formData.append("folder", "unifix/profiles");
      const res = await fetch("https://api.cloudinary.com/v1_1/dcizaxjul/image/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const url = data.secure_url;
const token = await getValidAccessToken();
      await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/auth/update-profile`,{
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ photoUrl: url }),
      });
toast("Profile photo updated!", "success");
    } catch (e: any) {
      toast(e.message || "Failed to upload photo.", "error");
    }
  }, []);

const MENU_ITEMS = useMemo(() => [
    { icon: "settings-outline", label: "Settings", color: "#8b5cf6", onPress: () => setProfileScreen("settings") },
    { icon: "information-circle-outline", label: "Legal", color: "#0ea5e9", onPress: () => setProfileScreen("legal") },
  ], []);

const renderLegal = () => (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => setProfileScreen("main")} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="arrow-back" size={20} color="#1a3c2e" />
          <Text style={styles.headerTitle}>Legal</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}>
        <View style={styles.menuSection}>
      {[
           { label: "Terms & Conditions", icon: "document-text-outline", type: "terms" },
        { label: "Privacy Policy", icon: "shield-checkmark-outline", type: "privacy" },
     { label: "Copyright", icon: "ribbon-outline", type: "copyright" },

          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuRow}
              activeOpacity={0.7}
            onPress={() => router.push({ pathname: "/legal/terms-and-conditions", params: { type: item.type } } as any)}
            >
              <View style={[styles.menuIcon, { backgroundColor: "#0ea5e918" }]}>
                <Ionicons name={item.icon as any} size={18} color="#0ea5e9" />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

const renderSettings = () => (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => setProfileScreen("main")} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="arrow-back" size={20} color="#1a3c2e" />
          <Text style={styles.headerTitle}>Settings</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}>
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => setProfileScreen("changePassword")}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#8b5cf618" }]}>
              <Ionicons name="lock-closed-outline" size={18} color="#8b5cf6" />
            </View>
            <Text style={styles.menuLabel}>Change Password</Text>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

if (profileScreen === "legal") return renderLegal();
  if (profileScreen === "settings") return renderSettings();
if (profileScreen === "changePassword") return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => setProfileScreen("settings")} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="arrow-back" size={20} color="#1a3c2e" />
          <Text style={styles.headerTitle}>Change Password</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}>
        <View style={[styles.menuSection, { padding: 20 }]}>
          <Text style={{ fontSize: 14, color: "#64748b", lineHeight: 22 }}>
            To change your password, please contact the system administrator or use the forgot password option on the login screen.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
return (
<View style={styles.root}>
      <Toast {...toastProps} />
<ConfirmModal
        visible={logoutModalVisible}
        title="Log Out"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        destructive
        showIcon={false}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={() => { setLogoutModalVisible(false); handleLogout(); }}
      />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        <View style={styles.profileCard}>
          <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.85} style={styles.avatarWrap}>
            {adminData?.photoUrl ? (
              <Image source={{ uri: adminData.photoUrl }} style={[styles.avatar, { borderWidth: 2, borderColor: "#16a34a" }]} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{adminData?.fullName?.[0]?.toUpperCase() ?? "A"}</Text>
              </View>
            )}
            <View style={[styles.onlineDot, { backgroundColor: "#16a34a", width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="camera" size={11} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{adminData?.fullName ?? "Admin"}</Text>
          <Text style={styles.profileEmail}>{adminData?.email ?? "admin@unifix.com"}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={13} color="#16a34a" />
            <Text style={styles.roleBadgeText}>Administrator</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{resolvedCount}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
          <View style={[styles.statCard, styles.statCardCenter]}>
            <Text style={[styles.statValue, { color: efficiency >= 70 ? "#16a34a" : "#f59e0b" }]}>{efficiency}%</Text>
            <Text style={styles.statLabel}>Efficiency</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: flaggedCount > 0 ? "#ef4444" : "#1a3c2e" }]}>{flaggedCount}</Text>
            <Text style={styles.statLabel}>Flagged</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuRow} onPress={item.onPress} activeOpacity={0.7}>
              <View style={[styles.menuIcon, { backgroundColor: item.color + "18" }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>

    <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color="#dc2626" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={pwModalVisible} animationType="slide" transparent onRequestClose={() => setPwModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.pwModalOverlay}>
          <View style={styles.pwModalSheet}>
            <View style={styles.pwModalHandle} />
            <Text style={styles.pwModalTitle}>Change Password</Text>

            <View style={styles.pwInputWrap}>
              <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" style={{ marginLeft: 4 }} />
              <TextInput style={styles.pwInput} placeholder="Current password" placeholderTextColor="#9ca3af" secureTextEntry={!showCurrentPw} value={currentPassword} onChangeText={setCurrentPassword} />
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowCurrentPw(!showCurrentPw)}>
                <Ionicons name={showCurrentPw ? "eye-off-outline" : "eye-outline"} size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

         

            {pwError ? <Text style={styles.pwError}>{pwError}</Text> : null}
            {pwSuccess ? <Text style={styles.pwSuccess}>{pwSuccess}</Text> : null}

          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f0fdf4" },
header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: "#f0fdf4" },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#1a3c2e" },
  scroll: { flex: 1 },
  profileCard: {
    marginHorizontal: 20,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarWrap: { position: "relative", marginBottom: 14 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#1a3c2e", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 30, fontWeight: "800", color: "#ffffff" },
  onlineDot: { position: "absolute", bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: "#16a34a", borderWidth: 2, borderColor: "#ffffff" },
  profileName: { fontSize: 20, fontWeight: "800", color: "#1a3c2e", marginBottom: 4 },
  profileEmail: { fontSize: 13, color: "#64748b", marginBottom: 12 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f0fdf4", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1.5, borderColor: "#bbf7d0" },
  roleBadgeText: { fontSize: 12, fontWeight: "700", color: "#16a34a" },
  statsRow: { flexDirection: "row", marginHorizontal: 20, gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardCenter: { borderTopWidth: 2, borderTopColor: "#16a34a" },
  statValue: { fontSize: 24, fontWeight: "800", color: "#1a3c2e", marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  menuSection: { marginHorizontal: 20, backgroundColor: "#ffffff", borderRadius: 18, overflow: "hidden", marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f8fafc", gap: 12 },
  menuIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#1a3c2e" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: "#fecaca",
    marginBottom: 16,
  },
  logoutBtnText: { fontSize: 15, fontWeight: "700", color: "#dc2626" },
  version: { textAlign: "center", fontSize: 12, color: "#94a3b8", marginBottom: 8 },
  pwModalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  pwModalSheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  pwModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#e2e8f0", alignSelf: "center", marginBottom: 20 },
  pwModalTitle: { fontSize: 18, fontWeight: "800", color: "#1a3c2e", marginBottom: 20, textAlign: "center" },
  pwInputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1.5, borderColor: "#e2e8f0", paddingRight: 14, marginBottom: 12, gap: 8 },
  pwInput: { flex: 1, padding: 13, fontSize: 14, color: "#1a3c2e" },
  pwError: { fontSize: 13, color: "#dc2626", fontWeight: "600", textAlign: "center", marginBottom: 10 },
  pwSuccess: { fontSize: 13, color: "#16a34a", fontWeight: "600", textAlign: "center", marginBottom: 10 },
  pwBtnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  pwCancelBtn: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1.5, borderColor: "#e2e8f0" },
  pwCancelText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  pwSaveBtn: { flex: 1, backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  pwSaveText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
});