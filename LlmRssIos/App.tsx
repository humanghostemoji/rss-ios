/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';

import FeedListScreen from './src/screens/FeedListScreen';
import FeedDetailScreen from './src/screens/FeedDetailScreen';
import { RootStackParamList } from './src/navigation/types'; // Import the types

// Create the stack navigator
const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  // Define navigation theme based on color scheme
  const navigationTheme = {
    dark: isDarkMode,
    colors: {
      primary: 'rgb(255, 45, 85)', // Example primary color
      background: isDarkMode ? 'rgb(28, 28, 30)' : 'rgb(242, 242, 247)', // System gray 6 light/dark
      card: isDarkMode ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)', // Black/White
      text: isDarkMode ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)', // White/Black
      border: isDarkMode ? 'rgb(54, 54, 58)' : 'rgb(216, 216, 220)', // System gray 3 light/dark
      notification: 'rgb(255, 69, 58)', // Example notification color
    },
    // Add fonts property required by Theme type (can customize later if needed)
    fonts: { 
        regular: { fontFamily: 'System', fontWeight: "400" },
        medium: { fontFamily: 'System', fontWeight: "500" },
        bold: { fontFamily: 'System', fontWeight: "700" },
        thin: { fontFamily: 'System', fontWeight: "100" },
        light: { fontFamily: 'System', fontWeight: "300" },
        heavy: { fontFamily: 'System', fontWeight: "800" },
    }
  } as Theme;

  return (
    // Wrap the entire app in NavigationContainer
    <NavigationContainer theme={navigationTheme}>
      {/* Define the stack navigator */}
      <Stack.Navigator initialRouteName="FeedList">
        {/* Define the FeedList screen */}
        <Stack.Screen
          name="FeedList"
          component={FeedListScreen}
          options={{ title: 'Hacker News Feed' }} // Set header title
        />
        {/* Define the FeedDetail screen */}
        <Stack.Screen
          name="FeedDetail"
          component={FeedDetailScreen}
          options={({ route }) => ({ // Dynamically set title from feed item
            title: route.params.feedItem.title,
            headerBackTitleVisible: false, // Hide back button text on iOS
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
