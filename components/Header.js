// Header.js
import React from 'react';
import { View, Image, TouchableOpacity, StatusBar} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AntDesign  from '@expo/vector-icons/AntDesign';
import { ScaledSheet, verticalScale, scale} from 'react-native-size-matters';


const Header = ({ showBackButton = true }) => {
  const navigation = useNavigation();

  return (

    <View style={styles.headerContainer}>
       <StatusBar barStyle="light-content" backgroundColor="#006E90" />
      {showBackButton ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backArrowContainer}>
          <AntDesign name="leftcircleo" size={28} color="#FFC107"/>
        </TouchableOpacity>
      ) : (
        <View style={styles.backArrowContainer} />
      )}
      <View style={styles.logoContainer}>
        <Image source={require('../assets/images/logo.png')} style={styles.logo} />
      </View>
      <View style={styles.spacer} />
    </View>

  );
};

const styles = ScaledSheet.create({
  headerContainer: {
    height: verticalScale(100),
    backgroundColor: '#006E90',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: scale(3),
    borderBottomColor: '#FFC107',
    paddingHorizontal: scale(15),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4, // For Android
  },
  backArrowContainer: {
    width: scale(48), // Ensure at least 48x48 touch target
    height: scale(48),
    justifyContent: 'center', // Center align the icon
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 25
  },
  logo: {
    height: verticalScale(75),
    width: scale(250) 
  },
  spacer: {
    width: scale(40)
  },
});

export default Header;
