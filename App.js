
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AppProvider } from './context/AppContext';
// Components
import Header from './components/Header';
//screens
import Home from './screens/Home';
import Authentication from './screens/Authentication';
import CredentialsList from './screens/Credentials/CredentialsList';
import AddCredential from './screens/Credentials/AddCredential';
import ViewCredential from './screens/Credentials/ViewCredential';
import PersonalInfoList from './screens/PersonalInfo/PersonalInfoList';
import AddPersonalInfo from './screens/PersonalInfo/AddPersonalInfo';
import ViewPersonalInfo from './screens/PersonalInfo/ViewPersonalInfo';
import PersonalNotesList from './screens/PersonalNotes/PersonalNotesList';
import AddPersonalNote from './screens/PersonalNotes/AddPersonalNote';
import ViewPersonalNote from './screens/PersonalNotes/ViewPersonalNote';
import Settings from './screens/Settings';

const Stack = createStackNavigator();

const App = () => {

  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            header: ({ route }) => (
              <Header showBackButton={route.name === 'Authentication' || route.name === 'Home' ? false : true} />
            ),
          }}
        >
          <Stack.Screen name="Home" component={Home}/>
          <Stack.Screen name="CredentialsList" component={CredentialsList} />
          <Stack.Screen name="Authentication" component={Authentication} />
          <Stack.Screen name="AddCredential" component={AddCredential} />
          <Stack.Screen name="ViewCredential" component={ViewCredential} />
          <Stack.Screen name="PersonalInfoList" component={PersonalInfoList} />
          <Stack.Screen name="AddPersonalInfo" component={AddPersonalInfo} />
          <Stack.Screen name="ViewPersonalInfo" component={ViewPersonalInfo} />
          <Stack.Screen name="PersonalNotesList" component={PersonalNotesList} />
          <Stack.Screen name="AddPersonalNote" component={AddPersonalNote} />
          <Stack.Screen name="ViewPersonalNote" component={ViewPersonalNote} />
          <Stack.Screen name="Settings" component={Settings} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
};

export default App;
