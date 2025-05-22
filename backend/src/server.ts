// src/server.ts

import express, { Request, Response, RequestHandler, NextFunction } from 'express';
import axios from 'axios';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
// import Parser from 'rss-parser'; // Keep Parser commented

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

// Define interface for request body for /api/summarize
interface SummarizeRequestBody {
  text?: string; 
  url?: string;  // URL of the ARTICLE to fetch and summarize
  itemUrl?: string; // URL of the COMMENT THREAD or fallback item to fetch and summarize
}

// Define interface for response body for /api/summarize
interface SummaryResponsePayload {
  articleSummary?: string;
  commentSummary?: string;
  error?: string;
}

// --- Function to fetch and extract main content from a URL using Readability ---
async function fetchAndParseURL(url: string): Promise<{ title: string; content: string; excerpt?: string } | null> {
  try {
    console.log(`Fetching content from URL: ${url}`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10 seconds timeout
    });
    const html = response.data;
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (article && article.textContent) {
      console.log(`Successfully extracted content from ${url}. Title: ${article.title}, Length: ${article.textContent.length}`);
      return {
        title: article.title || 'Untitled',
        content: article.textContent,
        excerpt: article.excerpt || undefined,
      };
    }
    console.warn(`Could not extract readable content from ${url}`);
    return null;
  } catch (error) {
    console.error(`Error fetching or parsing URL ${url}:`, error);
    return null;
  }
}

const summarizeHandler: RequestHandler<{}, SummaryResponsePayload, SummarizeRequestBody> = async (req, res, next) => {
  try {
    const { text, url: articleUrl, itemUrl: commentUrl } = req.body; 
    let articleContentToSummarize: string | null = null;
    let commentContentToSummarize: string | null = null;
    const responsePayload: SummaryResponsePayload = {};

    console.log(`[${new Date().toISOString()}] Received POST request for /api/summarize`);
    console.log(`  ArticleURL: ${articleUrl}, CommentURL: ${commentUrl}, Text Provided: ${!!text}`);

    if (text) { 
      articleContentToSummarize = text;
    }

    if (articleUrl) {
      console.log(`Fetching content for article URL: ${articleUrl}`);
      const parsedArticle = await fetchAndParseURL(articleUrl);
      if (parsedArticle && parsedArticle.content) {
        articleContentToSummarize = parsedArticle.content;
      } else {
        responsePayload.error = (responsePayload.error ? responsePayload.error + '; ' : '') + `Failed to fetch/parse article from ${articleUrl}`;
      }
    }

    if (commentUrl) {
      console.log(`Fetching content for comment URL: ${commentUrl}`);
      const parsedComments = await fetchAndParseURL(commentUrl); 
      if (parsedComments && parsedComments.content) {
        commentContentToSummarize = parsedComments.content;
      } else {
        responsePayload.error = (responsePayload.error ? responsePayload.error + '; ' : '') + `Failed to fetch/parse comments from ${commentUrl}`;
      }
    }

    if (articleContentToSummarize) {
      const MAX_CONTENT_LENGTH = 12000; 
      if (articleContentToSummarize.length > MAX_CONTENT_LENGTH) {
        console.log(`Article content too long (${articleContentToSummarize.length} chars), truncating to ${MAX_CONTENT_LENGTH} chars.`);
        articleContentToSummarize = articleContentToSummarize.substring(0, MAX_CONTENT_LENGTH);
      }
      const articlePrompt = `Please provide a concise summary of the following article content. Focus on the main points, key arguments, and conclusions. Article content:\n\n${articleContentToSummarize}`;
      console.log(`Sending article text (length: ${articleContentToSummarize.length}) to OpenAI for summarization.`);
      try {
        const completion = await openai.completions.create({
          model: 'gpt-3.5-turbo-instruct',
          prompt: articlePrompt,
          max_tokens: 250, 
          temperature: 0.5,
        });
        responsePayload.articleSummary = completion.choices[0].text.trim();
        console.log(`Successfully received article summary from OpenAI. Length: ${responsePayload.articleSummary?.length}`);
      } catch (e:any) {
         console.error('Error summarizing article content:', e);
         responsePayload.error = (responsePayload.error ? responsePayload.error + '; ' : '') + `OpenAI error for article: ${e.message}`;
      }
    }

    if (commentContentToSummarize) {
      const MAX_COMMENT_LENGTH = 12000;
      if (commentContentToSummarize.length > MAX_COMMENT_LENGTH) {
        console.log(`Comment content too long (${commentContentToSummarize.length} chars), truncating to ${MAX_COMMENT_LENGTH} chars.`);
        commentContentToSummarize = commentContentToSummarize.substring(0, MAX_COMMENT_LENGTH);
      }
      const commentPrompt = `Review the following online discussion or comments. Identify and summarize the most interesting, insightful, or prevalent opinions and questions. Discussion content:\n\n${commentContentToSummarize}`;
      console.log(`Sending comment text (length: ${commentContentToSummarize.length}) to OpenAI for summarization.`);
      try {
        const completion = await openai.completions.create({
          model: 'gpt-3.5-turbo-instruct',
          prompt: commentPrompt,
          max_tokens: 250, 
          temperature: 0.6, 
        });
        responsePayload.commentSummary = completion.choices[0].text.trim();
        console.log(`Successfully received comment summary from OpenAI. Length: ${responsePayload.commentSummary?.length}`);
      } catch (e:any) {
        console.error('Error summarizing comment content:', e);
        responsePayload.error = (responsePayload.error ? responsePayload.error + '; ' : '') + `OpenAI error for comments: ${e.message}`;
      }
    }
    
    if (!responsePayload.articleSummary && !responsePayload.commentSummary && !responsePayload.error && !text && !articleUrl && !commentUrl) {
        console.log('No valid inputs (text, articleUrl, commentUrl) were processed for summarization.');
        return res.status(400).json({ error: 'No content provided or URLs found for summarization' });
    }
    
    if (responsePayload.error && !responsePayload.articleSummary && !responsePayload.commentSummary) {
        return res.status(500).json({ error: responsePayload.error });
    }

    res.json(responsePayload);

  } catch (error) {
    console.error('Critical error in /api/summarize endpoint:', error);
    next(error); 
  }
};

app.post('/api/summarize', summarizeHandler);

// Fallback error handler for Express
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled application error:", err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
