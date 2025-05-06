// src/server.ts

import dotenv from 'dotenv';
dotenv.config(); // Load environment variables FIRST

import express, { Request, Response, RequestHandler } from 'express';
import OpenAI from 'openai'; // Import OpenAI
import axios from 'axios'; // Import axios
import * as cheerio from 'cheerio'; // Import cheerio
import { Readability } from '@mozilla/readability'; // Import Readability
import { JSDOM } from 'jsdom'; // Import JSDOM
import { parse } from 'node-html-parser'; // Import node-html-parser

// Define interface for request body
interface SummarizeRequestBody {
  itemUrl?: string; // HN comment page URL
  articleUrl?: string; // Original article URL
}

// Define interface for response body
interface SummaryResponseBody {
  commentSummary?: string; // Renamed for clarity
  articleSummary?: string; // Add article summary
  error?: string;
  details?: string | { 
    commentError?: string;
    articleError?: string;
  };
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const port = process.env.PORT || 3001; // Use correct port

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('RSS Summarizer Backend is running!');
});

// Helper function to summarize text with OpenAI
async function getOpenAISummary(prompt: string, content: string, model: string = 'gpt-3.5-turbo'): Promise<string | null> {
  try {
    const openaiResponse = await openai.chat.completions.create({
      model: model, // Use specified model
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: content },
      ],
      max_tokens: 200, // Increased slightly
    });
    return openaiResponse.choices[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return null; // Return null on OpenAI error
  }
}

// Function to summarize article content
async function summarizeArticle(articleUrl: string): Promise<string | null> {
  if (!articleUrl) return null;
  console.log(`  Attempting to fetch article content from: ${articleUrl}`);
  try {
    // Add a User-Agent header to mimic a browser
    const response = await axios.get(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000 // 15 second timeout
    });

    // Check if content type is HTML before trying to parse
    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.includes('text/html')) {
      console.warn(`  Skipping article summary for ${articleUrl} - Content-Type is not HTML (${contentType})`);
      return null;
    }

    const html = response.data;
    
    // Use JSDOM to parse the HTML string into a DOM
    const dom = new JSDOM(html, { url: articleUrl });
    // Pass the JSDOM document object to Readability
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      console.warn(`  Readability could not extract main content from ${articleUrl}`);
      return null;
    }

    console.log(`  Extracted article content (${article.textContent.length} chars) from ${articleUrl}`);
    const maxArticleLength = 20000; // Limit input length
    const truncatedContent = article.textContent.length > maxArticleLength 
                               ? article.textContent.substring(0, maxArticleLength) + '...' 
                               : article.textContent;

    const prompt = 'You are a helpful assistant. Summarize the key points of the following article concisely for a mobile app reader.';
    const summary = await getOpenAISummary(prompt, `Article Title: ${article.title || 'N/A'}\n\nContent:\n${truncatedContent}`, 'gpt-3.5-turbo'); // Use 3.5-turbo for potentially longer articles
    console.log(`  Generated article summary for ${articleUrl}`);
    return summary;

  } catch (error: any) {
    console.error(`  Error fetching/parsing article ${articleUrl}:`, error.message);
    return null;
  }
}

// --- Main Request Handler --- 
const summarizeHandler: RequestHandler<{}, SummaryResponseBody, SummarizeRequestBody> = async (req, res) => {
  const { itemUrl, articleUrl } = req.body; // Extract both URLs
  console.log(`[${new Date().toISOString()}] Received POST request for /api/summarize`); 
  console.log(`  Received itemUrl: ${itemUrl}`); 
  console.log(`  Received articleUrl: ${articleUrl}`);

  if ((!itemUrl || typeof itemUrl !== 'string') && (!articleUrl || typeof articleUrl !== 'string')) {
    console.error('  Error: Missing or invalid itemUrl AND articleUrl'); 
    res.status(400).json({ error: 'Missing both itemUrl and articleUrl' });
    return; 
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('  Error: OpenAI API key not configured'); 
    res.status(500).json({ error: 'OpenAI API key not configured' });
    return; 
  }

  let commentSummary: string | null = null;
  let articleSummary: string | null = null; // Declare articleSummary here
  let commentError: string | undefined = undefined;
  let articleError: string | undefined = undefined;
  let extractedCommentsText: string | null = null; // Re-declare extractedCommentsText here

  // --- Summarize Comments (if itemUrl provided) --- 
  if (itemUrl && typeof itemUrl === 'string') {
    try {
      console.log(`  Attempting to fetch comments from: ${itemUrl}`); 
      const response = await axios.get(itemUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 ... Safari/537.36' }, 
        timeout: 10000
      });
      const html = response.data;
      const $ = cheerio.load(html);
      const comments: string[] = [];
      $('.commtext').each((_i, el) => { comments.push($(el).text()); });
      console.log(`  Extracted ${comments.length} comments`); 

      if (comments.length > 0) {
        const commentsText = comments.join('\n\n---\n\n');
        const maxCommentLength = 15000;
        // Assign to extractedCommentsText
        extractedCommentsText = commentsText.length > maxCommentLength ? commentsText.substring(0, maxCommentLength) + '...' : commentsText;
      }
    } catch (error: any) {
      console.error(`  Error fetching/parsing comments ${itemUrl}:`, error.message);
      commentError = error.message; // Store specific comment error
      // Don't assign to commentSummary here, it should remain null
    }
  }

  // --- Summarize Article (if articleUrl provided) ---
  try {
    articleSummary = await summarizeArticle(articleUrl as string);
  } catch (error: any) {
    console.error(`  Error fetching/parsing article ${articleUrl}:`, error.message);
    articleError = error.message; // Store specific article error
    // Don't assign to articleSummary here, it should remain null
  }

  // --- Summarize Comments with OpenAI (if comments were extracted) ---
  let commentSummaryPromise: Promise<string | null> = Promise.resolve(null);
  // Check extractedCommentsText here
  if (extractedCommentsText) { 
    console.log(`  Sending ${extractedCommentsText.length} chars of comments to OpenAI...`);
    const commentPrompt = 'You are a helpful assistant that summarizes Hacker News comment threads based on the structured prompt below.';
    // Keep your detailed comment prompt here
    commentSummaryPromise = getOpenAISummary(commentPrompt, extractedCommentsText, 'gpt-4.1-nano'); 
  } else if (itemUrl && typeof itemUrl === 'string' && !commentError) {
      // Handle case where comments were fetched but empty, or fetch failed silently
      console.warn(`  No comments text extracted or available to send to OpenAI for ${itemUrl}`);
  }

  // --- Wait for both summaries --- 
  try {
    [commentSummary] = await Promise.all([commentSummaryPromise]);
    console.log('  Finished fetching/generating summaries.');

    // Consolidate error handling
    if (!commentSummary && !articleSummary) {
        // If both failed, send a general error or specific errors if available
        res.status(500).json({ 
            error: 'Failed to generate summaries.',
            details: {
                commentError: commentError || 'Comment summary failed.',
                articleError: articleError || 'Article summary failed.'
            }
        });
    } else {
        // Send successful response with whatever summaries were generated
        res.status(200).json({
            commentSummary: commentSummary ?? undefined, // Use nullish coalescing for clarity
            articleSummary: articleSummary ?? undefined
        });
    }

  } catch (error: any) { 
      console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'); 
      console.error('!!! ENTERED CATCH BLOCK in summarizeHandler (Summarization Phase) !!!');
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
      console.error(`[${new Date().toISOString()}] Error during summary generation/aggregation:`);
      if (error instanceof Error) { 
          console.error('  General Error:', error.message);
          console.error('  Stack:', error.stack); 
      } else { 
          console.error('  Unknown Error Type:', error);
      }
            
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to process request during summarization', details: error instanceof Error ? error.message : 'Unknown error' });
      }
  }
};

app.post('/api/summarize', summarizeHandler);

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
