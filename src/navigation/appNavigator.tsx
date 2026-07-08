import React from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Home from "../screens/Home";
import Authentication from "../screens/auth/Authentication";
import SetupMasterPassword from "../screens/auth/SetupMasterPassword";
import CredentialsList from "../screens/credentials/CredentialsList";
import AddCredential from "../screens/credentials/AddCredential";
import ViewCredential from "../screens/credentials/ViewCredential";
import PersonalInfoList from "../screens/personalInfo/PersonalInfoList";
import AddPersonalInfo from "../screens/personalInfo/AddPersonalInfo";
import ViewPersonalInfo from "../screens/personalInfo/ViewPersonalInfo";
import NotesList from "../screens/notes/NotesList";
import AddNote from "../screens/notes/AddNote";
import ViewNote from "../screens/notes/ViewNote";
import Settings from "../screens/settings/Settings";

import Header from "../components/layouts/Header";
import useAuthStore from "../store/authStore";
import type { RootStackParamList } from "../types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Imperative handle for auth-driven navigation. On lock, AutoLockGate resets
// the whole stack to Authentication in ONE place — screens must not guard
// themselves with navigation.replace, which used to fire once per mounted
// screen and leak stacked Authentication routes on every lock cycle.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const needsSetup = useAuthStore((state) => state.needsSetup);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={needsSetup ? "SetupMasterPassword" : "Authentication"}
        screenOptions={({ route }) => ({
          header: ({ navigation, options }) => {
            const isHome = route.name === "Home";

            return (
              <Header
                title={options.title || route.name}
                showBackButton={!isHome}
                showLogo={isHome}
                showSettings={isHome}
                onBackPress={() => navigation.goBack()}
              />
            );
          },
          contentStyle: { backgroundColor: "#FFFFFF" },
          animation: "slide_from_right",
        })}
      >
        <Stack.Screen
          name="SetupMasterPassword"
          component={SetupMasterPassword}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Authentication"
          component={Authentication}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={Home}
          options={{
            headerShown: true,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="CredentialsList"
          component={CredentialsList}
          options={{ title: "Credentials" }}
        />
        <Stack.Screen
          name="AddCredential"
          component={AddCredential}
          options={{ title: "Add Credential" }}
        />
        <Stack.Screen
          name="ViewCredential"
          component={ViewCredential}
          options={{ title: "Credential Details" }}
        />
        <Stack.Screen
          name="PersonalInfoList"
          component={PersonalInfoList}
          options={{ title: "Personal Information" }}
        />
        <Stack.Screen
          name="AddPersonalInfo"
          component={AddPersonalInfo}
          options={{ title: "Add Personal Info" }}
        />
        <Stack.Screen
          name="ViewPersonalInfo"
          component={ViewPersonalInfo}
          options={{ title: "Info Details" }}
        />
        <Stack.Screen
          name="NotesList"
          component={NotesList}
          options={{ title: "Notes" }}
        />
        <Stack.Screen
          name="AddNote"
          component={AddNote}
          options={{ title: "Add Note" }}
        />
        <Stack.Screen
          name="ViewNote"
          component={ViewNote}
          options={{ title: "Note Details" }}
        />
        <Stack.Screen
          name="Settings"
          component={Settings}
          options={{ title: "Settings" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
