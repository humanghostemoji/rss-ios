// src/screens/FeedDetailScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types.ts'; // We'll create this

// Define navigation props type for this screen
type Props = NativeStackScreenProps<RootStackParamList, 'FeedDetail'>;

const FeedDetailScreen = ({ route }: Props) => {
  // Extract the feed item passed during navigation
  const { feedItem } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{feedItem.title}</Text>
      {/* Placeholder for description/summary */}
      <Text style={styles.placeholder}>Details and summary will go here.</Text>
      {/* Display the link */}
      {feedItem.links?.[0]?.url && (
        <Text style={styles.link}>Link: {feedItem.links[0].url}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ffffff', // Example background
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000',
  },
  placeholder: {
    fontSize: 16,
    color: 'gray',
    marginTop: 15,
  },
   link: {
     fontSize: 14,
     color: 'blue',
     marginTop: 20,
   },
});

export default FeedDetailScreen;
