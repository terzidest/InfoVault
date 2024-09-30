import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Card from '../components/Card';
import { useAppContext } from '../context/AppContext';

const Home = ({ navigation }) => {
  const { isAuthenticated } = useAppContext();

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Authentication');
    }
  }, [isAuthenticated, navigation]);

  return (
    <View style={styles.container}>
      <Card
        title="Credentials"
        summary="10 saved"
        onAddPress={() => navigation.navigate('AddCredential')}
        onViewPress={() => navigation.navigate('CredentialsList')}
      />
      <Card
        title="Personal Information"
        summary="5 saved"
        onAddPress={() => navigation.navigate('AddPersonalInfo')}
        onViewPress={() => navigation.navigate('PersonalInfoList')}
      />
      <Card
        title="Quick Notes"
        summary="7 saved"
        onAddPress={() => navigation.navigate('AddQuickNote')}
        onViewPress={() => navigation.navigate('QuickNotesList')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default Home;
