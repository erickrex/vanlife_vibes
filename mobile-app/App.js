import 'react-native-gesture-handler';

import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { revenueCatClient } from './src/services/revenuecat';

// Initialize RevenueCat SDK before rendering the app tree
revenueCatClient.initialize();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="light" translucent={false} backgroundColor="#0a0b0f" />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
