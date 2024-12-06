import { useState } from 'react';
import { authenticate } from '../services/authentication';
import { useAppContext } from '../context/AppContext';

const useAuth = (navigation) => {
  const { login, logout } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const isAuthenticated = await authenticate();
    setLoading(false);

    if (isAuthenticated) {
      login();
      navigation.navigate('Home');
    } else {
      setError('Authentication failed. Please try again.');
    }
  };

  const handleLogout = () => {
    logout();
    navigation.navigate('Authentication');
  };

  return {
    handleLogin,
    handleLogout,
    loading,
    error
  };
};

export default useAuth;
