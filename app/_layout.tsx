import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import NetInfo from "@react-native-community/netinfo";
import {
  Alert,
  Animated,
  BackHandler,
  InteractionManager,
  Platform,
  StyleSheet,
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
    shouldShowAlert: true,
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

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#16a34a",
        sound: "default",
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn("[Push] No projectId found in config");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (e) {
    console.error("[Push] Registration error:", e);
    return null;
  }
}

async function savePushTokenToServer(token: string) {
  try {
    await authAPI.savePushToken(token);
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
  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (initialRoute) currentRouteRef.current = initialRoute;
  }, [initialRoute]);

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
        const cachedUserStr = await AsyncStorage.getItem("unifix_cached_user");
        const cachedUser = cachedUserStr ? JSON.parse(cachedUserStr) : null;

        if (cachedUser && cachedUser.uid && cachedUser.role && cachedUser.route) {
          currentRouteRef.current = cachedUser.route;
          setInitialRoute(cachedUser.route);
          setCachedRole(cachedUser.role);
          setAppReady(true);
        }

        const accessToken = await AsyncStorage.getItem("unifix_access_token");

        if (!accessToken) {
          await AsyncStorage.removeItem("unifix_cached_user");
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
          const pushToken = await registerForPushNotifications();
          if (pushToken) savePushTokenToServer(pushToken);
          return;
        }

        let profile: any = null;
        try {
          const res = await authAPI.myProfile();
          profile = res?.data?.profile ?? res?.profile ?? null;
        } catch (err: any) {
          const netState = await NetInfo.fetch();
          const online = !!(
            netState.isConnected && netState.isInternetReachable
          );

          if (!online && alreadyRouted) {
            return;
          }

          await AsyncStorage.multiRemove([
            "unifix_access_token",
            "unifix_refresh_token",
            "unifix_cached_user",
          ]);
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
          await AsyncStorage.multiRemove([
            "unifix_access_token",
            "unifix_refresh_token",
            "unifix_cached_user",
          ]);
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
          await AsyncStorage.removeItem("unifix_cached_user");
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
          await AsyncStorage.removeItem("unifix_cached_user");
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

        await AsyncStorage.setItem(
          "unifix_cached_user",
          JSON.stringify({
            uid: profile.id,
            role,
            route,
            cachedAt: Date.now(),
          })
        );

        if (!alreadyRouted) {
          currentRouteRef.current = route;
          setInitialRoute(route);
          setAppReady(true);
        } else if (route !== currentRouteRef.current) {
          router.replace(route as any);
        }

        const pushToken = await registerForPushNotifications();
        if (pushToken) savePushTokenToServer(pushToken);
      } catch (err) {
        currentRouteRef.current = "/login";
        setInitialRoute("/login");
        setAppReady(true);
      }
    };

    getDb().catch(() => {});
    initAuth();

    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {});

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(async (response) => {
        const data = response.notification.request.content.data as any;
        if (!data) return;

        try {
          const cachedStr = await AsyncStorage.getItem("unifix_cached_user");
          const cached = cachedStr ? JSON.parse(cachedStr) : null;
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
        AsyncStorage.multiRemove([
          "unifix_cached_user",
          "unifix_active_tab",
          "unifix_staff_active_tab",
          "unifix_admin_active_tab",
        ]).then(() => {
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
      InteractionManager.runAfterInteractions(() => {
        router.replace(initialRoute as any);
        setTimeout(() => {
          Animated.timing(skeletonAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }).start(() => setSkeletonVisible(false));
        }, 300);
      });
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

  if (!appReady || !minSplashDone) {
    return getRoleSkeletonOrSplash();
  }

  return (
    <>
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