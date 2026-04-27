import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import CommunityScreen from '../screens/CommunityScreen';
import WatchScreen from '../screens/WatchScreen';
import WatchSessionScreen from '../screens/WatchSessionScreen';
import UpdatesScreen from '../screens/UpdatesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useNotifications } from '../context/NotificationContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ICONS = { Home: '🏠', Community: '👥', Watch: '📺', Notifications: '🔔', Profile: '👤' };

function TabIcon({ name, focused }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{ICONS[name]}</Text>;
}

function WatchStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WatchList" component={WatchScreen} />
      <Stack.Screen name="WatchSession" component={WatchSessionScreen} />
    </Stack.Navigator>
  );
}

export default function MainNavigator() {
  const { unreadCount } = useNotifications();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#1E3A8A',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          height: 62,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Watch" component={WatchStack} />
      <Tab.Screen
        name="Notifications"
        component={UpdatesScreen}
        options={{ tabBarBadge: unreadCount > 0 ? unreadCount : undefined }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
