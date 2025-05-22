// src/screens/FeedDetailScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Linking, Button, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FeedDetail'>;

const FeedDetailScreen = ({ route }: Props) => {
  const { feedItem } = route.params;
  // console.log('[FeedDetailScreen] Item ID received:', JSON.stringify(feedItem.id));
  // console.log('[FeedDetailScreen] Original feedItem.description:', feedItem.description);
  // console.log('[FeedDetailScreen] Original feedItem.sourceType:', feedItem.sourceType);
  // console.log('[FeedDetailScreen] Original feedItem.links:', JSON.stringify(feedItem.links));

  // State for Comment Summary
  const [commentSummary, setCommentSummary] = useState<string | null>(null);
  const [isCommentLoading, setIsCommentLoading] = useState<boolean>(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // State for Article Summary
  // For Wikipedia, feedItem.description is the main content.
  // For other types, it might be fetched.
  const [articleSummary, setArticleSummary] = useState<string | null>(
    feedItem.sourceType === 'wikipedia' ? feedItem.description || 'Summary loading or not available.' : null
  );
  const [isArticleLoading, setIsArticleLoading] = useState<boolean>(false);
  const [articleError, setArticleError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummaries = async () => {
      const commentUrl = feedItem.commentLink;
      // Use the first link as the article URL if it exists
      const articleUrl = feedItem.links?.[0]?.url;

      // Define the backend endpoint
      const backendUrl = 'http://localhost:3001/api/summarize';

      // Reset states selectively
      setIsCommentLoading(!!commentUrl);
      setCommentError(null);
      setCommentSummary(null);

      // Only set article loading/error if we intend to fetch it for non-Wikipedia items
      // or if it's a Wikipedia item AND we have a specific articleUrl to fetch (future enhancement?)
      let shouldFetchArticleSummary = !!articleUrl && feedItem.sourceType !== 'wikipedia';
      // As a potential future enhancement, we could allow summarizing a specific link even for Wikipedia items
      // if (feedItem.sourceType === 'wikipedia' && articleUrl) { /* shouldFetchArticleSummary = true; */ }

      setIsArticleLoading(shouldFetchArticleSummary);
      setArticleError(null);
      if (shouldFetchArticleSummary) {
        setArticleSummary(null); // Clear only if fetching for non-Wikipedia
      }

      // If it's Wikipedia, we've already set articleSummary from feedItem.description.
      // If no commentUrl AND (it's Wikipedia OR no articleUrl for other types), nothing to fetch.
      if (!commentUrl && !shouldFetchArticleSummary) {
        if (!commentUrl) setCommentError('No comment link available.');
        // For Wikipedia, if no articleUrl, the main summary is already set. No error needed for article here.
        // For non-Wikipedia, if no articleUrl, it means no article to summarize.
        if (!articleUrl && feedItem.sourceType !== 'wikipedia') {
            setArticleError('No article link available to summarize.');
        }
        setIsCommentLoading(false);
        setIsArticleLoading(false);
        return;
      }
      
      // Prepare payload for POST /api/summarize
      const payload: { itemUrl?: string; url?: string } = {};
      if (commentUrl) payload.itemUrl = commentUrl;
      if (shouldFetchArticleSummary && articleUrl) payload.url = articleUrl;

      // Only proceed with fetch if there's something to fetch
      if (!payload.itemUrl && !payload.url) {
        console.log('[FeedDetailScreen] No URLs to fetch summaries for.');
        if (commentUrl) setIsCommentLoading(false); // Should already be false if no commentUrl
        if (shouldFetchArticleSummary) setIsArticleLoading(false); // Should already be false if not fetching
        return;
      }

      try {
        // console.log(`[FeedDetailScreen] Attempting to fetch summaries from ${backendUrl} with payload:`, JSON.stringify(payload));
        
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
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
        } else if (shouldFetchArticleSummary && articleUrl) {
            const errMsg = 'Could not generate article summary from backend.';
            console.warn(errMsg);
            setArticleError(errMsg); 
        }
        
      } catch (err: any) {
        console.error('Fetch Summaries Error:', err);
        const errorMessage = err.message || 'Failed to fetch summaries. Is the backend server running?';
        console.error(`[FeedDetailScreen] Setting error state: CommentURL=${!!commentUrl}, ArticleURL=${shouldFetchArticleSummary && !!articleUrl}, Message=${errorMessage}`);
        if (commentUrl) setCommentError(errorMessage);
        if (shouldFetchArticleSummary && articleUrl) setArticleError(errorMessage);
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

      {/* === Article Content Section (Previously Article Summary) === */}
      {/* For Wikipedia, feedItem.description is the primary content */}
      {/* For other sources, articleSummary state holds the fetched summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>
          {feedItem.sourceType === 'wikipedia' ? 'Event Details:' : 'Article Summary:'}
        </Text>
        {isArticleLoading && feedItem.sourceType !== 'wikipedia' && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        )}
        {articleError && feedItem.sourceType !== 'wikipedia' && (
          <Text style={styles.errorText}>Article Error: {articleError}</Text>
        )}
        {articleSummary ? (
          <Text style={styles.summaryText}>{articleSummary}</Text>
        ) : (
          !isArticleLoading && feedItem.sourceType !== 'wikipedia' && !articleError && (
            <Text style={styles.infoText}>Article summary not available or could not be generated.</Text>
          )
        )}
        {/* This handles the case where it's Wikipedia and description might be empty initially, or non-wiki and no summary/error/loading */}
        {!articleSummary && !isArticleLoading && feedItem.sourceType === 'wikipedia' && (
            <Text style={styles.infoText}>Details for this event are not available.</Text>
        )}
      </View>

      {/* Display "No article link" only if source is not Wikipedia OR if it is Wikipedia but has no links AND no summary (edge case) */}
      {!feedItem.links?.[0]?.url && 
        (feedItem.sourceType !== 'wikipedia' || (feedItem.sourceType === 'wikipedia' && !articleSummary)) && (
        <Text style={styles.infoText}>No article link found for this item.</Text>
      )}
      
      {/* === Comment Summary Section === */}
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
