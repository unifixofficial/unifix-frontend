import { Stack } from "expo-router";

export default function StaffLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="staff-dashboard" />
      <Stack.Screen name="staff-found" />
      <Stack.Screen name="staff-history" />
      <Stack.Screen name="staff-profile" />
    </Stack>
  );
}