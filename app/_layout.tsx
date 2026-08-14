import { getAccessToken, clearAuthTokens } from '@/utils/secureAuth';
import { loadUserCache, clearUserCache, saveUserCache } from '@/utils/cache';
import { mmkvDelete } from '@/utils/mmkv';
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import {
  getMessaging,
  getToken,
  requestPermission,
  onTokenRefresh,
  onMessage,
  setBackgroundMessageHandler,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";
import { Stack, useRouter } from "expo-router";
import * as Updates from "expo-updates";
import { useEffect, useRef, useState } from "react";

import NetInfo from "@react-native-community/netinfo";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Animated,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getDb } from "../db/database";

import Toast from "react-native-toast-message";

import { authAPI } from "../services/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#16a34a",
    sound: "default",
  });
}

const EXIT_ROUTES = [
  "/(student)/Home",
  "/(staff)/staff-dashboard",
  "/(admin)/admin-dashboard",
];
async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#16a34a",
        sound: "default",
      });
    }

    const m = getMessaging();
    const authStatus = await requestPermission(m);
    const granted =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (!granted) {
      console.warn("[Push] FCM permission not granted");
      return null;
    }

    const fcmToken = await getToken(m);
    if (!fcmToken) {
      console.warn("[Push] No FCM token returned");
      return null;
    }

    return fcmToken;
  } catch (e) {
    console.error("[Push] Registration error:", e);
    return null;
  }
}

async function savePushTokenToServer(token: string) {
  try {
    console.log("[Push] Registering FCM token");
    await authAPI.savePushToken(token);
    console.log("[Push] FCM token saved successfully");
  } catch (e) {
    console.error("[Push] Save token error:", e);
  }
}

export default function RootLayout() {
  const router = useRouter();
  const currentRouteRef = useRef<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [exitModalVisible, setExitModalVisible] = useState(false);

  useEffect(() => {
    if (__DEV__) return;
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
     if (update.isAvailable) {
          const result = await Updates.fetchUpdateAsync();
          if (result.isNew) {
            setUpdateDownloaded(true);
          }
        }
      } catch {}
    };
    checkForUpdates();
  }, []);

  const handleApplyUpdate = async () => {
    setUpdatingApp(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setUpdatingApp(false);
    }
  };

  useEffect(() => {
    if (Platform.OS !== "android") return;

const onBackPress = () => {
      const route = currentRouteRef.current;
      if (route && EXIT_ROUTES.includes(route)) {
        setExitModalVisible(true);
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const m = getMessaging();

    getDb().catch(() => {});

    const foregroundUnsub = onMessage(m, async (remoteMessage) => {
      const title = remoteMessage.notification?.title ?? remoteMessage.data?.title as string;
      const body = remoteMessage.notification?.body ?? remoteMessage.data?.body as string;
      if (!title && !body) return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title ?? "",
          body: body ?? "",
          data: remoteMessage.data ?? {},
          sound: "default",
        },
        trigger: null,
      });
    });

    const tokenRefreshUnsub = onTokenRefresh(m, async (newToken: string) => {
      await savePushTokenToServer(newToken);
    });

    setBackgroundMessageHandler(m, async () => {});

    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {});

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(async (response) => {
        const data = response.notification.request.content.data as any;
        if (!data) return;

        try {
          const cached = loadUserCache();
          if (!cached) return;

          const { role, verificationStatus } = cached;

          if (role === "staff" && verificationStatus === "approved") {
            if (data.complaintId) {
              router.replace({
                pathname: "/staff-dashboard",
                params: { openComplaintId: data.complaintId },
              } as any);
            } else if (data.type === "new_lost_found") {
              router.replace({
                pathname: "/staff-dashboard",
                params: { openTab: "lostfound", openLFTab: "feed" },
              } as any);
            } else if (data.type === "item_handed_over") {
              router.replace({
                pathname: "/staff-dashboard",
                params: { openTab: "lostfound", openLFTab: "claims" },
              } as any);
            } else {
              router.replace("/staff-dashboard" as any);
            }
          } else if (role === "admin") {
            if (data.type === "new_staff_signup") {
              setTimeout(
                () => router.push("/(admin)/MaintenanceScreen" as any),
                100
              );
            } else if (data.type === "new_security_issue") {
              router.push("/(admin)/SecurityScreen" as any);
            } else if (data.type === "new_deletion_request") {
              router.push("/(admin)/DeletionsScreen" as any);
            } else if (data.type === "new_idcard_request") {
              router.push("/(admin)/IdCardsScreen" as any);
            } else if (
              data.type === "complaint_escalated" ||
              data.complaintId
            ) {
              router.push({
                pathname: "/admin-dashboard",
                params: { openTab: "complaints" },
              } as any);
            } else {
              router.push("/admin-dashboard" as any);
            }
          } else {
            if (
              data.type === "complaint_completed" ||
              data.type === "complaint_accepted" ||
              data.type === "complaint_in_progress" ||
              data.type === "complaint_rejected" ||
              data.type === "complaint_escalated" ||
              data.complaintId
            ) {
              router.push({
                pathname: "/(student)/Home",
                params: {
                  openTab: "complaints",
                  openComplaintId: data.complaintId || null,
                },
              } as any);
            } else if (
              data.type === "new_lost_found" ||
              data.type === "item_handed_over" ||
              data.type === "new_lost_report" ||
              data.type === "lost_report_found"
            ) {
              const lfTab =
                data.type === "new_lost_found"
                  ? "feed"
                  : data.type === "item_handed_over"
                  ? "claims"
                  : data.type === "new_lost_report"
                  ? "lostreports"
                  : "lost-history";
              router.push({
                pathname: "/(student)/Home",
                params: { openTab: "lostfound", openLFTab: lfTab },
              } as any);
            } else {
              router.push("/(student)/Home" as any);
            }
          }
        } catch {
          router.push("/(student)/Home" as any);
        }
      });

    return () => {
      foregroundUnsub();
      tokenRefreshUnsub();
      if (notificationListener.current)
        notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  useEffect(() => {
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      if (error?.message === "SESSION_EXPIRED") {
        clearAuthTokens().then(() => {
          clearUserCache();
          mmkvDelete("unifix_active_tab");
          mmkvDelete("unifix_staff_active_tab");
          mmkvDelete("unifix_admin_active_tab");
        router.replace("/(auth)/login" as any);
        });
        return;
      }
      originalHandler(error, isFatal);
    });
    return () => {
      ErrorUtils.setGlobalHandler(originalHandler);
    };
  }, []);

  return (
 <>
      <ConfirmModal
        visible={exitModalVisible}
        variant="confirm"
        title="Exit App"
        message="Are you sure you want to exit?"
        confirmText="Exit"
        cancelText="Cancel"
        destructive
        onCancel={() => setExitModalVisible(false)}
        onConfirm={() => { setExitModalVisible(false); BackHandler.exitApp(); }}
      />
      <Modal
        visible={updateDownloaded}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={updateStyles.overlay}>
          <View style={updateStyles.card}>
            <View style={updateStyles.iconWrap}>
              <Text style={updateStyles.iconText}>🎉</Text>
            </View>
            <Text style={updateStyles.title}>Update Available</Text>
            <Text style={updateStyles.desc}>
              A new version of UniFiX is ready. Restart now to get the latest
              features and improvements.
            </Text>
            <Pressable
              style={[updateStyles.btn, updatingApp && updateStyles.btnDisabled]}
              onPress={handleApplyUpdate}
              disabled={updatingApp}
            >
              <Text style={updateStyles.btnText}>
                {updatingApp ? "Restarting..." : "Restart Now"}
              </Text>
            </Pressable>
            <Pressable
              style={updateStyles.laterBtn}
              onPress={() => setUpdateDownloaded(false)}
              disabled={updatingApp}
            >
              <Text style={updateStyles.laterText}>Later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(student)" options={{ headerShown: false }} />
        <Stack.Screen name="(staff)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen
          name="legal/terms-and-conditions"
          options={{ headerShown: false }}
        />
      </Stack>
      <Toast />
    </>
  );
}

const updateStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconText: { fontSize: 28 },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  btn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  laterBtn: {
    paddingVertical: 10,
    alignItems: "center",
    width: "100%",
  },
  laterText: { color: "#94a3b8", fontSize: 14, fontWeight: "500" },
});
