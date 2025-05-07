// src/server.ts

import express, { Request, Response, RequestHandler, NextFunction } from 'express';
import axios from 'axios';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import Parser from 'rss-parser';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

// --- Helper function to strip HTML (similar to frontend util) ---
function stripHtml(html: string | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

// --- Helper function to extract links from text ---
function extractLinks(text: string): { url: string; text: string }[] {
  if (!text) return [];
  const links: { url: string; text: string }[] = [];
  const regex = /<a\s+(?:[^>]*?\s+)?href=(['"])(.*?)\1[^>]*?>(.*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    links.push({ url: match[2], text: stripHtml(match[3]) }); // Store link URL and link text (stripped)
  }
  return links;
}

// Define interface for request body for /api/summarize
interface SummarizeRequestBody {
  text?: string; // Text to summarize (e.g. from Wikipedia feed item)
  url?: string;  // URL of the article to fetch and summarize
  itemUrl?: string; // Fallback URL from the feed item, if different from content URL
  summaryType?: 'article' | 'comment' | 'wikipedia_event_block'; // Added to guide prompt engineering
}

// Define interface for response body for /api/summarize
interface SummaryResponseBody {
  summary: string;
  error?: string; // Optional error message
}

// Define a type for our custom feed item structure for Wikipedia
type WikipediaDailyEvent = {
  title: string | undefined;
  content: string | undefined; // This will be the HTML string
  published: string | undefined;
  links: { url: string; rel: string }[] | undefined;
  id: string | undefined;
};

// Define a type for the new structured Wikipedia event object
type ProcessedWikipediaEvent = {
  id: string;
  date: string | undefined;
  topicTitle: string;
  llmSummary: string | null;
  originalBlockText: string;
  sourceLinks: { url: string; text: string }[]; // Extracted from the block's original HTML
};

// New endpoint to fetch AND PROCESS Wikipedia daily events
app.get('/api/wikipedia-daily-events', async (req: Request, res: Response) => {
  const feedUrl = 'https://vikramkashyap.com/wikipedia_current_events.rss';
  const parser = new Parser();
  const processedEvents: ProcessedWikipediaEvent[] = [];
  let dailyEntryCounter = 0; // To track the first entry

  try {
    console.log(`Fetching Wikipedia RSS feed from: ${feedUrl}`);
    const feed = await parser.parseURL(feedUrl);
    console.log(`Successfully fetched Wikipedia RSS. Found ${feed.items.length} daily entries.`);

    for (const dailyEntry of feed.items) {
      const dailyHtmlContent = dailyEntry.content;
      const publishedDate = dailyEntry.pubDate || dailyEntry.isoDate;
      const dailyEntryGuid = dailyEntry.guid || dailyEntry.id || `wp_day_${Date.now()}`;

      if (!dailyHtmlContent) {
        console.warn(`No content found for Wikipedia daily entry GUID: ${dailyEntryGuid}`);
        continue;
      }

      // 1. Strip HTML from the daily entry's content (but keep for link extraction per block later)
      const plainTextContent = stripHtml(dailyHtmlContent);
      // 2. Split the plain text into blocks
      const blocks = plainTextContent.split(/\n\s*\n/);

      console.log(`Daily entry ${dailyEntryGuid}: processing ${blocks.length} text blocks.`);
      console.log(`DEBUG: dailyHtmlContent for ${dailyEntryGuid}:\n`, dailyHtmlContent);

      let blockIndex = 0;
      for (const blockText of blocks) {
        const trimmedBlock = blockText.trim();
        if (!trimmedBlock) continue;

        const eventId = `${dailyEntryGuid}_event_${blockIndex++}`;
        const topicTitle = trimmedBlock.split('\n')[0] || 'Untitled Event';
        
        // Find original HTML for this block to extract links accurately
        // This is a simplification; robustly matching plain text block to original HTML block can be complex.
        // For now, we'll extract links from the whole dailyHtmlContent and assign if relevant.
        // A better approach might be to parse HTML into blocks first.
        // However, the prompt now implies summarizing each topic (block) and then conditionally fetching if topic is new.
        // For THIS iteration, let's extract links from the daily HTML and attach all of them if any. Future iteration can refine link-to-block mapping.
        const allLinksInDailyEntry = extractLinks(dailyHtmlContent);

        console.log(`DEBUG: Extracted links for ${dailyEntryGuid}:`, JSON.stringify(allLinksInDailyEntry));

        let llmSummary: string | null = null;
        try {
          console.log(`Summarizing block for event ID: ${eventId}, Title: ${topicTitle}`);
          const prompt = `Concisely summarize the following news event excerpt from Wikipedia. Highlight key actions, entities, and outcomes. Event Excerpt:\n\n${trimmedBlock}`;
          const completion = await openai.completions.create({
            model: 'gpt-3.5-turbo-instruct',
            prompt: prompt,
            max_tokens: 200, // Adjust as needed for block summaries
            temperature: 0.3,
          });
          llmSummary = completion.choices[0].text.trim();
          console.log(`Successfully summarized block for event ID: ${eventId}. Summary length: ${llmSummary?.length}`);
        } catch (summaryError) {
          console.error(`Error summarizing block for event ID ${eventId}:`, summaryError);
          llmSummary = "Summary not available."; // Or handle as an error state
        }

        processedEvents.push({
          id: eventId,
          date: publishedDate,
          topicTitle: topicTitle,
          llmSummary: llmSummary,
          originalBlockText: trimmedBlock,
          sourceLinks: allLinksInDailyEntry, // For now, all links from the day's content
        });
      }
      dailyEntryCounter++;
    }

    console.log(`Returning ${processedEvents.length} processed Wikipedia event items.`);
    res.json(processedEvents);
  } catch (error) {
    console.error('Error in /api/wikipedia-daily-events endpoint:', error);
    res.status(500).json({ message: 'Failed to fetch or process Wikipedia daily events', error: (error as Error).message });
  }
});

// --- Function to fetch and extract main content from a URL ---
async function fetchContentFromURL(url: string, res: express.Response<SummaryResponseBody>): Promise<string | null> {
  try {
    console.log(`Fetching content from URL: ${url}`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const html = response.data;
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (article && article.textContent) {
      console.log(`Successfully extracted content from ${url}. Length: ${article.textContent.length}`);
      return article.textContent;
    }
    console.warn(`Could not extract readable content from ${url}`);
    // Corrected error response format
    res.status(500).json({ summary: '', error: 'Failed to extract readable content from URL' });
    return null;
  } catch (error) {
    console.error(`Error fetching or parsing URL ${url}:`, error);
    // Corrected error response format
    res.status(500).json({ summary: '', error: `Failed to fetch or parse URL: ${(error as Error).message}` });
    return null;
  }
}

// Corrected summarizeHandler signature and logic
// Standard Express handler: (req, res, next) for RequestHandler type
const summarizeHandler: RequestHandler<{}, SummaryResponseBody, SummarizeRequestBody> = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, url, itemUrl, summaryType } = req.body;
    let contentToSummarize: string | null = text || null;
    let finalUrlForContext = url || itemUrl;

    console.log(`[${new Date().toISOString()}] Received POST request for /api/summarize`);
    console.log(`  SummaryType: ${summaryType}, URL: ${url}, Text Provided: ${!!text}, ItemURL: ${itemUrl}, ArticleURL: ${req.body.url}`);

    if (!contentToSummarize && url) {
      console.log(`No text provided, fetching content from primary URL: ${url}`);
      contentToSummarize = await fetchContentFromURL(url, res);
      if (!contentToSummarize) return; // fetchContentFromURL already sent a response
    } else if (!contentToSummarize && itemUrl) {
      console.log(`No text and no primary URL, fetching content from itemURL: ${itemUrl}`);
      contentToSummarize = await fetchContentFromURL(itemUrl, res);
      finalUrlForContext = itemUrl;
      if (!contentToSummarize) return; // fetchContentFromURL already sent a response
    }

    if (!contentToSummarize) {
      console.log('No content available for summarization.');
      // Corrected error response format
      return res.status(400).json({ summary: '', error: 'No content provided or found for summarization' });
    }

    let prompt = `Please summarize the following text clearly and concisely.`;
    if (summaryType === 'article') {
      prompt = `Please provide a concise summary of the following article content. Focus on the main points, key arguments, and conclusions. Article content:`;
    } else if (summaryType === 'comment') {
      prompt = `Please summarize the key points or arguments from the following comments or discussion. Comments:`;
    } else if (summaryType === 'wikipedia_event_block') {
      prompt = `Concisely summarize the following news event excerpt from Wikipedia. Highlight key actions, entities, and outcomes. Event Excerpt:`;
    }
    
    prompt += `\n\n${contentToSummarize}`;
    if (finalUrlForContext) {
      prompt += `\n\n(For context, this content is from or related to: ${finalUrlForContext})`;
    }

    console.log(`Sending text (length: ${contentToSummarize.length}) to OpenAI for summarization. Type: ${summaryType || 'general'}`);
    const completion = await openai.completions.create({
      model: 'gpt-3.5-turbo-instruct',
      prompt: prompt,
      max_tokens: summaryType === 'wikipedia_event_block' ? 200 : 150, // Allow longer for wiki blocks
      temperature: 0.5,
    });

    const summary = completion.choices[0].text.trim();
    console.log(`Successfully received summary from OpenAI. Length: ${summary.length}`);
    res.json({ summary });

  } catch (error) {
    console.error('Error in /api/summarize endpoint:', error);
    // Corrected error response format
    // Check if 'next' is available and use it for error handling to avoid crashing
    if (next) {
        next(error); // Pass to default Express error handler
    } else {
        // Fallback if next is somehow not available (should be, with RequestHandler)
        res.status(500).json({ summary: '', error: 'Internal server error in summarization' });
    }
  }
};

app.post('/api/summarize', summarizeHandler);

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
