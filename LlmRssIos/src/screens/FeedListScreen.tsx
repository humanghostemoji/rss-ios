// src/screens/FeedListScreen.tsx
import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import * as rssParser from 'react-native-rss-parser';
import { NativeStackScreenProps } from '@react-navigation/native-stack'; // For navigation props type

import FeedList from '../components/FeedList'; // Adjust path
import { RootStackParamList } from '../navigation/types.ts'; // We'll define this later
import { FeedItem } from '../components/FeedList';

// Define Feed Sources
const FEED_SOURCES = {
  HN: 'https://news.ycombinator.com/rss',
  Wikipedia: '', // Placeholder for Wikipedia feed URL
};

type FeedSource = keyof typeof FEED_SOURCES; // 'HN' | 'Wikipedia'

// Define navigation props type for this screen
type Props = NativeStackScreenProps<RootStackParamList, 'FeedList'>;

const FeedListScreen = ({ navigation }: Props) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<FeedSource>('HN'); // Default to HN

  // Effect to update navigation header title when selectedFeed changes
  useLayoutEffect(() => {
    navigation.setOptions({ title: `${selectedFeed} Feed` });
  }, [navigation, selectedFeed]);

  const fetchFeed = useCallback(async (source: FeedSource) => {
    setLoading(true);
    setError(null);
    setFeedItems([]); // Clear previous items when switching feeds

    const url = FEED_SOURCES[source];
    if (!url) {
      console.warn(`No URL defined for feed source: ${source}`);
      setError(`Feed URL for ${source} is not configured yet.`);
      setLoading(false);
      return;
    }

    console.log(`Fetching feed from: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const responseData = await response.text();
      const parsed = await rssParser.parse(responseData);

      // Process items to extract the correct comment link
      const processedItems = (Array.isArray(parsed.items) ? parsed.items : []).map((item: FeedItem) => {
        let hnCommentLink: string | undefined = undefined;

        // Extract HN comment URL from the description field's <a> tag href
        if (item.description) {
          const match = item.description.match(/<a href="(https?:\/\/news\.ycombinator\.com\/item\?id=\d+)">/);
          if (match && match[1]) {
            hnCommentLink = match[1];
          }
        }

        // Fallback: If not in description, check 'comments' or 'id' (less likely now)
        // Example: some feeds might put it in item.comments or item.id
        if (!hnCommentLink && item.comments && typeof item.comments === 'string' && item.comments.includes('news.ycombinator.com/item?id=')) {
          hnCommentLink = item.comments;
        } else if (!hnCommentLink && item.id && typeof item.id === 'string' && item.id.includes('news.ycombinator.com/item?id=')) {
          hnCommentLink = item.id;
        }

        return {
          ...item,
          commentLink: hnCommentLink, // Add the extracted link
        };
      });

      setFeedItems(processedItems);
    } catch (e) {
      console.error("Failed to fetch or parse feed:", e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred');
      setFeedItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(selectedFeed); // Fetch based on selected feed
  }, [selectedFeed, fetchFeed]); // Re-run effect when selectedFeed changes

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
        {/* Feed Source Selector */}
        <View style={styles.feedSelectorContainer}>
          {Object.keys(FEED_SOURCES).map((source) => (
            <TouchableOpacity
              key={source}
              style={[
                styles.feedSelectorButton,
                selectedFeed === source && styles.feedSelectorButtonActive,
              ]}
              onPress={() => setSelectedFeed(source as FeedSource)} // Fix typo: FeedFeedSource -> FeedSource
              disabled={loading} // Disable while loading
            >
              <Text
                style={[
                  styles.feedSelectorText,
                  selectedFeed === source && styles.feedSelectorTextActive,
                ]}
              >
                {source}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={titleColor} />
          </View>
        )}
        {error && <Text style={styles.errorText}>Error: {error}</Text>}
        {!loading && !error && (
          // Pass navigation prop to FeedList
          <FeedList feeds={feedItems} navigation={navigation} />
        )}
      </View>
    </SafeAreaView>
  );
};

// Keep styles similar to App.tsx, but remove title style if unused
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  feedSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  feedSelectorButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  feedSelectorButtonActive: {
    backgroundColor: '#007AFF',
  },
  feedSelectorText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  feedSelectorTextActive: {
    color: '#ffffff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
});

export default FeedListScreen;
