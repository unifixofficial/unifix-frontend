import { clearUserCache, loadUserCache } from "@/utils/cache";
import { clearAuthTokens, getAccessToken } from "@/utils/secureAuth";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { authAPI } from "../services/api";

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
    <View style={styles.container}>
      <Animated.Image
        source={require("../assets/1.png")}
        style={[styles.logo, { opacity }]}
        resizeMode="contain"
      />
      <View style={styles.footer}>
        <Animated.Text style={[styles.from, { opacity }]}>from</Animated.Text>
        <Animated.Text style={[styles.name, { opacity }]}>VCET</Animated.Text>
      </View>
    </View>
  );
}

export default function Index() {
  const [ready, setReady] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    const resolve = async () => {
      try {
        const cachedUser = loadUserCache();

        const accessToken = await getAccessToken();

        if (!accessToken) {
          clearUserCache();
          router.replace("/(auth)/login" as any);
          return;
        }

        if (cachedUser?.uid && cachedUser?.role && cachedUser?.profileCompleted !== false) {
          const { role, verificationStatus } = cachedUser;
          navigateByRole(role, verificationStatus);
          return;
        }

        let profile: any = null;
        try {
          const res = await authAPI.myProfile();
          profile = res?.data?.profile ?? res?.profile ?? null;
        } catch {
          if (cachedUser?.uid && cachedUser?.role) {
            navigateByRole(cachedUser.role, cachedUser.verificationStatus);
            return;
          }
          await clearAuthTokens();
          clearUserCache();
          router.replace("/(auth)/login" as any);
          return;
        }

        if (!profile) {
          await clearAuthTokens();
          clearUserCache();
          router.replace("/(auth)/login" as any);
          return;
        }

   if (!profile.role) {
          clearUserCache();
          router.replace("/(auth)/select-role" as any);
          return;
        }

        if (!profile.profileCompleted) {
          clearUserCache();
          router.replace("/(auth)/complete-profile" as any);
          return;
        }
        const { role, verificationStatus } = profile;

        if (role === "staff" && verificationStatus !== "approved") {
          clearUserCache();
          router.replace("/(auth)/complete-profile" as any);
          return;
        }

        navigateByRole(role, verificationStatus);
      } catch {
        router.replace("/(auth)/login" as any);
      }
    };

    resolve();
  }, []);

  return <UnifixSplash />;
}

function navigateByRole(role: string, verificationStatus?: string) {
  if (role === "admin") {
    router.replace("/(admin)/admin-dashboard" as any);
  } else if (role === "staff" && verificationStatus === "approved") {
    router.replace("/(staff)/staff-dashboard" as any);
  } else if (role === "student" || role === "teacher") {
    router.replace("/(student)/Home" as any);
  } else {
    router.replace("/(auth)/login" as any);
  }
}

const styles = StyleSheet.create({
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