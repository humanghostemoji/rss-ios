// src/navigation/types.ts
import { FeedItem } from '../components/FeedList'; // Adjust path if FeedItem type moved

// Define the parameters expected by each screen in the stack
export type RootStackParamList = {
  FeedList: undefined; // No parameters expected for the list screen
  FeedDetail: { feedItem: FeedItem }; // FeedDetail expects a feedItem object
};
