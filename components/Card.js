import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';


const Card = ({ title, navigateToScreen, icon }) => {
 
  const [islocked, setIslocked] = useState(true);

  const handlePress = () => {
    setIslocked(false); // Change icon to 'unlocked'
    setTimeout(() => { // Short delay to display 'unlocked' before navigation
      navigateToScreen(); // Navigate to the next screen
      setIslocked(true); // Reset to 'locked' when user returns
    }, 300); // Adjust the delay as needed
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {icon && <Ionicons name={icon} size={24} color="#FFC107" style={styles.icon} />}
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <TouchableOpacity onPress={handlePress} style={styles.lockButton}>
        <Ionicons name={islocked ? 'lock-closed' : 'lock-open-sharp'} size={30} color="#006E90" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '90%',
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFC107',
    backgroundColor: '#006E90',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    alignItems: 'center'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    justifyContent: 'center'
  },
  icon: {
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFC107',
    flexShrink: 1,
    textAlign: 'center'
  },
  lockButton: {
    marginTop: 10,
    padding: 10,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#FFC107',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5, // Add slight shadow for a button effect
  }
});


export default Card;
