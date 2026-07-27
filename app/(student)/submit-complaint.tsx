import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";  


const BACKEND_URL = process.env.EXPO_PUBLIC_BASE_URL;
const CLOUDINARY_CLOUD = "dcizaxjul";
const CLOUDINARY_PRESET = "unifix_upload";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;
import { useMasterData, resolveRoom as resolveRoomFromMaster, type Category } from "../../hooks/useMasterData";
const SUB_ISSUES: Record<string, string[]> = {
  electrical: [
    "Projector not working",
    "AC not working",
    "Fan not working",
    "Light not working",
    "Power socket issue",
    "Wiring problem",
  ],
  plumbing: [
    "Water leakage",
    "Tap not working",
    "Blocked drain",
    "No water supply",
    "Broken pipe",
  ],
  carpentry: [
    "Broken desk",
    "Broken chair",
    "Door not closing",
    "Window damaged",
    "Cupboard broken",
    "Shelf damaged",
  ],
  cleaning: [
    "Classroom dirty",
    "Garbage not collected",
    "Floor not cleaned",
    "Dustbin full",
    "Bad smell",
  ],
  technician: [
    "Computer not working",
    "Projector issue",
    "WiFi not working",
    "Printer issue",
    "Speaker not working",
    "Smart board issue",
  ],
  safety: [
    "Emergency",
    "Fire Hazard",
    "Broken Stairs",
    "Loose Railing",
    "Suspicious Activity",
    "Medical Emergency",
  ],
  washroom: [
    "Washroom dirty",
    "Water leakage in washroom",
    "No water supply",
    "Broken flush",
    "Broken door/lock",
    "Bad smell",
    "Blocked drain",
  ],
  others: [],
};


async function uploadToCloudinary(
  uri: string,
  fileName: string,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", { uri, type: "image/jpeg", name: fileName } as any);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  formData.append("folder", "unifix/complaints");
  const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.secure_url;
}

export default function SubmitComplaintScreen() {
  const params = useLocalSearchParams();
  const initCategory = (params.category as string) || "";
  const { data: masterData, loading: masterLoading } = useMasterData();

  const [selectedCategory, setSelectedCategory] = useState(initCategory);
  const [subIssue, setSubIssue] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [resolvedRoom, setResolvedRoom] = useState<{
    building: string;
    label: string;
  } | null>(null);
  const [roomError, setRoomError] = useState("");
  const [photo, setPhoto] = useState<{ uri: string; name: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");

useEffect(() => {
    AsyncStorage.getItem("unifix_access_token").then((token) => {
      if (!token) router.replace("/login" as any);
    });
  }, []);

const handleRoomInput = (val: string) => {
    setRoomInput(val);
    setRoomError("");
    if (!val.trim()) {
      setResolvedRoom(null);
      return;
    }
    const resolved = resolveRoomFromMaster(masterData?.buildings ?? [], val);
    if (resolved) setResolvedRoom(resolved);
    else {
      setResolvedRoom(null);
      if (val.trim().length >= 3)
        setRoomError("Room not found. Try e.g. 319, 214, 003A.");
    }
  };

  const pickPhoto = async () => {
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
            setPhoto({
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
            setPhoto({
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
  };

  const handleSubmit = async () => {
    setError("");
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const hour = nowIST.getUTCHours();
    if (hour < 8 || hour >= 20) {
      return setError(
        "Complaints can only be submitted between 8:00 AM and 8:00 PM.",
      );
    }
    const category = selectedCategory || "others";
    const finalSubIssue = subIssue || null;
    const finalCustom = issueTitle.trim() || null;
    if (!finalSubIssue && !finalCustom)
      return setError("Please select or describe the issue.");
    if (!resolvedRoom) return setError("Please enter a valid room number.");

    setSubmitting(true);
    try {
    const freshToken = await AsyncStorage.getItem("unifix_access_token");
      if (!freshToken) {
        setError("Authentication error. Please login again.");
        return;
      }

      let photoUrl: string | null = null;
      if (photo) {
        setUploadingPhoto(true);
        try {
          photoUrl = await uploadToCloudinary(photo.uri, photo.name);
        } catch {
          setError("Failed to upload photo. Please try again.");
          return;
        } finally {
          setUploadingPhoto(false);
        }
      }

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
          description: description.trim(),
          building: `${resolvedRoom.building}, Room ${roomInput.trim()}`,
          roomDetail: `${roomInput.trim()}, ${resolvedRoom.label}`,
          photoUrl,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || data.message || "Failed to submit complaint.");
        return;
      }
      router.replace(`/complaint-success?ticketId=${data.ticketId}&complaintId=${data.complaintId}` as any);
    } catch (err: any) {
      if (err?.message?.includes("Network request failed")) {
        setError(
          "Cannot reach server. Make sure you're on the same WiFi network.",
        );
      } else {
        setError("Failed to submit. Please check your connection.");
      }
    } finally {
      setSubmitting(false);
      setUploadingPhoto(false);
    }
  };

const selectedCategoryObj = masterData?.categories.find(
    (c) => c.name.toLowerCase() === selectedCategory.toLowerCase()
  );
  const subIssues = selectedCategoryObj?.subCategories.map((s) => s.name) ?? [];
  const categories = masterData?.categories ?? [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#e8f5e9" />
      <View style={s.root}>
        <View style={s.heroSection}>
          <View style={s.header}>
            <TouchableOpacity
              onPress={() => router.replace("/" as any)}
              style={s.backBtn}
            >
              <Ionicons name="arrow-back" size={18} color="#0f172a" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Report Issue</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={s.progressDots}>
            <View style={[s.dot, s.dotActive]} />
            <View style={s.dot} />
            <View style={s.dot} />
          </View>
          <Text style={s.pageTitle}>{"What's the issue?"}</Text>
          <Text style={s.pageSubtitle}>
            Please provide details about the maintenance request.
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.sectionLabel}>SELECT CATEGORY</Text>
<ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.catScroll}
          >
            {masterLoading ? (
              <Text style={{ color: "#94a3b8", fontSize: 13, paddingVertical: 10 }}>Loading…</Text>
            ) : (
              categories.map((cat) => {
                const active = selectedCategory === cat.name.toLowerCase();
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[s.catChip, active && s.catChipActive]}
                    onPress={() => {
                      setSelectedCategory(cat.name.toLowerCase());
                      setSubIssue("");
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={cat.iconName as keyof typeof Ionicons.glyphMap}
                      size={15}
                      color={active ? "#ffffff" : "#374151"}
                    />
                    <Text style={[s.catChipText, active && s.catChipTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

        {selectedCategory === "washroom" && masterData && (
            <View style={s.washroomNote}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color="#1d4ed8"
                style={{ marginRight: 6, marginTop: 1 }}
              />
              <Text style={s.washroomNoteText}>
                Washroom requests are assigned to staff based on your gender for
                privacy.
              </Text>
            </View>
          )}

          {subIssues.length > 0 && (
            <>
              <Text style={s.fieldLabel}>Specific Issue</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 4 }}
              >
                {subIssues.map((issue) => (
                  <TouchableOpacity
                    key={issue}
                    style={[s.subChip, subIssue === issue && s.subChipActive]}
                    onPress={() => setSubIssue(subIssue === issue ? "" : issue)}
                  >
                    <Text
                      style={[
                        s.subChipText,
                        subIssue === issue && s.subChipTextActive,
                      ]}
                    >
                      {issue}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={s.fieldLabel}>Location</Text>
          <View
            style={[
              s.locationWrap,
              resolvedRoom
                ? s.locationWrapSuccess
                : roomError
                  ? s.locationWrapError
                  : null,
            ]}
          >
            <Ionicons
              name="location-outline"
              size={16}
              color={resolvedRoom ? "#16a34a" : "#9ca3af"}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={s.locationInput}
              placeholder="Enter room number e.g. 214"
              placeholderTextColor="#9ca3af"
              value={roomInput}
              onChangeText={handleRoomInput}
              autoCapitalize="characters"
              maxLength={5}
            />
          </View>
          {resolvedRoom && (
            <View style={s.resolvedBox}>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color="#16a34a"
                style={{ marginRight: 5 }}
              />
              <Text style={s.resolvedText}>
                Room {roomInput}, {resolvedRoom.label}, {resolvedRoom.building}
              </Text>
            </View>
          )}
          {roomError ? (
            <View style={s.roomErrorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={13}
                color="#dc2626"
                style={{ marginRight: 5 }}
              />
              <Text style={s.roomErrorText}>{roomError}</Text>
            </View>
          ) : null}

          <Text style={s.fieldLabel}>Description</Text>
          <TextInput
            style={s.textarea}
            placeholder="Describe the issue in detail..."
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={s.fieldLabel}>Add Photos</Text>
          <TouchableOpacity
            style={s.photoBox}
            onPress={pickPhoto}
            activeOpacity={0.85}
          >
            {photo ? (
              <View style={s.photoSelected}>
                <View style={s.photoSelectedIcon}>
                  <Ionicons name="image-outline" size={22} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.photoName} numberOfLines={1}>
                    {photo.name}
                  </Text>
                  <Text style={s.photoReady}>Ready to upload</Text>
                </View>
                <Text style={s.changeBtn}>Change</Text>
              </View>
            ) : (
              <View style={s.photoEmpty}>
                <View style={s.cameraIconWrap}>
                  <Ionicons name="camera-outline" size={22} color="#64748b" />
                </View>
                <Text style={s.photoEmptyText}>
                  Upload photo or take a picture
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {error ? (
            <View style={s.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={15}
                color="#dc2626"
                style={{ marginRight: 6 }}
              />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.submitBtn, submitting && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <ActivityIndicator color="#fff" />
                <Text style={s.submitBtnText}>
                  {uploadingPhoto ? "Uploading photo..." : "Submitting..."}
                </Text>
              </View>
            ) : (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text style={s.submitBtnText}>Submit Report</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={s.disclaimer}>
            By submitting, you agree to our maintenance guidelines.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffffff" },
  heroSection: {
    backgroundColor: "#e8f5e9",
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  progressDots: { flexDirection: "row", gap: 6, marginBottom: 16 },
  dot: { width: 24, height: 5, borderRadius: 3, backgroundColor: "#a7d7a9" },
  dotActive: { backgroundColor: "#16a34a", width: 32 },
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  pageSubtitle: { fontSize: 13, color: "#4b5563", lineHeight: 20 },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16a34a",
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 4,
  },
  catScroll: { marginBottom: 4 },
  catChip: {
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
  catChipActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  catChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  catChipTextActive: { color: "#ffffff" },
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
  subChip: {
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  subChipActive: { backgroundColor: "#f0fdf4", borderColor: "#16a34a" },
  subChipText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  subChipTextActive: { color: "#16a34a", fontWeight: "700" },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 18,
  },
  locationWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
  },
  locationWrapSuccess: { borderColor: "#16a34a", backgroundColor: "#f0fdf4" },
  locationWrapError: { borderColor: "#ef4444" },
  locationInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 13,
  },
  resolvedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  resolvedText: { fontSize: 13, color: "#16a34a", fontWeight: "600" },
  roomErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  roomErrorText: { fontSize: 12, color: "#dc2626" },
  textarea: {
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
  photoBox: {
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
  photoEmpty: { alignItems: "center", gap: 10 },
  cameraIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  photoEmptyText: { fontSize: 13, color: "#94a3b8", fontWeight: "500" },
  photoSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  photoSelectedIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  photoName: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  photoReady: { fontSize: 12, color: "#16a34a", marginTop: 2 },
  changeBtn: { color: "#16a34a", fontSize: 13, fontWeight: "700" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "500", flex: 1 },
  submitBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 28,
  },
  btnDisabled: { opacity: 0.55 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disclaimer: {
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 14,
  },
});