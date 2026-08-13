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
import { useCallback, useEffect, useRef, useState } from "react";

import NetInfo from "@react-native-community/netinfo";
import {
  Alert,
  Animated,
  BackHandler,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getDb } from "../db/database";

import Toast from "react-native-toast-message";
import {
  AdminDashboardSkeleton,
  DashboardSkeleton,
  StaffDashboardSkeleton,
} from "../components/skeleton";
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
  "/",
  "/(student)/index",
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

function UnifixSplash() {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={splashStyles.container}>
      <Animated.Image
        source={require("../assets/1.png")}
        style={[splashStyles.logo, { opacity }]}
        resizeMode="contain"
      />
      <View style={splashStyles.footer}>
        <Animated.Text style={[splashStyles.from, { opacity }]}>
          from
        </Animated.Text>
        <Animated.Text style={[splashStyles.name, { opacity }]}>
          VCET
        </Animated.Text>
      </View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  logo: {
    width: 180,
    height: 180,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    alignItems: "center",
    gap: 2,
  },
  from: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "400",
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
    color: "#16a34a",
    letterSpacing: 2,
  },
});

export default function RootLayout() {
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const hasNavigatedRef = useRef(false);
  const showRoleOverlayRef = useRef<((role: string) => void) | null>(null);
  const [cachedRole, setCachedRole] = useState<string | null>(null);
  const currentRouteRef = useRef<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);

  useEffect(() => {
    if (initialRoute) currentRouteRef.current = initialRoute;
  }, [initialRoute]);

  useEffect(() => {
    if (__DEV__) return;
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setUpdateAvailable(true);
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
        Alert.alert(
          "Exit App",
          "Are you sure you want to exit?",
          [
            { text: "Cancel", style: "cancel", onPress: () => {} },
            {
              text: "OK",
              style: "destructive",
              onPress: () => BackHandler.exitApp(),
            },
          ],
          { cancelable: true }
        );
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
      const cachedUser = loadUserCache();

if (cachedUser && cachedUser.uid && cachedUser.role && cachedUser.route) {
          currentRouteRef.current = cachedUser.route;
          setInitialRoute(cachedUser.route);
          setCachedRole(cachedUser.role);
          setAppReady(true);
        }
     const accessToken = await getAccessToken();

        if (!accessToken) {
          clearUserCache();
          if (!currentRouteRef.current) {
            currentRouteRef.current = "/login";
            setInitialRoute("/login");
            setAppReady(true);
          } else {
            router.replace("/login" as any);
          }
          return;
        }

        const alreadyRouted = !!currentRouteRef.current;
        const cacheAgeMs = cachedUser?.cachedAt
          ? Date.now() - cachedUser.cachedAt
          : Infinity;
        const CACHE_TTL = 30 * 60 * 1000;

if (alreadyRouted && cacheAgeMs < CACHE_TTL) {
          setAppReady(true);
          try {
            const pushToken = await registerForPushNotifications();
            if (pushToken) await authAPI.savePushToken(pushToken).catch(() => {});
          } catch {}
          return;
        }

        const netState = await NetInfo.fetch();
        const online = !!(netState.isConnected && netState.isInternetReachable);

        if (!online && alreadyRouted) {
          return;
        }

        if (!online && !alreadyRouted && cachedUser?.uid && cachedUser?.route) {
          currentRouteRef.current = cachedUser.route;
          setInitialRoute(cachedUser.route);
          setAppReady(true);
          return;
        }

        let profile: any = null;
        try {
          const res = await authAPI.myProfile();
          profile = res?.data?.profile ?? res?.profile ?? null;
        } catch (err: any) {
          const netState2 = await NetInfo.fetch();
          const stillOnline = !!(netState2.isConnected && netState2.isInternetReachable);

          if (!stillOnline && alreadyRouted) {
            return;
          }

    await clearAuthTokens();
          clearUserCache();
          if (!alreadyRouted) {
            currentRouteRef.current = "/login";
            setInitialRoute("/login");
            setAppReady(true);
          } else {
            router.replace("/login" as any);
          }
          return;
        }

        if (!profile) {
          await clearAuthTokens();
          clearUserCache();
          if (!alreadyRouted) {
            currentRouteRef.current = "/login";
            setInitialRoute("/login");
            setAppReady(true);
          } else {
            router.replace("/login" as any);
          }
          return;
        }

        if (!profile.profileCompleted) {
          clearUserCache();
          const target = "/complete-profile";
          if (!alreadyRouted) {
            currentRouteRef.current = target;
            setInitialRoute(target);
            setAppReady(true);
          } else {
            router.replace(target as any);
          }
          return;
        }

        const { role, verificationStatus } = profile;

      if (role === "staff" && verificationStatus !== "approved") {
          clearUserCache();
          const target = "/complete-profile";
          if (!alreadyRouted) {
            currentRouteRef.current = target;
            setInitialRoute(target);
            setAppReady(true);
          } else {
            router.replace(target as any);
          }
          return;
        }

        const route =
          role === "admin"
            ? "/admin-dashboard"
            : role === "staff" && verificationStatus === "approved"
            ? "/staff-dashboard"
            : "/";

 saveUserCache({
          uid: profile.id,
          role,
          route,
          fullName: profile.fullName || "",
          email: profile.email || "",
        });

if (!hasNavigatedRef.current) {
          currentRouteRef.current = route;
          setInitialRoute(route);
          setCachedRole(role);
          setAppReady(true);
        } else if (route !== currentRouteRef.current) {
          router.replace(route as any);
        }

        try {
          const pushToken = await registerForPushNotifications();
          if (pushToken) savePushTokenToServer(pushToken);
        } catch {}
      } catch (err) {
        currentRouteRef.current = "/login";
        setInitialRoute("/login");
        setAppReady(true);
      }
    };

    getDb().catch(() => {});
    initAuth();

  const m = getMessaging();

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
      console.log("[Push] FCM token refreshed");
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
                pathname: "/",
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
                pathname: "/",
                params: { openTab: "lostfound", openLFTab: lfTab },
              } as any);
            } else {
              router.push("/" as any);
            }
          }
        } catch {
          router.push("/" as any);
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
    setTimeout(() => setMinSplashDone(true), 200);
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
          router.replace("/login" as any);
        });
        return;
      }
      originalHandler(error, isFatal);
    });
    return () => {
      ErrorUtils.setGlobalHandler(originalHandler);
    };
  }, []);

useEffect(() => {
    if (appReady && initialRoute && minSplashDone && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      setTimeout(() => {
        Animated.timing(skeletonAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => setSkeletonVisible(false));
      }, 100);
    }
  }, [appReady, initialRoute, minSplashDone]);

  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const skeletonAnim = useRef(new Animated.Value(1)).current;
  const [overlayRole, setOverlayRole] = useState<string | null>(null);

  const showRoleOverlay = useCallback((role: string) => {
    setOverlayRole(role);
    setSkeletonVisible(true);
    skeletonAnim.setValue(1);
    setTimeout(() => {
      Animated.timing(skeletonAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setSkeletonVisible(false));
    }, 800);
  }, []);

  useEffect(() => {
    showRoleOverlayRef.current = showRoleOverlay;
    (global as any).__unifixShowRoleOverlay = showRoleOverlay;
  }, [showRoleOverlay]);

  useEffect(() => {
    if (appReady && minSplashDone && hasNavigatedRef.current) {
      setSkeletonVisible(false);
      skeletonAnim.setValue(0);
    }
  }, [appReady, minSplashDone]);

  function getRoleSkeletonOrSplash() {
    if (cachedRole === "staff") return <StaffDashboardSkeleton />;
    if (cachedRole === "admin") return <AdminDashboardSkeleton />;
    if (cachedRole === "student" || cachedRole === "teacher")
      return <DashboardSkeleton />;
    return <UnifixSplash />;
  }

if (!appReady || !minSplashDone || !initialRoute) {
    return getRoleSkeletonOrSplash();
  }
  return (
    <>
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
      <Stack
        screenOptions={{ headerShown: false }}
        initialRouteName={
          initialRoute === "/admin-dashboard"
            ? "(admin)/admin-dashboard"
            : initialRoute === "/staff-dashboard"
            ? "(staff)/staff-dashboard"
            : initialRoute === "/login"
            ? "(auth)/login"
            : initialRoute === "/complete-profile"
            ? "(auth)/complete-profile"
            : "(student)/index"
        }
      >
        <Stack.Screen name="(student)/index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/signup" />
        <Stack.Screen name="(auth)/otp-verification" />
        <Stack.Screen name="(auth)/reset-password" />
        <Stack.Screen name="(auth)/complete-profile" />
        <Stack.Screen name="(auth)/select-role" />
        <Stack.Screen name="(student)/submit-complaint" />
        <Stack.Screen name="(student)/complaint-success" />
        <Stack.Screen name="(student)/my-complaints" />
        <Stack.Screen name="(staff)/staff-dashboard" />
        <Stack.Screen name="(student)/report-ragging" />
        <Stack.Screen name="(admin)/admin-dashboard" />
        <Stack.Screen name="(admin)/MaintenanceScreen" />
        <Stack.Screen name="(admin)/StaffUsersScreen" />
        <Stack.Screen name="(admin)/IdCardsScreen" />
        <Stack.Screen name="(admin)/DeletionsScreen" />
        <Stack.Screen name="(admin)/SecurityScreen" />
        <Stack.Screen
          name="legal/terms-and-conditions"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="(student)/modal"
          options={{ presentation: "modal" }}
        />
      </Stack>
      <Toast />
      {skeletonVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { opacity: skeletonAnim, zIndex: 999, backgroundColor: "white" },
          ]}
        >
          {null}
        </Animated.View>
      )}
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

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 60,
    paddingTop: 0,
  },
  splashCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  vcetContainer: {
    alignItems: "center",
    gap: 4,
  },
  vcetFrom: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "400",
  },
  vcetText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#16a34a",
    letterSpacing: 2,
  },
});