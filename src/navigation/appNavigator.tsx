import React from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Home from "../screens/Home";
import RecordScreen from "../screens/RecordScreen";
import AddEditRecordScreen from "../screens/AddEditRecordScreen";
import Authentication from "../screens/auth/Authentication";
import SetupMasterPassword from "../screens/auth/SetupMasterPassword";
import Settings from "../screens/settings/Settings";

import useAuthStore from "../store/authStore";
import type { RootStackParamList } from "../types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Imperative handle for auth-driven navigation. On lock, AutoLockGate resets
// the whole stack to Authentication in ONE place — screens must not guard
// themselves with navigation.replace, which used to fire once per mounted
// screen and leak stacked Authentication routes on every lock cycle.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Every screen draws its own top row on the themed Screen root, so the
// native stack header is never shown.
const AppNavigator: React.FC = () => {
  const needsSetup = useAuthStore((state) => state.needsSetup);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={needsSetup ? "SetupMasterPassword" : "Authentication"}
        screenOptions={{
          headerShown: false,
          // Transparent so the Screen root's own background shows during
          // transitions in both themes.
          contentStyle: { backgroundColor: "transparent" },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="SetupMasterPassword" component={SetupMasterPassword} />
        <Stack.Screen name="Authentication" component={Authentication} />
        <Stack.Screen name="Home" component={Home} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Record" component={RecordScreen} />
        <Stack.Screen name="AddEditRecord" component={AddEditRecordScreen} />
        <Stack.Screen name="Settings" component={Settings} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
