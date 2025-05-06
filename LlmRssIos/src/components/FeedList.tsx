import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; 
import { RootStackParamList } from '../navigation/types'; 

// Adjust the type based on react-native-rss-parser output
// Common fields include id, title, links (array), description, published
// Export the type so it can be used elsewhere
export type FeedItem = {
  id: string; // Usually a unique ID like the HN item ID or URL
  title: string;
  links: { url: string; rel: string }[]; // Parser often gives links array
  description?: string; // Optional description
  published?: string; // Optional published date string
  comments?: string; // Add optional comments field based on typical RSS parser output
  commentLink?: string; // Add field to specifically store the HN comment link
  // Add other fields if needed, e.g., authors: { name: string }[]
};

// Define the type for the navigation prop for this component
type FeedListNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'FeedList' // Current screen name (where FeedList is used)
>;

type FeedListProps = {
  feeds: FeedItem[];
  navigation: FeedListNavigationProp; // Add navigation prop
};

// Destructure navigation from props
const FeedList = ({ feeds, navigation }: FeedListProps) => {

  const handlePress = (item: FeedItem) => {
    // Navigate to FeedDetail screen, passing the selected item
    navigation.navigate('FeedDetail', { feedItem: item });
  };

  const renderItem = ({ item }: { item: FeedItem }) => (
    // Make item pressable and call handlePress
    <TouchableOpacity style={styles.itemContainer} onPress={() => handlePress(item)}>
      <Text style={styles.itemTitle}>{item.title}</Text>
      {/* Optionally display other info like published date or description */}
      {/* <Text style={styles.itemUrl}>{item.links?.[0]?.url}</Text> */}
    </TouchableOpacity>
  );

  // Handle empty list case
  if (feeds.length === 0) {
      return <Text style={styles.emptyText}>No feed items found.</Text>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feeds}
        renderItem={renderItem}
        // Modify keyExtractor for robustness
        keyExtractor={(item, index) => {
          // Log the id being considered
          console.log(`FeedList Key Extractor - Index: ${index}, ID: ${item?.id}, Type: ${typeof item?.id}`);
          if (item && typeof item.id === 'string' && item.id.length > 0) {
            return item.id;
          }
          // Fallback or warning if id is missing/invalid
          console.warn(`FeedList: Missing or invalid id for item at index ${index}. Using index as key fallback.`);
          // Use index as fallback key (prefix ensures it's a string and avoids collision with potential numeric IDs)
          return `index-${index}`; 
        }}
        style={styles.list}
        // Add initialNumToRender for performance with long lists
        initialNumToRender={10}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  list: {
    flex: 1,
  },
  itemContainer: {
    backgroundColor: '#ffffff', // Keep light background for items for now
    padding: 15,
    marginVertical: 5,
    marginHorizontal: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333', // Darker text for readability
  },
  itemUrl: { // Keep style if needed later
    fontSize: 12,
    color: 'gray',
    marginTop: 4,
  },
  emptyText: { // Style for empty list message
      textAlign: 'center',
      marginTop: 50,
      fontSize: 16,
      color: 'gray',
  }
});

export default FeedList;
