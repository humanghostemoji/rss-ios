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
import ReactNativeHapticFeedback from "react-native-haptic-feedback"; // Import new haptic library

import FeedList from '../components/FeedList'; // Adjust path
import { RootStackParamList } from '../navigation/types.ts'; // We'll define this later
import { FeedItem } from '../components/FeedList';

// Define the structure for items returned by the backend for Wikipedia
type ProcessedWikipediaEvent = {
  id: string; // Unique ID for the processed event block from backend
  date: string | undefined; // Original publication date of the daily entry
  topicTitle: string; // First line of the event block, now processed title from backend
  llmSummary: string | null; // The detailed summary from the LLM for this specific block
  originalBlockText: string; // The full text of the original block
  sourceLinks: { url: string; text: string }[]; // Links extracted by backend
};

export type FeedSource = {
  key: string;
  title: string;
  url: string;
  type: 'hackernews' | 'wikipedia' | 'other';
};

export const FEED_SOURCES: FeedSource[] = [
  {
    key: 'hackernews',
    title: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    type: 'hackernews',
  },
  {
    key: 'wikipedia',
    title: 'Wikipedia Current Events',
    url: 'http://localhost:3001/api/wikipedia-daily-events', // Updated URL
    type: 'wikipedia',
  },
  // Add other feed sources here
];

// Define navigation props type for this screen
type Props = NativeStackScreenProps<RootStackParamList, 'FeedList'>;

const FeedListScreen = ({ navigation }: Props) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<FeedSource>(FEED_SOURCES[0]); // Default to first feed

  // Optional configuration for haptic feedback
  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  // Effect to update navigation header title when selectedFeed changes
  useLayoutEffect(() => {
    navigation.setOptions({ title: `${selectedFeed.title} Feed` });
  }, [navigation, selectedFeed]);

  const fetchFeed = useCallback(async (source: FeedSource) => {
    setLoading(true);
    setError(null);
    setFeedItems([]); // Clear previous items when switching feeds

    console.log(`Fetching feed from: ${source.url}`);
    try {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let items: FeedItem[] = [];

      if (source.type === 'hackernews') {
        const text = await response.text();
        // Corrected RSS parser usage for react-native-rss-parser
        const parsedFeed = await rssParser.parse(text); 
        items = parsedFeed.items.map((item: any) => ({
          id: item.id || item.link || `hn-${Date.now()}-${Math.random()}`,
          title: item.title || 'No title',
          // Ensure links is an array, provide default if undefined or not an array
          links: Array.isArray(item.links) ? item.links.map((link: any) => ({ url: link.url, rel: link.rel })) : [],
          description: item.description || '',
          published: item.published || new Date().toISOString(),
          sourceType: source.type,
          // commentLink specific to HN
          commentLink: (item.comments && typeof item.comments === 'string' && item.comments.includes('news.ycombinator.com/item?id=')) ? item.comments : undefined,
        }));
      } else if (source.type === 'wikipedia') {
        // Backend now returns an array of already processed event objects with LLM summaries
        const processedEvents: ProcessedWikipediaEvent[] = await response.json();
        console.log(`Received ${processedEvents.length} processed Wikipedia event items from backend.`);

        items = processedEvents.map((event) => {
          const firstLink = event.sourceLinks && event.sourceLinks.length > 0 ? event.sourceLinks[0].url : undefined;
          console.log(`Wikipedia item ID: ${event.id} - Title: ${event.topicTitle}`);
          console.log('Source Links Received:', JSON.stringify(event.sourceLinks, null, 2));
          console.log('Derived firstLink:', firstLink);

          const descriptionForDetail = event.llmSummary || event.originalBlockText; // Prefer LLM summary

          return {
            id: event.id,
            title: event.topicTitle,
            link: firstLink, // Use the first link found in the block
            published: event.date || new Date().toISOString(), // Use date from backend, fallback to now
            contentSnippet: (event.llmSummary || event.originalBlockText).substring(0, 150), // Snippet from LLM summary or original text
            sourceType: source.type,
            description: descriptionForDetail, // This will be used by FeedDetailScreen
            links: event.sourceLinks.map(sl => ({ url: sl.url, rel: 'alternate' })), // Map to FeedItem links structure
            // commentLink is not applicable for Wikipedia items
          } as FeedItem; // Cast to FeedItem type
        });
        
        console.log(`Mapped ${items.length} Wikipedia event items for display.`);

      } else {
        const text = await response.text();
        // Corrected RSS parser usage for react-native-rss-parser
        const parsedFeed = await rssParser.parse(text);
        items = parsedFeed.items.map((item: any) => ({
          id: item.id || item.link || `other-${Date.now()}-${Math.random()}`,
          title: item.title || 'No title',
          // Ensure links is an array, provide default if undefined or not an array
          links: Array.isArray(item.links) ? item.links.map((link: any) => ({ url: link.url, rel: link.rel })) : [],
          description: item.description || '',
          published: item.published || new Date().toISOString(),
          sourceType: source.type,
        }));
      }

      setFeedItems(items);
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

  const onRefresh = useCallback(async () => {
    console.log('Refreshing feed...');
    ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions); // Haptic feedback for refresh
    await fetchFeed(selectedFeed);
  }, [fetchFeed, selectedFeed, hapticOptions]);

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
          {FEED_SOURCES.map((source) => (
            <TouchableOpacity
              key={source.key}
              style={[
                styles.feedSelectorButton,
                selectedFeed.key === source.key && styles.feedSelectorButtonActive,
              ]}
              onPress={() => setSelectedFeed(source)} // Fix typo: FeedFeedSource -> FeedSource
              disabled={loading} // Disable while loading
            >
              <Text
                style={[
                  styles.feedSelectorText,
                  selectedFeed.key === source.key && styles.feedSelectorTextActive,
                ]}
              >
                {source.title}
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
          <FeedList
            feeds={feedItems}
            navigation={navigation}
            onRefresh={onRefresh} // Pass onRefresh handler
            refreshing={loading} // Pass loading state for RefreshControl
          />
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
