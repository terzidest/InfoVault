import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import useAuth from '../hooks/useAuth';

const Authentication = ({ navigation }) => {
  const { handleLogin, loading } = useAuth(navigation);

  useEffect(() => {
    handleLogin(); // Trigger login when the component mounts
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentication Required</Text>
      <Button title="Retry Authentication" onPress={handleLogin} disabled={loading} />
      {loading && <Text>Authenticating...</Text>}
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
  title: {
    fontSize: 20,
    marginBottom: 20,
  },
});

export default Authentication;
