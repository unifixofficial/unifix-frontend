import { Ionicons } from "@expo/vector-icons";
import { setAccessToken, setRefreshToken } from '@/utils/secureAuth';
import { saveUserCache } from '@/utils/cache';
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { getAuth, GoogleAuthProvider, signInWithCredential } from "@react-native-firebase/auth";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { authAPI } from "../../services/api";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!;

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, offlineAccess: false });
  }, []);

const navigateByUser = async (userData: any, token: string, refreshToken: string) => {
    await setAccessToken(token);
    await setRefreshToken(refreshToken);

    let route = "/(student)/Home";
    if (userData.role === "admin") {
      route = "/(admin)/admin-dashboard";
    } else if (userData.role === "staff" && userData.verificationStatus === "approved") {
      route = "/(staff)/staff-dashboard";
    } else if (!userData.profileCompleted) {
      route = "/(auth)/complete-profile";
    }

saveUserCache({
      uid: userData.uid,
      role: userData.role,
      route,
      fullName: userData.fullName || "",
      email: userData.email || "",
      phone: userData.phone || null,
      gender: userData.gender || null,
      photoUrl: userData.photoUrl || null,
      profileCompleted: userData.profileCompleted || false,
      verificationStatus: userData.verificationStatus || null,
      authProvider: userData.authProvider || "email",
    });
    if ((global as any).__unifixShowRoleOverlay) {
      (global as any).__unifixShowRoleOverlay(userData.role);
    }
    router.replace(route as any);
  };
const handleLogin = async () => {
    setError("");
    setResetMessage("");
    if (!email.trim()) return setError("Please enter your email.");
    if (!password) return setError("Please enter your password.");
    setLoading(true);
    try {
      const data = await authAPI.login(email.trim(), password);
      await navigateByUser(data.user, data.token, data.refreshToken);
    } catch (err: any) {
      if (err.code === "GOOGLE_ACCOUNT") {
        setError("Your email is verified with Google. Please continue with Google.");
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };
  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();
    const googleIdToken = userInfo.data?.idToken;

      if (!googleIdToken) {
        setError("Google sign-in failed. Please try again.");
        return;
      }

      const googleEmail = userInfo.data?.user?.email ?? "";
      if (!googleEmail.endsWith("@vcet.edu.in")) {
        setError("Only VCET email accounts (@vcet.edu.in) are allowed.");
        await GoogleSignin.signOut();
        return;
      }

   const googleCredential = GoogleAuthProvider.credential(googleIdToken);
      const firebaseResult = await signInWithCredential(getAuth(), googleCredential);
      const firebaseIdToken = await firebaseResult.user.getIdToken();

      const data = await authAPI.googleSignIn(firebaseIdToken);
      const userData = data.user ?? data.data?.user;
      const token = data.token ?? data.data?.token;
      const refreshToken = data.refreshToken ?? data.data?.refreshToken;

if (!userData.role) {
        await setAccessToken(token);
        await setRefreshToken(refreshToken);
        saveUserCache({
          uid: userData.uid,
          role: userData.role || "",
          fullName: userData.fullName || "",
          email: userData.email || "",
          phone: userData.phone || null,
          gender: userData.gender || null,
          photoUrl: userData.photoUrl || null,
          profileCompleted: false,
          verificationStatus: userData.verificationStatus || null,
          authProvider: userData.authProvider || "google",
        });
        router.replace("/select-role" as any);
        return;
      }

if (!userData.profileCompleted) {
        await setAccessToken(token);
        await setRefreshToken(refreshToken);
        saveUserCache({
          uid: userData.uid,
          role: userData.role || "",
          fullName: userData.fullName || "",
          email: userData.email || "",
          phone: userData.phone || null,
          gender: userData.gender || null,
          photoUrl: userData.photoUrl || null,
          profileCompleted: false,
          verificationStatus: userData.verificationStatus || null,
          authProvider: userData.authProvider || "google",
        });
        router.replace("/complete-profile" as any);
        return;
      }
      await navigateByUser(userData, token, refreshToken);
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS) {
        return;
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError("Google Play Services not available on this device.");
      } else if (err.code === "EXISTING_PASSWORD_ACCOUNT") {
        setError("This email already has an existing UniFiX account. Please log in using your email and password below.");
      } else {
        setError(err.message || "Sign-in failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

const handleForgotPassword = async () => {
    setError("");
    setResetMessage("");
    if (!email.trim()) return setError("Enter your email above, then tap Forgot Password.");
    setForgotLoading(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setResetMessage("OTP sent to your email!");
      setTimeout(() => {
        router.push({
          pathname: "/otp-verification",
          params: { email: email.trim(), fullName: "User", password: "", role: "", type: "password-reset" },
        });
      }, 1500);
    } catch (err: any) {
      if (err.code === "GOOGLE_ACCOUNT") {
        setError("Your email is verified with Google. Please continue with Google.");
      } else {
        setError(err.message || "Could not send OTP.");
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        contentContainerStyle={s.outer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={s.heroSection}>
          <View style={s.logoWrap}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={s.logoImg}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.formSection}>
          <Text style={s.formTitle}>Welcome to UniFiX</Text>
          <Text style={s.formSubtitle}>Sign in to your account</Text>

          <Text style={s.label}>Email Address</Text>
          <View style={s.inputWrap}>
            <Ionicons name="mail-outline" size={17} color="#9ca3af" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="email@vcet.edu.in"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={s.passwordLabelRow}>
            <Text style={s.label}>Password</Text>
            <TouchableOpacity onPress={handleForgotPassword} disabled={forgotLoading}>
              {forgotLoading ? (
                <ActivityIndicator size="small" color="#16a34a" />
              ) : (
                <Text style={s.forgotText}>Forgot password?</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={17} color="#9ca3af" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="Enter your password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}
          {resetMessage ? (
            <View style={s.successBox}>
              <Text style={s.successText}>{resetMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.loginBtn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Log In</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.signupRow}
            onPress={() => router.replace("/signup")}
          >
            <Text style={s.signupText}>{"Don't have an account? "}</Text>
            <Text style={s.signupLink}>Sign Up</Text>
          </TouchableOpacity>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>or continue with</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity
            style={[s.googleBtn, googleLoading && s.btnDisabled]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color="#374151" />
            ) : (
              <>
            <Svg width={20} height={20} viewBox="0 0 48 48">
                  <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </Svg>
                <Text style={s.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={s.footerWrap}>
          <Text style={s.footerLabel}>By continuing, you agree to our</Text>
          <TouchableOpacity onPress={() => router.push("/legal/terms-and-conditions" as any)}>
            <Text style={s.footerLink}>Terms & Conditions</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  outer: { flexGrow: 1, backgroundColor: "#ffffff", paddingHorizontal: 24, paddingBottom: 32 },
  heroSection: { alignItems: "center", paddingTop: 60, paddingBottom: 24 },
  logoWrap: {
    width: 90, height: 90, borderRadius: 50, backgroundColor: "#f0fdf4",
    borderWidth: 2, borderColor: "#bbf7d0", alignItems: "center", justifyContent: "center",
    overflow: "hidden", shadowColor: "#16a34a", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 4,
  },
  logoImg: { width: 88, height: 88 },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginBottom: 24 },
  formSection: { width: "100%", marginBottom: 20 },
  formTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 4, letterSpacing: -0.3 },
  formSubtitle: { fontSize: 14, color: "#64748b", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8, marginTop: 14 },
  passwordLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1.5, borderColor: "#e2e8f0", paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: "#0f172a", paddingVertical: 14 },
  eyeBtn: { padding: 6 },
  forgotText: { color: "#16a34a", fontSize: 13, fontWeight: "600" },
  errorBox: { backgroundColor: "#fef2f2", borderRadius: 10, padding: 12, marginTop: 14, borderWidth: 1, borderColor: "#fecaca" },
  errorText: { color: "#dc2626", fontSize: 13, textAlign: "center", fontWeight: "500" },
  successBox: { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, marginTop: 14, borderWidth: 1, borderColor: "#bbf7d0" },
  successText: { color: "#16a34a", fontSize: 13, textAlign: "center", fontWeight: "500" },
  loginBtn: { backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 22 },
  btnDisabled: { opacity: 0.55 },
  loginBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },
  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  signupText: { fontSize: 14, color: "#64748b" },
  signupLink: { fontSize: 14, color: "#16a34a", fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#f1f5f9" },
  dividerLabel: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#ffffff", borderRadius: 12, paddingVertical: 14,
    borderWidth: 1.5, borderColor: "#e2e8f0", gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  googleBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  footerWrap: { alignItems: "center", gap: 4, paddingTop: 8 },
  footerLabel: { fontSize: 12, color: "#94a3b8" },
  footerLink: { fontSize: 12, color: "#16a34a", fontWeight: "700", textDecorationLine: "underline" },
});