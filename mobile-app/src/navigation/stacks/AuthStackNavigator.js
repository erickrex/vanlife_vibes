import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LandingScreen from '../../screens/LandingScreen';
import LoginScreen from '../../screens/LoginScreen';
import PhoneCaptureScreen from '../../screens/PhoneCaptureScreen';
import SignupScreen from '../../screens/SignupScreen';

const Stack = createNativeStackNavigator();

export default function AuthStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="PhoneCapture" component={PhoneCaptureScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}
