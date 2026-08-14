import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="admin-dashboard" />
      <Stack.Screen name="AdminComplaintsScreen" />
      <Stack.Screen name="AdminHistoryScreen" />
      <Stack.Screen name="AdminHomeScreen" />
      <Stack.Screen name="AdminProfileScreen" />
      <Stack.Screen name="DeletionsScreen" />
      <Stack.Screen name="IdCardsScreen" />
      <Stack.Screen name="MaintenanceScreen" />
      <Stack.Screen name="SecurityScreen" />
      <Stack.Screen name="StaffUsersScreen" />
    </Stack>
  );
}