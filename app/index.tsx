// app/index.tsx
import { Redirect } from "expo-router";

export default function Index() {
    // This file just acts as a silent traffic controller
    // Your RootLayout logic will take over from here
    return <Redirect href="/(auth)/login" />;
}