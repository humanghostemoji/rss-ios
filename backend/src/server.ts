// src/server.ts

import dotenv from 'dotenv';
dotenv.config(); // Load environment variables FIRST

import express, { Request, Response, RequestHandler } from 'express';
import OpenAI from 'openai'; // Import OpenAI
import axios from 'axios'; // Import axios
import * as cheerio from 'cheerio'; // Import cheerio

// Define interface for request body
interface SummarizeRequestBody {
  itemUrl?: string;
}

// Define interface for response body
interface SummaryResponseBody {
  summary?: string;
  error?: string;
  details?: string;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Use the key from .env
});

const app = express();
const port = process.env.PORT || 3000; // Use port from env or default to 3000

// Middleware to parse JSON bodies
app.use(express.json());

// Simple route to check if server is running
app.get('/', (req: Request, res: Response) => {
  res.send('RSS Summarizer Backend is running!');
});

// --- Define Request Handler --- 
const summarizeHandler: RequestHandler<{}, SummaryResponseBody, SummarizeRequestBody> = async (req, res) => {
  const { itemUrl } = req.body; 
  console.log(`[${new Date().toISOString()}] Received POST request for /api/summarize`); 
  console.log(`  Received itemUrl: ${itemUrl}`); 

  // --- Input Validation --- 
  if (!itemUrl || typeof itemUrl !== 'string') {
    console.error('  Error: Missing or invalid itemUrl in request body'); 
    res.status(400).json({ error: 'Missing itemUrl in request body' });
    return; 
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('  Error: OpenAI API key not configured'); 
    res.status(500).json({ error: 'OpenAI API key not configured on server' });
    return; 
  }

  // --- Main Logic --- 
  try {
    console.log(`  Attempting to fetch content from: ${itemUrl}`); 
    const response = await axios.get(itemUrl, { // Use await
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const html = response.data;
    console.log(`  Successfully fetched content from ${itemUrl}`); 
    
    const $ = cheerio.load(html);
    console.log('  Loaded HTML into cheerio'); 

    const comments: string[] = [];
    $('.commtext').each((_i, el) => {
      comments.push($(el).text());
    });
    console.log(`  Extracted ${comments.length} comment texts`); 

    if (comments.length === 0) {
      console.log('  No comments found with selector ".commtext". Returning empty summary.'); 
      res.json({ summary: 'No comments found to summarize.' }); 
      return; 
    }

    const commentsText = comments.join('\n\n---\n\n');
    const maxCommentLength = 15000;
    const truncatedComments = commentsText.length > maxCommentLength ? commentsText.substring(0, maxCommentLength) + '...' : commentsText;
    
    console.log(`  Sending ${truncatedComments.length} chars of comments to OpenAI for summarization...`); 

    const openaiResponse = await openai.chat.completions.create({ // Use await
        model: 'gpt-4.1-nano',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes Hacker News comment threads.' },
          { role: 'user', content: `Below is a list of comments from a Hacker News discussion. Your job is to:

1. **Concise Overview**  
   • In 2–3 sentences, summarize the overall topic and why it’s sparking conversation.

2. **Top Insights**  
   • Identify the three most interesting or surprising points raised by different commenters.  
   • For each, include the commenter’s username (if available), their core argument, and why it matters.

3. **Technical or Practical Details**  
   • Extract any concrete tips, code snippets, benchmarks, tools, or links that would be useful to someone following this thread.  
   • List each as a bullet with a one-sentence explanation of its relevance.

4. **Areas of Consensus & Contention**  
   • Describe in brief where the commenters largely agree (consensus).  
   • Describe the strongest point of disagreement (contention) and the key arguments on both sides.

5. **Unanswered Questions & Next Steps**  
   • List any open questions people are asking that could guide further investigation.  
   • Suggest one actionable next step or resource (article, library, tool) someone could explore based on this thread.


\n\n${truncatedComments}` },
        ],
        max_tokens: 150,
    });
      
    const summary = openaiResponse.choices[0]?.message?.content?.trim() ?? 'Could not generate summary.';
    console.log(`  Received summary from OpenAI: ${summary.substring(0, 100)}...`); 
    res.json({ summary }); 

  } catch (error: any) { 
      // --- Centralized Error Handling --- 
      console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'); 
      console.error('!!! ENTERED CATCH BLOCK in summarizeHandler !!!');
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
      
      console.error(`[${new Date().toISOString()}] Error processing ${itemUrl}:`); 
      if (axios.isAxiosError(error)) {
          console.error('  Axios Error:', error.message);
          if (error.response) {
              console.error('  Status:', error.response.status);
              console.error('  Headers:', JSON.stringify(error.response.headers, null, 2));
              console.error('  Data:', JSON.stringify(error.response.data, null, 2));
          } else if (error.request) {
              console.error('  Request Error: No response received', error.request);
          } else {
              console.error('  Config Error:', error.message);
          }
      } else if (error instanceof OpenAI.APIError) { 
           console.error('  OpenAI API Error Status:', error.status);
           console.error('  OpenAI API Error Message:', error.message);
           console.error('  OpenAI API Error Code:', error.code);
           console.error('  OpenAI API Error Type:', error.type);
      } else if (error instanceof Error) { 
          console.error('  General Error:', error.message);
          console.error('  Stack:', error.stack); 
      } else { 
          console.error('  Unknown Error Type:', error);
      }
            
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' });
      }
  }
};

// --- Summarization Endpoint --- 
app.post('/api/summarize', summarizeHandler); // Use the typed handler

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
