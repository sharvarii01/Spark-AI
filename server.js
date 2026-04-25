const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve the frontend from 'public' folder

// Initialize Gemini API
// Make sure to add GEMINI_API_KEY to your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_API_KEY');

app.post('/api/chat', async (req, res) => {
  try {
    const { history, message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: Missing Gemini API Key. Please add it to your .env file.' });
    }

    // Choose the generative model
    // Gemini 1.5 Flash is recommended for text tasks due to speed and cost
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: "You are Spark AI, a next-generation AI assistant. Your answers must be extremely concise and to the point. Focus only on the main, most important content without providing unnecessary length or filler text."
    });

    // Ensure the history is formatted correctly for the API
    // The Google Generative AI SDK expects history in { role: 'user' | 'model', parts: [{text: '...'}] } format
    const chatSession = model.startChat({
      history: history || [],
      generationConfig: {
        temperature: 0.7,
      },
    });

    let attempt = 0;
    const maxRetries = 3;
    let delay = 1000;
    let text = "";

    while (attempt < maxRetries) {
      try {
        const result = await chatSession.sendMessage(message);
        const response = await result.response;
        text = response.text();
        break; // Success, break out of the loop
      } catch (sendError) {
        attempt++;
        const isOverloaded = sendError.status === 503 || (sendError.message && sendError.message.includes('503'));
        
        if (attempt >= maxRetries || !isOverloaded) {
          throw sendError; // Rethrow to main catch block
        }
        
        console.warn(`[API] Server busy (503), retrying in ${delay}ms... (Attempt ${attempt} of ${maxRetries - 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff (1s, 2s)
      }
    }

    res.json({ reply: text });
  } catch (error) {
    console.error('Error communicating with Gemini API:', error);
    
    let errorMessage = 'Failed to get response from AI. ' + error.message;
    
    if (error.status === 503 || (error.message && error.message.includes('503'))) {
      errorMessage = "Spark AI is currently experiencing very high demand and needs a quick breather. Please try asking again in a few moments!";
    }

    res.status(500).json({ error: errorMessage });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('\x1b[33m%s\x1b[0m', 'WARNING: GEMINI_API_KEY is not set in the .env file. The chatbot will not work until it is added.');
  }
});
