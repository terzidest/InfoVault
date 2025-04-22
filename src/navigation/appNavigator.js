import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Screens
import Home from '../screens/Home';
import Authentication from '../screens/auth/Authentication';
import CredentialsList from '../screens/credentials/CredentialsList';
import AddCredential from '../screens/credentials/AddCredential';
import ViewCredential from '../screens/credentials/ViewCredential';
import PersonalInfoList from '../screens/personalInfo/PersonalInfoList';
import AddPersonalInfo from '../screens/personalInfo/AddPersonalInfo';
import ViewPersonalInfo from '../screens/personalInfo/ViewPersonalInfo';
import NotesList from '../screens/notes/NotesList';
import AddNote from '../screens/notes/AddNote';
import ViewNote from '../screens/notes/ViewNote';
import Settings from '../screens/settings/Settings';

// Components
import Header from '../components/layouts/Header';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Authentication"
        screenOptions={({ route }) => ({
          header: ({ navigation, options }) => {
            // Determine which type of header to show based on the route
            const isHomeOrAuth = route.name === 'Home' || route.name === 'Authentication';
            
            return (
              <Header
                title={options.title || route.name}
                showBackButton={!isHomeOrAuth}
                showLogo={isHomeOrAuth}
                showSettings={route.name === 'Home'}
                onBackPress={() => navigation.goBack()}
              />
            );
          },
          cardStyle: { backgroundColor: '#FFFFFF' },
          animationEnabled: true,
        })}
      >
        <Stack.Screen
          name="Authentication"
          component={Authentication}
          options={{ 
            headerShown: true,
            title: '',
          }}
        />
        <Stack.Screen
          name="Home" 
          component={Home} 
          options={{ 
            headerShown: true,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="CredentialsList" component={CredentialsList} options={{ title: 'Credentials' }} />
        <Stack.Screen name="AddCredential" component={AddCredential} options={{ title: 'Add Credential' }} />
        <Stack.Screen name="ViewCredential" component={ViewCredential} options={{ title: 'Credential Details' }} />
        <Stack.Screen name="PersonalInfoList" component={PersonalInfoList} options={{ title: 'Personal Information' }} />
        <Stack.Screen name="AddPersonalInfo" component={AddPersonalInfo} options={{ title: 'Add Personal Info' }} />
        <Stack.Screen name="ViewPersonalInfo" component={ViewPersonalInfo} options={{ title: 'Info Details' }} />
        <Stack.Screen name="NotesList" component={NotesList} options={{ title: 'Notes' }} />
        <Stack.Screen name="AddNote" component={AddNote} options={{ title: 'Add Note' }} />
        <Stack.Screen name="ViewNote" component={ViewNote} options={{ title: 'Note Details' }} />
        <Stack.Screen name="Settings" component={Settings} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;