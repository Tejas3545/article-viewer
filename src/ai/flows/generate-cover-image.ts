'use server';
/**
 * @fileOverview Generates cover images for documents based on text content.
 *
 * - generateCoverImage - A function that handles cover image generation.
 * - GenerateCoverImageInput - The input type for the generateCoverImage function.
 * - GenerateCoverImageOutput - The output type for the generateCoverImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCoverImageInputSchema = z.object({
  textContent: z.string().describe('The text content to inspire the image.'),
});
export type GenerateCoverImageInput = z.infer<typeof GenerateCoverImageInputSchema>;

const GenerateCoverImageOutputSchema = z.object({
  imageDataUri: z.string().describe('The generated image as a data URI (e.g., data:image/png;base64,...).'),
});
export type GenerateCoverImageOutput = z.infer<typeof GenerateCoverImageOutputSchema>;

export async function generateCoverImage(input: GenerateCoverImageInput): Promise<GenerateCoverImageOutput> {
  return generateCoverImageFlow(input);
}

const generateCoverImageFlow = ai.defineFlow(
  {
    name: 'generateCoverImageFlow',
    inputSchema: GenerateCoverImageInputSchema,
    outputSchema: GenerateCoverImageOutputSchema,
  },
  async (input: GenerateCoverImageInput) => {
    // Limit text content length.
    const trimmedTextContent = input.textContent.substring(0, 300); // Further reduced for simplicity


    const { media, text } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', 
      prompt: `Your task is to create a **purely visual, abstract, and symbolic graphical image or pattern** inspired by the thematic essence of the provided text material.

CRITICAL INSTRUCTIONS - NO TEXT:
1.  **ABSOLUTELY NO text characters, letters, words, numbers, or any form of written language should appear anywhere in the generated image.**
2.  The image must be entirely graphical. Do not render the input text. Do not write titles or captions.
3.  If your initial idea for the image includes any textual elements, discard that idea and generate a new one that is purely visual.
4.  Focus on colors, shapes, textures, and symbolic representations that evoke the theme of the material.

Image Specifications:
*   Dimensions: 400x200 pixels (reduced from 600x300 for better storage).
*   Style: Abstract, symbolic, thematic. Minimalist, clean, or vector style is preferred if it helps meet size constraints.
*   Desired Download Size: Aim for under 50kb (reduced from 100kb).

Material to Inspire the Image:
"${trimmedTextContent}"`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], 
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      },
    });

    if (!media || !media.url) {
      console.error('Image generation failed or did not return a URL. Text response from model:', text);
      throw new Error('Image generation did not produce an image URL. Model response from API: ' + (text || "No text response from model."));
    }
    
    if (!media.url.startsWith('data:image/')) {
        console.error('Generated media URL is not a data URI:', media.url, "Model text response:", text);
        throw new Error('Generated media URL is not in the expected data URI format. URL was: ' + media.url);
    }
    
    return { imageDataUri: media.url };
  }
);
