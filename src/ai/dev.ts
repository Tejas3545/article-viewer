
import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-document.ts';
import '@/ai/flows/generate-cover-image.ts';
import '@/ai/flows/extract-document-details-flow.ts'; // Added new flow
