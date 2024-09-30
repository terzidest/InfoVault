import React, {useEffect} from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AppProvider } from './context/AppContext';
import Home from './screens/Home';
import Authentication from './screens/Authentication';
import CredentialsList from './screens/Credentials/CredentialsList';
import AddCredential from './screens/Credentials/AddCredential';
import ViewCredential from './screens/Credentials/ViewCredential';
import PersonalInfoList from './screens/PersonalInfo/PersonalInfoList';
import AddPersonalInfo from './screens/PersonalInfo/AddPersonalInfo';
import ViewPersonalInfo from './screens/PersonalInfo/ViewPersonalInfo';
import QuickNotesList from './screens/QuickNotes/QuickNotesList';
import AddQuickNote from './screens/QuickNotes/AddQuickNote';
import ViewQuickNote from './screens/QuickNotes/ViewQuickNote';
import Settings from './screens/Settings';
import { initializeDatabase } from './services/database';

const Stack = createStackNavigator();

const App = () => {

  useEffect(() => {
    initializeDatabase();
  }, []);

  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Authentication">
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="Authentication" component={Authentication} />
          <Stack.Screen name="CredentialsList" component={CredentialsList} />
          <Stack.Screen name="AddCredential" component={AddCredential} />
          <Stack.Screen name="ViewCredential" component={ViewCredential} />
          <Stack.Screen name="PersonalInfoList" component={PersonalInfoList} />
          <Stack.Screen name="AddPersonalInfo" component={AddPersonalInfo} />
          <Stack.Screen name="ViewPersonalInfo" component={ViewPersonalInfo} />
          <Stack.Screen name="QuickNotesList" component={QuickNotesList} />
          <Stack.Screen name="AddQuickNote" component={AddQuickNote} />
          <Stack.Screen name="ViewQuickNote" component={ViewQuickNote} />
          <Stack.Screen name="Settings" component={Settings} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
};

export default App;
