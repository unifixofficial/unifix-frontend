import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getAdminToken(): Promise<string> {
  const token = await AsyncStorage.getItem("unifix_access_token");
  if (!token) throw new Error("Not authenticated");
  return token;
}