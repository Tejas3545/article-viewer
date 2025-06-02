'use server';
/**
 * @fileOverview Extracts document details like author, source, and edition from text content.
 *
 * - extractDocumentDetails - A function that handles extracting document details.
 * - ExtractDocumentDetailsInput - The input type for the extractDocumentDetails function.
 * - ExtractDocumentDetailsOutput - The return type for the extractDocumentDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractDocumentDetailsInputSchema = z.object({
  textContent: z.string().describe('The text content of the document.'),
});
export type ExtractDocumentDetailsInput = z.infer<typeof ExtractDocumentDetailsInputSchema>;

const ExtractDocumentDetailsOutputSchema = z.object({
  author: z.string().optional().describe('The identified author or writer of the document. Returns undefined if no clear author is found.'),
  source: z.string().optional().describe('The specific name of the publisher, magazine, or journal. Excludes any edition, date, or volume info. Returns undefined if no clear source name is found or if it implies a generic origin like "File Upload".'),
  edition: z.string().optional().describe('The specific edition, issue, volume, or date of publication (e.g., "May 2025", "Vol. 3, Issue 2", "Spring Edition"). Returns undefined if no clear edition is found.'),
});
export type ExtractDocumentDetailsOutput = z.infer<typeof ExtractDocumentDetailsOutputSchema>;

export async function extractDocumentDetails(input: ExtractDocumentDetailsInput): Promise<ExtractDocumentDetailsOutput> {
  return extractDocumentDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractDocumentDetailsPrompt',
  input: {schema: ExtractDocumentDetailsInputSchema},
  output: {schema: ExtractDocumentDetailsOutputSchema},
  prompt: `Analyze the following document text. Your goal is to identify three key pieces of information, being as concise and accurate as possible. Focus on the beginning, end, headers, and footers of the document.

1.  **Author**: The primary individual author or writer of the document.
    *   Look for patterns like "By [Author Name]", "Author: [Author Name]", or names followed by titles.
    *   Extract *only* the individual's name as the author.
    *   If no clear individual author is found, return undefined.

2.  **Source**: The specific publication, magazine, journal, or organization name.
    *   Look for patterns like:
      - "Published in [Source Name]"
      - "From [Source Name]"
      - "Source: [Source Name]"
      - "Magazine: [Source Name]"
      - "Journal: [Source Name]"
      - URLs (extract only the domain, e.g., "cybermagazine.com")
    *   Extract *only* the publication name (e.g., "Tech Magazine", "IITM SHAASTRA", "Nature", "cybermagazine.com").
    *   DO NOT include:
      - Any edition, date, or volume information
      - Article titles
      - Full sentences, numbers, or paragraphs
      - Any article text after the source name
      - Generic terms like "File Upload" or "Local Document"
    *   If a URL is present, extract only the domain (e.g., "cybermagazine.com").
    *   If no clear publication name is found, return undefined.
    *   **Examples:**
      - Good: "cybermagazine.com", "Tech Magazine", "IITM SHAASTRA"
      - Bad: "cybermagazine.com 123 It's nothing groundbreaking..." (should be just "cybermagazine.com")
      - Bad: "Source: cybermagazine.com 123 It's nothing..." (should be just "cybermagazine.com")

3.  **Edition**: The specific edition, issue, volume, or date of publication.
    *   Look for patterns like:
      - "Volume X, Issue Y"
      - "Edition: [Date]"
      - "Issue [Number]"
      - "[Month] [Year]"
      - "Spring Edition"
      - "Vol. 3, Issue 2"
    *   This information is often found at the start, end, or in headers/footers.
    *   Extract *only* the edition-specific information (e.g., "May 2025", "Vol. 3, Issue 2").
    *   Do not include the publication name or article title.
    *   If no specific edition is found, return undefined.
    *   **Examples:**
      - Good: "May 2025", "Vol. 3, Issue 2", "Spring Edition"
      - Bad: "cybermagazine.com 123 It's nothing..." (should be just the edition info, not the whole line)

Document Text:
{{{textContent}}}

Based on the text, provide ONLY:
1. The author's name (if clearly identified)
2. The publication name (if clearly identified)
3. The edition information (if clearly identified)

Be strict about extraction - if any field is not clearly identifiable, return undefined for that field.`
});

const extractDocumentDetailsFlow = ai.defineFlow(
  {
    name: 'extractDocumentDetailsFlow',
    inputSchema: ExtractDocumentDetailsInputSchema,
    outputSchema: ExtractDocumentDetailsOutputSchema,
  },
  async (input: ExtractDocumentDetailsInput) => {
    // Ensure text is not too short or clearly a placeholder before calling the LLM
    if (!input.textContent || input.textContent.length < 50 || input.textContent.toLowerCase().includes("placeholder text for document") || input.textContent.toLowerCase().includes("pdf content for") || input.textContent.toLowerCase().includes("this is a placeholder text. the original file can be downloaded")) {
        return { author: undefined, source: undefined, edition: undefined };
    }
    try {
        const {output} = await prompt(input);
        return output || { author: undefined, source: undefined, edition: undefined };
    } catch (error) {
        console.error("Error in extractDocumentDetailsFlow:", error);
        return { author: undefined, source: undefined, edition: undefined }; // Return undefined on error
    }
  }
);

