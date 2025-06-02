
"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, Info } from 'lucide-react';
import { summarizeDocument, type SummarizeDocumentInput } from '@/ai/flows/summarize-document';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


interface SummarizerProps {
  documentText: string; // This should be the textContent
  onSummaryGenerated: (summary: string) => void;
}

export function Summarizer({ documentText, onSummaryGenerated }: SummarizerProps) {
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  const handleSummarize = async () => {
    if (!documentText || documentText.trim().length < 50) { 
      toast({ 
        title: "Not Enough Content", 
        description: "Document text is too short or empty to summarize effectively.", 
        variant: "destructive" 
      });
      return;
    }
    // Check if documentText is a placeholder for complex files
    if (documentText.includes("(This is a placeholder text. The original file can be downloaded.)") || 
        documentText.includes("Full parsing requires specific libraries.") ||
        documentText.includes("Displaying full PDF content here is complex") ||
        documentText.includes("Displaying full DOCX content here is complex")) {
      toast({
        title: "Cannot Summarize Placeholder",
        description: "The document text is a placeholder. Summarization requires actual text content.",
        variant: "warning",
      });
      return;
    }

    setIsLoading(true);
    setSummary(''); 
    try {
      const input: SummarizeDocumentInput = { documentText };
      const result = await summarizeDocument(input);
      if (result.summary) {
        setSummary(result.summary);
        onSummaryGenerated(result.summary);
        toast({ title: "Summary Generated!", description: "The AI has successfully summarized the document." });
      } else {
        toast({ title: "Summarization Failed", description: "The AI could not generate a summary for this document.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Summarization error:", error);
      toast({ title: "Error", description: "An unexpected error occurred while generating the summary.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wand2 className="w-5 h-5 text-accent" /> AI Document Summarizer
        </CardTitle>
        <CardDescription>
          Generate a concise summary of the document's text content using AI.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleSummarize} 
          disabled={isLoading || !documentText} 
          className="w-full mb-4 bg-accent hover:bg-accent/90 text-accent-foreground transition-colors"
          aria-live="polite"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Generate Summary
            </>
          )}
        </Button>
        {summary && (
          <Textarea
            readOnly
            value={summary}
            placeholder="Summary will appear here..."
            className="min-h-[200px] bg-muted/30 border-border focus-visible:ring-accent"
            aria-label="Generated summary"
          />
        )}
        {!summary && isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">Generating summary, please wait...</p>
        )}
        {!summary && !isLoading && (!documentText || documentText.trim().length < 50 || documentText.includes("placeholder text")) && (
             <Alert variant="default" className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Content Issue</AlertTitle>
                <AlertDescription>
                  The document's text content is currently empty, too short, or a placeholder. A summary cannot be generated from it.
                </AlertDescription>
            </Alert>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          AI summaries can sometimes be inaccurate. Always verify critical information.
        </p>
      </CardFooter>
    </Card>
  );
}
