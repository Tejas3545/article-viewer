import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text provided for summarization' },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'Google AI API key not configured' },
        { status: 500 }
      );
    }

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Generate content
    const prompt = `Please provide a concise summary of the following text. Focus on the main points and key information:\n\n${text}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    if (!summary) {
      throw new Error('No summary generated');
    }

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate summary' },
      { status: 500 }
    );
  }
} 