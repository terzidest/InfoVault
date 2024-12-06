import { useEffect } from 'react';
import { View, Text, Button, Image,TouchableOpacity } from 'react-native';
import { ScaledSheet, verticalScale, scale} from 'react-native-size-matters';
import useAuth from '../hooks/useAuth';
import LottieView from 'lottie-react-native';

const Authentication = ({ navigation }) => {
  const { handleLogin, loading, error } = useAuth(navigation);

  useEffect(() => {
    handleLogin(); // Trigger login when the component mounts
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}> Welcome to your vault!</Text>
      
        <LottieView
            source={require('../assets/animations/vault.json')} 
            autoPlay ={loading}
            loop ={loading}
            style={styles.vaultAnimation}
        />

      <Text style={styles.messageText}>
        {loading && !error ? 'Authenticating...' : error || ''}
      </Text>

      {!loading && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleLogin}
        >
          <Text style={styles.retryButtonText}>Retry Authentication</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#006E90',
    padding: 16,
  },
  title: {
    fontSize: 25,
    marginBottom: 20,
    marginTop: 10,
    textAlign: 'center',
    color: '#FFC107',
  },
  vaultAnimation: {
    width: 150,
    height: 150,
  },
  messageText: {
    fontSize: 18,
    color: '#FFC107',
    marginTop: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FFC107',
    padding: '12@s',
    borderRadius: '8@s',
    alignItems: 'center',
    marginTop: '20@s',
    width: '60%',
    alignSelf: 'center'
  },
  retryButtonText: {
    color: '#006E90',
    fontSize: '16@s',
    fontWeight: 'bold',
  },
});

export default Authentication;
