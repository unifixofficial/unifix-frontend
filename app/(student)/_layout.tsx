import { Stack } from "expo-router";

export default function StudentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" />
      <Stack.Screen name="submit-complaint" />
      <Stack.Screen name="complaint-success" />
      <Stack.Screen name="my-complaints" />
      <Stack.Screen name="report-ragging" />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}