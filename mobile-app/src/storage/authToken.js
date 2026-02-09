import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'authToken';

export async function getAuthToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setAuthToken(token) {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Intentionally ignore storage errors.
  }
}

export async function clearAuthToken() {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Intentionally ignore storage errors.
  }
}

