// src/screens/FeedDetailScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Linking, Button } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FeedDetail'>;

const FeedDetailScreen = ({ route }: Props) => {
  const { feedItem } = route.params;
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      const commentUrl = feedItem.commentLink;
      
      if (!commentUrl) {
        setError('Summarization link not found or invalid (No commentLink).');
        return;
      }

      setIsLoading(true);
      setError(null);
      setSummary(null);

      try {
        const backendUrl = 'http://localhost:3001/api/summarize'; 
        console.log(`Attempting to fetch summary from ${backendUrl} for URL: ${commentUrl}`);

        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ itemUrl: commentUrl }), 
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
          throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
        }

        const data = await response.json();
        setSummary(data.summary);
      } catch (err: any) {
        console.error('Fetch Summary Error:', err);
        const errorMessage = err.message || 'Failed to fetch summary. Is the backend server running?';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [feedItem.commentLink]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{feedItem.title}</Text>
      
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Comment Summary:</Text>
        {isLoading && <ActivityIndicator size="large" color="#0000ff" />}
        {error && <Text style={styles.errorText}>{error}</Text>}
        {summary && <Text style={styles.summaryText}>{summary}</Text>}
        {!isLoading && !error && !summary && feedItem.commentLink && (
            <Text>Summary is being generated or none was available.</Text>
        )}
        {!feedItem.commentLink && !error && (
             <Text>Summarization not available for this item (no comment link found).</Text>
        )}
      </View>
      
      {feedItem.links?.[0]?.url && (
        <Text style={styles.link}>Link: {feedItem.links[0].url}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000',
  },
  summaryContainer: { 
      marginTop: 20,
      padding: 10,
      backgroundColor: '#ffffff',
      borderRadius: 5,
      borderWidth: 1,
      borderColor: '#ddd',
      minHeight: 100, 
  },
  summaryTitle: { 
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
  },
  summaryText: { 
      fontSize: 16,
      lineHeight: 24,
  },
  errorText: { 
      fontSize: 16,
      color: 'red',
  },
   link: { 
     fontSize: 14,
     color: 'blue',
     marginTop: 20,
   },
});

export default FeedDetailScreen;
