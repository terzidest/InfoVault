import { useState } from 'react';
import { authenticate } from '../services/authentication';
import { useAppContext } from '../context/AppContext';

const useAuth = (navigation) => {
  const { login, logout } = useAppContext();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const isAuthenticated = await authenticate();
    setLoading(false);

    if (isAuthenticated) {
      login();
      navigation.navigate('Home');
    } else {
      alert('Authentication failed');
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
  };
};

export default useAuth;
