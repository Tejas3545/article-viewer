"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, Info, RefreshCw } from 'lucide-react';
import { summarizeDocument, type SummarizeDocumentInput } from '@/ai/flows/summarize-document';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface SummarizerProps {
  documentText: string;
  documentId: string;
  onSummaryGenerated?: (summary: string) => void;
}

export function Summarizer({ documentText, documentId, onSummaryGenerated }: SummarizerProps) {
  const [summary, setSummary] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const checkExistingSummary = async () => {
      try {
        const docRef = doc(db, "articles", documentId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().summary) {
          setSummary(docSnap.data().summary);
          if (onSummaryGenerated) {
            onSummaryGenerated(docSnap.data().summary);
          }
        }
      } catch (error) {
        console.error("Error checking for existing summary:", error);
      }
    };

    checkExistingSummary();
  }, [documentId, onSummaryGenerated]);

  const generateSummary = async () => {
    if (!documentText.trim()) {
      setError('No text content available to summarize.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: documentText }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      const newSummary = data.summary;
      setSummary(newSummary);

      try {
        const docRef = doc(db, "articles", documentId);
        await updateDoc(docRef, {
          summary: newSummary,
          summaryGeneratedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        toast({
          title: "Summary Generated",
          description: "The summary has been generated and saved.",
        });

        if (onSummaryGenerated) {
          onSummaryGenerated(newSummary);
        }
      } catch (firestoreError) {
        console.error("Error saving summary to Firestore:", firestoreError);
        toast({
          title: "Error Saving Summary",
          description: "The summary was generated but couldn't be saved for other users.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setError('Failed to generate summary. Please try again.');
      toast({
        title: "Summary Generation Failed",
        description: "Could not generate summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Document Summary</CardTitle>
        <CardDescription>AI-generated summary of the document content.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : summary ? (
          <>
            <Textarea
              readOnly
              value={summary}
              placeholder="Summary will appear here..."
              className="min-h-[200px] bg-muted/30 border-border focus-visible:ring-accent"
              aria-label="Generated summary"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={generateSummary}
              disabled={isGenerating}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              Regenerate Summary
            </Button>
          </>
        ) : (
          <Button
            variant="default"
            className="w-full"
            onClick={generateSummary}
            disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Summary...
              </>
            ) : (
              'Generate Summary'
            )}
          </Button>
        )}
        {!summary && !isGenerating && (!documentText || documentText.trim().length < 50 || documentText.includes("placeholder text")) && (
          <Alert variant="default" className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>No Summary Available</AlertTitle>
            <AlertDescription>
              The document text is either too short, empty, or contains placeholder content. A meaningful summary cannot be generated.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
