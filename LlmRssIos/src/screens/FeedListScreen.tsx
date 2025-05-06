// src/screens/FeedListScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  ActivityIndicator,
} from 'react-native';
import * as rssParser from 'react-native-rss-parser';
import { NativeStackScreenProps } from '@react-navigation/native-stack'; // For navigation props type

import FeedList from '../components/FeedList'; // Adjust path
import { RootStackParamList } from '../navigation/types.ts'; // We'll define this later
import { FeedItem } from '../components/FeedList';

const HN_RSS_URL = 'https://news.ycombinator.com/rss';

// Define navigation props type for this screen
type Props = NativeStackScreenProps<RootStackParamList, 'FeedList'>;

// Note: Pass navigation prop down to FeedList
const FeedListScreen = ({ navigation }: Props) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeed = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(HN_RSS_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const responseData = await response.text();
        const parsed = await rssParser.parse(responseData);
        setFeeds(Array.isArray(parsed.items) ? parsed.items : []);
      } catch (e) {
        console.error("Failed to fetch or parse feed:", e);
        setError(e instanceof Error ? e.message : 'An unknown error occurred');
        setFeeds([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, []);

  const backgroundStyle = {
    flex: 1,
    backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7',
  };
  const titleColor = isDarkMode ? '#FFFFFF' : '#000000';

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <View style={styles.container}>
        {/* Title is now handled by navigation header, remove it here */}
        {/* <Text style={[styles.title, { color: titleColor }]}>Hacker News Feed</Text> */}
        {loading && <ActivityIndicator size="large" color={titleColor} />}
        {error && <Text style={styles.errorText}>Error: {error}</Text>}
        {!loading && !error && (
          // Pass navigation prop to FeedList
          <FeedList feeds={feeds} navigation={navigation} />
        )}
      </View>
    </SafeAreaView>
  );
};

// Keep styles similar to App.tsx, but remove title style if unused
const styles = StyleSheet.create({
  container: {
    flex: 1,
    // paddingTop: 20, // Remove top padding if header provides it
    paddingHorizontal: 10,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
});

export default FeedListScreen;
