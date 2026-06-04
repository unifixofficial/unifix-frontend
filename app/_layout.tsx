import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  Animated,
  BackHandler,
  InteractionManager,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { auth, db } from "../firebase/firebaseConfig";

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

const EXIT_ROUTES = ["/", "/staff-dashboard", "/admin-dashboard"];

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
    const user = auth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;
    const res = await fetch(`${BASE_URL}/auth/save-push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ expoPushToken: token }),
    });
    const data = await res.json();
    console.log("[Push] Save token response:", data);
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
        <Animated.Text style={[splashStyles.from, { opacity }]}>from</Animated.Text>
        <Animated.Text style={[splashStyles.name, { opacity }]}>VCET</Animated.Text>
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
  const currentRouteRef = useRef<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null,
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
          { cancelable: true },
        );
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let authUnsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      try {
        const cachedUserStr = await AsyncStorage.getItem("unifix_cached_user");
        const cachedUser = cachedUserStr ? JSON.parse(cachedUserStr) : null;

        if (
          cachedUser &&
          cachedUser.uid &&
          cachedUser.role &&
          cachedUser.route
        ) {
          currentRouteRef.current = cachedUser.route;
          setInitialRoute(cachedUser.route);
          setAppReady(true);
        }

        authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          try {
            if (!firebaseUser) {
              await AsyncStorage.removeItem("unifix_cached_user");
              currentRouteRef.current = "/login";
              setInitialRoute("/login");
              setAppReady(true);
              return;
            }

            let idToken;
            try {
              idToken = await firebaseUser.getIdToken(true);
            } catch (tokenError) {
              console.log("Token refresh failed, using cached session");
              return;
            }

            const snap = await getDoc(doc(db, "users", firebaseUser.uid));

            if (!snap.exists() || !snap.data()?.profileCompleted) {
              await AsyncStorage.removeItem("unifix_cached_user");
              currentRouteRef.current = "/complete-profile";
              setInitialRoute("/complete-profile");
              setAppReady(true);
              return;
            }

            const { role, verificationStatus } = snap.data();

            if (role === "staff" && verificationStatus !== "approved") {
              await AsyncStorage.removeItem("unifix_cached_user");
              currentRouteRef.current = "/complete-profile";
              setInitialRoute("/complete-profile");
              setAppReady(true);
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
                uid: firebaseUser.uid,
                role: role,
                route: route,
                cachedAt: Date.now(),
              }),
            );

            const isOnAuthScreen = [
              "/login",
              "/signup",
              "/otp-verification",
            ].includes(currentRouteRef.current ?? "");
            if (!currentRouteRef.current || isOnAuthScreen) {
              currentRouteRef.current = route;
              setInitialRoute(route);
              setAppReady(true);
            }

            const pushToken = await registerForPushNotifications();
            if (pushToken) {
              await savePushTokenToServer(pushToken);
            }
          } catch (err) {
            console.log("Firebase auth error:", err);
            const hasCache = await AsyncStorage.getItem("unifix_cached_user");
            if (!hasCache && !currentRouteRef.current) {
              currentRouteRef.current = "/login";
              setInitialRoute("/login");
              setAppReady(true);
            }
          }
        });
      } catch (err) {
        currentRouteRef.current = "/login";
        setInitialRoute("/login");
        setAppReady(true);
      }
    };

    initAuth();

    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {});

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          const data = response.notification.request.content.data as any;
          if (!data) return;

          const user = auth.currentUser;
          if (!user) return;

          try {
            const snap = await getDoc(doc(db, "users", user.uid));
            if (!snap.exists()) return;

            const { role, verificationStatus } = snap.data();

            if (role === "staff" && verificationStatus === "approved") {
              if (data.complaintId) {
                router.push({
                  pathname: "/staff-dashboard",
                  params: { openComplaintId: data.complaintId },
                } as any);
              } else if (data.type === "new_lost_found") {
                router.push({
                  pathname: "/staff-dashboard",
                  params: { openTab: "lostfound", openLFTab: "feed" },
                } as any);
              } else if (data.type === "item_handed_over") {
                router.push({
                  pathname: "/staff-dashboard",
                  params: { openTab: "lostfound", openLFTab: "claims" },
                } as any);
              } else {
                router.push("/staff-dashboard" as any);
              }
            } else if (role === "admin") {
              router.push("/admin-dashboard" as any);
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
        },
      );

    return () => {
      if (authUnsubscribe) authUnsubscribe();
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

useEffect(() => {
    setTimeout(() => setMinSplashDone(true), 1500);
  }, []);

  useEffect(() => {
    if (appReady && initialRoute && minSplashDone) {
      InteractionManager.runAfterInteractions(() => {
        router.replace(initialRoute as any);
      });
    }
  }, [appReady, initialRoute, minSplashDone]);

  if (!appReady || !minSplashDone) {
    return <UnifixSplash />;
  }
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="otp-verification" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="complete-profile" />
        <Stack.Screen name="submit-complaint" />
        <Stack.Screen name="complaint-success" />
        <Stack.Screen name="my-complaints" />
        <Stack.Screen name="staff-dashboard" />
        <Stack.Screen name="report-ragging" />
        <Stack.Screen name="admin-dashboard" />
        <Stack.Screen
          name="terms-and-conditions"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
      <Toast />
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
