import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMasterData, resolveRoom as resolveRoomFromMaster } from "../../../hooks/useMasterData";
const CLOUDINARY_CLOUD = "dcizaxjul";
const CLOUDINARY_PRESET = "unifix_upload";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;



interface ReportSectionProps {
  bottomNavHeight: number;
  onBackToHome: () => void;
}

async function uploadToCloudinary(
  uri: string,
  folder: string,
): Promise<string> {
  const formData = new FormData();
  const name = uri.split("/").pop() || `upload_${Date.now()}.jpg`;
  formData.append("file", { uri, type: "image/jpeg", name } as any);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  formData.append("folder", folder);
  const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url;
}

export default memo(function ReportSection({
  bottomNavHeight,
  onBackToHome,
}: ReportSectionProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [reportCategory, setReportCategory] = useState("");
  const [reportSubIssue, setReportSubIssue] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportRoomInput, setReportRoomInput] = useState("");
  const [reportResolvedRoom, setReportResolvedRoom] = useState<{
    building: string;
    label: string;
  } | null>(null);
  const [reportRoomError, setReportRoomError] = useState("");
  const [reportPhoto, setReportPhoto] = useState<{
    uri: string;
    name: string;
  } | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportUploadingPhoto, setReportUploadingPhoto] = useState(false);
  const [reportError, setReportError] = useState("");

const { data: masterData, loading: masterLoading } = useMasterData();
  const reportSubIssues = useMemo(() => {
    const cat = masterData?.categories.find(c => c.name.toLowerCase() === reportCategory.toLowerCase());
    return cat?.subCategories.map(s => s.name) ?? [];
  }, [reportCategory, masterData]);

  const handleReportRoomInput = useCallback((val: string) => {
    setReportRoomInput(val);
    setReportRoomError("");
    if (!val.trim()) {
      setReportResolvedRoom(null);
      return;
    }
    const resolved = resolveRoomFromMaster(masterData?.buildings ?? [], val);
    if (resolved) {
      setReportResolvedRoom(resolved);
    } else {
      setReportResolvedRoom(null);
      if (val.trim().length >= 3)
        setReportRoomError("Room not found. Try e.g. 319, 214, 003A.");
    }
  }, [masterData]);

  const handleReportPickPhoto = useCallback(async () => {
    Alert.alert("Add Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert("Permission Required", "Please allow camera access.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.8,
            });
            if (result.canceled) return;
            const asset = result.assets[0];
            setReportPhoto({
              uri: asset.uri,
              name: asset.uri.split("/").pop() || `complaint_${Date.now()}.jpg`,
            });
          } catch {
            Alert.alert("Error", "Failed to open camera.");
          }
        },
      },
      {
        text: "Choose from Gallery",
        onPress: async () => {
          try {
            const perm =
              await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              Alert.alert(
                "Permission Required",
                "Please allow photo library access.",
              );
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.8,
            });
            if (result.canceled) return;
            const asset = result.assets[0];
            setReportPhoto({
              uri: asset.uri,
              name: asset.uri.split("/").pop() || `complaint_${Date.now()}.jpg`,
            });
          } catch {
            Alert.alert("Error", "Failed to pick photo.");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, []);

  const handleReportSubmit = useCallback(async () => {
    setReportError("");
    const category = reportCategory || "others";
    const finalSubIssue = reportSubIssue || null;
    const finalCustom = null;
    if (!finalSubIssue && !finalCustom)
      return setReportError("Please select the specific issue.");
    if (!reportResolvedRoom)
      return setReportError("Please enter a valid room number.");
    setReportSubmitting(true);
    try {
   const freshToken = await AsyncStorage.getItem("unifix_access_token");
      if (!freshToken) {
        setReportError("Authentication error. Please login again.");
        return;
      }
      let photoUrl: string | null = null;
      if (reportPhoto) {
        setReportUploadingPhoto(true);
        try {
          const formData = new FormData();
          formData.append("file", {
            uri: reportPhoto.uri,
            type: "image/jpeg",
            name: reportPhoto.name,
          } as any);
          formData.append("upload_preset", CLOUDINARY_PRESET);
          formData.append("folder", "unifix/complaints");
          const res = await fetch(CLOUDINARY_URL, {
            method: "POST",
            body: formData,
          });
          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();
          photoUrl = data.secure_url;
        } catch {
          setReportError("Failed to upload photo. Please try again.");
          return;
        } finally {
          setReportUploadingPhoto(false);
        }
      }
      const BACKEND_URL = process.env.EXPO_PUBLIC_BASE_URL;
      const response = await fetch(`${BACKEND_URL}/complaints/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({
          category,
          subIssue: finalSubIssue,
          customIssue: finalCustom,
          description: reportDescription.trim(),
          building: `${reportResolvedRoom.building}, Room ${reportRoomInput.trim()}`,
          roomDetail: `${reportRoomInput.trim()}, ${reportResolvedRoom.label}`,
          photoUrl,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setReportError(
          data.error || data.message || "Failed to submit complaint.",
        );
        return;
      }
      setReportCategory("");
      setReportSubIssue("");
      setReportDescription("");
      setReportRoomInput("");
      setReportResolvedRoom(null);
      setReportPhoto(null);
      setReportError("");
      router.replace(`/complaint-success?ticketId=${data.ticketId}` as any);
    } catch (err: any) {
      setReportError("Failed to submit. Please check your connection.");
    } finally {
      setReportSubmitting(false);
      setReportUploadingPhoto(false);
    }
  }, [reportCategory, reportSubIssue, reportResolvedRoom, reportDescription, reportRoomInput, reportPhoto, router]);


  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomNavHeight + 48,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
              <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={onBackToHome} style={styles.backButton}>
              <Ionicons name="arrow-back" size={18} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Report Issue</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.progressContainer}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={[styles.progressDot, styles.progressDotInactive]} />
            <View style={[styles.progressDot, styles.progressDotInactive]} />
          </View>
          <Text style={styles.mainTitle}>{"What's the issue?"}</Text>
          <Text style={styles.subText}>
            Please provide details about the maintenance request.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>SELECT CATEGORY</Text>
      <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {masterLoading ? (
            <Text style={{ color: "#94a3b8", fontSize: 13, paddingVertical: 10 }}>Loading…</Text>
          ) : (
            (masterData?.categories ?? []).map((cat) => {
              const active = reportCategory === cat.name.toLowerCase();
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryBtn, active && styles.categoryBtnActive]}
                  onPress={() => {
                    setReportCategory(cat.name.toLowerCase());
                    setReportSubIssue("");
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={cat.iconName as keyof typeof Ionicons.glyphMap}
                    size={15}
                    color={active ? "#ffffff" : "#374151"}
                  />
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

     {reportCategory === "washroom" && masterData && (
          <View style={styles.washroomNote}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="#1d4ed8"
              style={{ marginRight: 6, marginTop: 1 }}
            />
            <Text style={styles.washroomNoteText}>
              Washroom requests are assigned to staff based on your gender for
              privacy.
            </Text>
          </View>
        )}

        {reportSubIssues.length > 0 && (
          <>
            <Text style={styles.subIssuesTitle}>Specific Issue</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.subIssuesContainer}
            >
              {reportSubIssues.map((issue) => (
                <TouchableOpacity
                  key={issue}
                  style={[
                    styles.subIssueBtn,
                    reportSubIssue === issue && styles.subIssueBtnActive,
                  ]}
                  onPress={() =>
                    setReportSubIssue(reportSubIssue === issue ? "" : issue)
                  }
                >
                  <Text
                    style={[
                      styles.subIssueText,
                      reportSubIssue === issue && styles.subIssueTextActive,
                    ]}
                  >
                    {issue}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.locationTitle}>Location</Text>
        <View
          style={[
            styles.roomInputContainer,
            reportResolvedRoom
              ? styles.roomInputContainerValid
              : reportRoomError
                ? styles.roomInputContainerError
                : null,
          ]}
        >
          <Ionicons
            name="location-outline"
            size={16}
            color={reportResolvedRoom ? "#16a34a" : "#9ca3af"}
            style={styles.roomInputIcon}
          />
          <TextInput
            style={styles.roomInput}
            placeholder="Enter room number e.g. 214"
            placeholderTextColor="#9ca3af"
            value={reportRoomInput}
            onChangeText={handleReportRoomInput}
            autoCapitalize="characters"
            maxLength={5}
          />
        </View>
        {reportResolvedRoom && (
          <View style={styles.resolvedRoomContainer}>
            <Ionicons
              name="checkmark-circle"
              size={14}
              color="#16a34a"
              style={{ marginRight: 5 }}
            />
            <Text style={styles.resolvedRoomText}>
              Room {reportRoomInput}, {reportResolvedRoom.label},{" "}
              {reportResolvedRoom.building}
            </Text>
          </View>
        )}
        {reportRoomError && (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle-outline"
              size={13}
              color="#dc2626"
              style={{ marginRight: 5 }}
            />
            <Text style={styles.errorText}>{reportRoomError}</Text>
          </View>
        )}

        <Text style={styles.descriptionTitle}>Description</Text>
        <TextInput
          style={styles.descriptionInput}
          placeholder="Describe the issue in detail..."
          placeholderTextColor="#9ca3af"
          value={reportDescription}
          onChangeText={setReportDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.photoTitle}>Add Photos</Text>
        <TouchableOpacity
          style={styles.photoButton}
          onPress={handleReportPickPhoto}
          activeOpacity={0.85}
        >
          {reportPhoto ? (
            <View style={styles.photoPreview}>
              <View style={styles.photoPreviewIcon}>
                <Ionicons name="image-outline" size={22} color="#16a34a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoPreviewName} numberOfLines={1}>
                  {reportPhoto.name}
                </Text>
                <Text style={styles.photoPreviewStatus}>Ready to upload</Text>
              </View>
              <Text style={styles.photoPreviewChange}>Change</Text>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <View style={styles.photoPlaceholderIcon}>
                <Ionicons name="camera-outline" size={22} color="#64748b" />
              </View>
              <Text style={styles.photoPlaceholderText}>
                Upload photo or take a picture
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {reportError && (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle-outline"
              size={15}
              color="#dc2626"
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.errorText, { flex: 1 }]}>{reportError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.submitButton,
            reportSubmitting && styles.submitButtonDisabled,
          ]}
          onPress={handleReportSubmit}
          disabled={reportSubmitting}
          activeOpacity={0.85}
        >
          {reportSubmitting ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <ActivityIndicator color="#fff" />
              <Text style={styles.submitButtonText}>
                {reportUploadingPhoto ? "Uploading photo..." : "Submitting..."}
              </Text>
            </View>
          ) : (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text style={styles.submitButtonText}>Submit Report</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.footerText}>
          By submitting, you agree to our maintenance guidelines.
        </Text>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    backgroundColor: "#e8f5e9",
    marginHorizontal: -20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.7)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
    progressContainer: { flexDirection: "row", gap: 6, marginBottom: 16 },
    progressDot: { width: 32, height: 5, borderRadius: 3 },
    progressDotActive: { backgroundColor: "#16a34a" },
    progressDotInactive: { backgroundColor: "#a7d7a9" },
    mainTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: "#0f172a",
      marginBottom: 6,
      letterSpacing: -0.3,
    },
    subText: { fontSize: 13, color: "#4b5563", lineHeight: 20 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: "#16a34a",
      letterSpacing: 1,
      marginBottom: 12,
      marginTop: 4,
    },
    categoryScroll: { marginBottom: 4 },
    categoryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 24,
      backgroundColor: "#ffffff",
      borderWidth: 1.5,
      borderColor: "#e2e8f0",
      marginRight: 10,
    },
    categoryBtnActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
    categoryText: { fontSize: 13, fontWeight: "600", color: "#374151" },
    categoryTextActive: { color: "#ffffff" },
    washroomNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: "#eff6ff",
      borderRadius: 10,
      padding: 12,
      marginTop: 8,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: "#bfdbfe",
    },
    washroomNoteText: {
      fontSize: 12,
      color: "#1d4ed8",
      lineHeight: 18,
      fontWeight: "500",
      flex: 1,
    },
    subIssuesContainer: { marginBottom: 4 },
    subIssuesTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: "#374151",
      marginBottom: 8,
      marginTop: 18,
    },
    subIssueBtn: {
      backgroundColor: "#f8fafc",
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginRight: 8,
      borderWidth: 1.5,
      borderColor: "#e2e8f0",
    },
    subIssueBtnActive: { backgroundColor: "#f0fdf4", borderColor: "#16a34a" },
    subIssueText: { fontSize: 13, color: "#374151", fontWeight: "500" },
    subIssueTextActive: { color: "#16a34a", fontWeight: "700" },
    locationTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: "#374151",
      marginBottom: 8,
      marginTop: 18,
    },
    roomInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#ffffff",
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: "#e2e8f0",
      paddingHorizontal: 12,
    },
    roomInputContainerValid: {
      borderColor: "#16a34a",
      backgroundColor: "#f0fdf4",
    },
    roomInputContainerError: { borderColor: "#ef4444" },
    roomInputIcon: { marginRight: 8 },
    roomInput: { flex: 1, fontSize: 14, color: "#0f172a", paddingVertical: 13 },
    resolvedRoomContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#f0fdf4",
      borderRadius: 8,
      padding: 10,
      marginTop: 6,
      borderWidth: 1,
      borderColor: "#bbf7d0",
    },
    resolvedRoomText: { fontSize: 13, color: "#16a34a", fontWeight: "600" },
    errorContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fef2f2",
      borderRadius: 8,
      padding: 10,
      marginTop: 6,
      borderWidth: 1,
      borderColor: "#fecaca",
    },
    errorText: { fontSize: 12, color: "#dc2626" },
    descriptionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: "#374151",
      marginBottom: 8,
      marginTop: 18,
    },
    descriptionInput: {
      backgroundColor: "#ffffff",
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 14,
      color: "#0f172a",
      borderWidth: 1.5,
      borderColor: "#e2e8f0",
      height: 110,
      textAlignVertical: "top",
    },
    photoTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: "#374151",
      marginBottom: 8,
      marginTop: 18,
    },
    photoButton: {
      backgroundColor: "#ffffff",
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: "#e2e8f0",
      borderStyle: "dashed",
      paddingVertical: 28,
      paddingHorizontal: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    photoPreview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      width: "100%",
    },
    photoPreviewIcon: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: "#f0fdf4",
      alignItems: "center",
      justifyContent: "center",
    },
    photoPreviewName: {
      fontSize: 13,
      fontWeight: "600",
      color: "#0f172a",
      flex: 1,
    },
    photoPreviewStatus: { fontSize: 12, color: "#16a34a", marginTop: 2 },
    photoPreviewChange: { color: "#16a34a", fontSize: 13, fontWeight: "700" },
    photoPlaceholder: { alignItems: "center", gap: 10 },
    photoPlaceholderIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#f1f5f9",
      alignItems: "center",
      justifyContent: "center",
    },
    photoPlaceholderText: { fontSize: 13, color: "#94a3b8", fontWeight: "500" },
    submitButton: {
      backgroundColor: "#16a34a",
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: 28,
    },
    submitButtonDisabled: { opacity: 0.55 },
    submitButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    footerText: {
      textAlign: "center",
      fontSize: 12,
      color: "#94a3b8",
      marginTop: 14,
    },
  });