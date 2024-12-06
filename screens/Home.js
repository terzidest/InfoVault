import { useEffect } from 'react';
import { ScrollView, StyleSheet,Text, View } from 'react-native';
import Card from '../components/Card';
import { useAppContext } from '../context/AppContext';

const Home = ({ navigation }) => {
  const { isAuthenticated } = useAppContext();

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Authentication');
    }
  }, [isAuthenticated, navigation]);

  const cards = [
    { title: 'Personal Information', screen: 'PersonalInfoList',icon: 'person-outline' },
    { title: 'Passwords', screen: 'CredentialsList',icon: 'key-outline' },
    { title: 'Card Pins', screen: 'CredentialsList', icon: 'card-outline' },
    { title: 'Personal Notes', screen: 'PersonalNotesList', icon: 'document-text-outline' }
  ];

  return (
    
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Select your category:</Text>
    {cards.map((card, index) => (
      <Card
        key={index}
        title={card.title}
        icon={card.icon}
        navigateToScreen ={() => navigation.navigate(card.screen)}
      />
    ))}
  </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    alignItems: 'center', 
   
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFC107',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: '#006E90',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default Home;
