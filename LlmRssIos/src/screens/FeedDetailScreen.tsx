// src/screens/FeedDetailScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Linking, Button, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FeedDetail'>;

const FeedDetailScreen = ({ route }: Props) => {
  const { feedItem } = route.params;
  // State for Comment Summary
  const [commentSummary, setCommentSummary] = useState<string | null>(null);
  const [isCommentLoading, setIsCommentLoading] = useState<boolean>(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  // State for Article Summary
  const [articleSummary, setArticleSummary] = useState<string | null>(null);
  const [isArticleLoading, setIsArticleLoading] = useState<boolean>(false);
  const [articleError, setArticleError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummaries = async () => {
      const commentUrl = feedItem.commentLink;
      const articleUrl = feedItem.links?.[0]?.url;

      // Reset states
      setIsCommentLoading(!!commentUrl); 
      setIsArticleLoading(!!articleUrl); 
      setCommentError(null);
      setArticleError(null);
      setCommentSummary(null);
      setArticleSummary(null);

      if (!commentUrl && !articleUrl) {
          setCommentError('No comment link available.');
          setArticleError('No article link available.');
          setIsCommentLoading(false);
          setIsArticleLoading(false);
          return;
      }
      
      try {
        const backendUrl = 'https://backend-quiet-shadow-7161.fly.dev/api/summarize'; 
        console.log(`Attempting to fetch summaries from ${backendUrl}`);
        console.log(`  Comment URL: ${commentUrl}`);
        console.log(`  Article URL: ${articleUrl}`);

        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
              itemUrl: commentUrl, 
              articleUrl: articleUrl 
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
          throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || errorData.error || 'Unknown backend error'}`);
        }

        const data = await response.json();
        console.log('Received summary data:', JSON.stringify(data, null, 2)); // Log entire response data
        
        if (data.commentSummary) {
            setCommentSummary(data.commentSummary);
        } else if (commentUrl) {
            const errMsg = 'Could not generate comment summary from backend.';
            console.warn(errMsg);
            setCommentError(errMsg); 
        }

        if (data.articleSummary) {
            setArticleSummary(data.articleSummary);
        } else if (articleUrl) {
            const errMsg = 'Could not generate article summary from backend.';
            console.warn(errMsg);
            setArticleError(errMsg); 
        }
        
      } catch (err: any) {
        console.error('Fetch Summaries Error:', err);
        const errorMessage = err.message || 'Failed to fetch summaries. Is the backend server running?';
        console.error(`Setting error state: CommentURL=${!!commentUrl}, ArticleURL=${!!articleUrl}, Message=${errorMessage}`);
        if (commentUrl) setCommentError(errorMessage);
        if (articleUrl) setArticleError(errorMessage);
      } finally {
        setIsCommentLoading(false);
        setIsArticleLoading(false);
      }
    };

    fetchSummaries();
  }, [feedItem.commentLink, feedItem.links]);

  return (
    <ScrollView 
      style={styles.scrollView}
      contentContainerStyle={styles.container}
    >
      {/* Ensure title is a string before rendering */}
      <Text style={styles.title}>{feedItem.title ?? 'No Title'}</Text>

      {/* === Article Summary Section (Moved Up) === */}
      {feedItem.links?.[0]?.url && (
          <View style={styles.summaryContainer}> {/* First container doesn't need extra margin */} 
            <Text style={styles.summaryTitle}>Article Summary:</Text>
            {isArticleLoading && (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color="#007AFF" /> 
              </View>
            )}
            {/* Only render error Text if articleError exists */}
            {articleError && (
              <Text style={styles.errorText}>Article Error: {articleError}</Text>
            )}
            {/* Only render summary Text if articleSummary exists */}
            {articleSummary && (
              <Text style={styles.summaryText}>{articleSummary}</Text>
            )}
            {!isArticleLoading && !articleError && !articleSummary && (
                <Text style={styles.infoText}>Article summary not available or could not be generated.</Text>
            )}
          </View>
      )}
       {!feedItem.links?.[0]?.url && (
          <Text style={styles.infoText}>No article link found for this item.</Text>
      )}
      
      {/* === Comment Summary Section (Moved Down) === */}
      {feedItem.commentLink && (
          // Apply specific style for margin top to the second container
          <View style={[styles.summaryContainer, styles.commentSummaryContainer]}> 
            <Text style={styles.summaryTitle}>Comment Summary:</Text>
            {isCommentLoading && (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color="#007AFF" /> 
              </View>
            )}
            {/* Only render error Text if commentError exists */}
            {commentError && (
              <Text style={styles.errorText}>Comment Error: {commentError}</Text>
            )}
            {/* Only render summary Text if commentSummary exists */}
            {commentSummary && (
              <Text style={styles.summaryText}>{commentSummary}</Text>
            )}
            {!isCommentLoading && !commentError && !commentSummary && (
                <Text style={styles.infoText}>Comment summary not available or could not be generated.</Text>
            )}
          </View>
      )}
      {!feedItem.commentLink && (
           // Ensure this info text is also wrapped
          <Text style={[styles.infoText, styles.commentSummaryContainer]}>No comment link found for this item.</Text>
      )}
      
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: { 
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: { 
    paddingVertical: 20, 
    paddingHorizontal: 15,
    paddingBottom: 40, 
  },
  title: {
    fontSize: 22, 
    fontWeight: 'bold',
    marginBottom: 15, 
    color: '#1c1c1e',
  },
  summaryContainer: { // Base style for both containers
      marginTop: 10,
      padding: 15,
      backgroundColor: '#ffffff',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#e5e5ea',
      minHeight: 150, 
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
  },
  commentSummaryContainer: { // Style for the second container (comments)
      marginTop: 20, // Add space between the two summary boxes
  },
  summaryTitle: { 
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 12,
      color: '#3c3c43',
  },
  summaryText: { 
      fontSize: 16,
      lineHeight: 24,
      color: '#3c3c43',
  },
  errorText: { 
      fontSize: 15,
      color: '#dc3545',
      textAlign: 'center',
      paddingVertical: 20,
  },
  infoText: { // Shared style for info texts
      fontSize: 15,
      color: '#6c757d',
      textAlign: 'center',
      paddingVertical: 10, 
      marginTop: 5, 
  },
  centerContent: { 
      flex: 1, 
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 100, 
  }
});

export default FeedDetailScreen;
