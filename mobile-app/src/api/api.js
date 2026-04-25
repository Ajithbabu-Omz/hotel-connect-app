import axios from 'axios';
import Constants from 'expo-constants';

// Automatically derives the backend IP from the Expo Metro bundler host.
// This works on physical devices, emulators, and simulators without manual changes.
function getBaseURL() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }
  // Fallback: Android emulator uses 10.0.2.2, iOS simulator uses localhost
  return 'http://localhost:3000';
}

const BASE_URL = getBaseURL();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export default api;
