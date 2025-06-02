"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DocumentFile, DocumentMetadata } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Search, ChevronLeft, FileText, Loader2, UserCircle, CalendarDays, Building, Layers } from 'lucide-react';
import { Summarizer } from './Summarizer';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface DocumentViewProps {
  docId: string;
}

const isTextPlaceholder = (text: string | undefined, docName: string | undefined, docType: string | undefined): boolean => {
  if (!text || !docName) return true;
  const lowerText = text.toLowerCase();
  const lowerDocName = docName.toLowerCase();
  const lowerDocType = docType?.toLowerCase() || "";

  if (lowerText.startsWith(`could not extract text from ${lowerDocName}`)) return true;
  if (lowerText.startsWith(`pdf content for ${lowerDocName}`)) return true;
  if (lowerText.startsWith(`docx content for ${lowerDocName}`) && lowerText.includes("(this is a placeholder text. the original file can be downloaded.)")) return true;
  if (lowerText.startsWith(`content of ${lowerDocName}`) && lowerText.includes("full parsing requires specific libraries")) return true;
  
  const genericPlaceholderPhrases = [
    "(this is a placeholder text. the original file can be downloaded.)",
    "full parsing requires specific libraries."
  ];
  if (genericPlaceholderPhrases.some(phrase => lowerText.includes(phrase))) {
    if (lowerText.startsWith(`could not extract text from ${lowerDocName}`) ||
        lowerText.startsWith(`pdf content for ${lowerDocName}`) ||
        lowerText.startsWith(`docx content for ${lowerDocName}`) || 
        lowerText.startsWith(`content of ${lowerDocName}`)) {
        return true;
    }
  }
  if (lowerDocType && !['text/plain', 'text/html', 'application/json', 'application/xml', 'text/csv'].includes(lowerDocType) && lowerText.includes("placeholder text")) {
    return true;
  }
  return false;
};

export function DocumentView({ docId }: DocumentViewProps) {
  const [document, setDocument] = useState<DocumentFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const { toast } = useToast();

  useEffect(() => {
    if (docId && typeof window !== 'undefined') {
      setIsLoading(true);
      try {
        const item = localStorage.getItem(`docuview-doc-${docId}`);
        if (item) {
          const parsedDoc = JSON.parse(item) as DocumentFile;
          setDocument(parsedDoc);
        } else {
          toast({ title: "Document Not Found", description: "The requested document could not be found in your library.", variant: "destructive" });
          setDocument(null); 
        }
      } catch (error) {
        console.error("Error loading document:", error);
        toast({ title: "Loading Error", description: "An error occurred while trying to load the document.", variant: "destructive" });
        setDocument(null);
      } finally {
        setIsLoading(false);
      }
    }
  }, [docId, toast]);

  const handleSummaryUpdate = useCallback(async (summary: string) => {
    if (document) {
        const updatedDocFile: DocumentFile = { ...document, summary };
        setDocument(updatedDocFile); 
        try {
          localStorage.setItem(`docuview-doc-${document.id}`, JSON.stringify(updatedDocFile));
          
          let libraryDocsMetadata: DocumentMetadata[] = [];
          const libraryDocsRaw = localStorage.getItem('docuview-library');

          if (libraryDocsRaw) {
            try {
              const parsed = JSON.parse(libraryDocsRaw);
              if (Array.isArray(parsed)) {
                libraryDocsMetadata = parsed.filter(
                  (doc: any): doc is DocumentMetadata => 
                    doc && typeof doc.id === 'string' && 
                    typeof doc.name === 'string' && 
                    typeof doc.type === 'string' && 
                    typeof doc.uploadedAt === 'string'
                );
                if (libraryDocsMetadata.length !== parsed.length) {
                  console.warn("Some items in 'docuview-library' were not valid DocumentMetadata and were filtered out.");
                }
              } else {
                console.warn("'docuview-library' in localStorage was not an array. It will be treated as empty for this update.");
              }
            } catch (parseError) {
              console.error("Error parsing 'docuview-library' from localStorage. It will be treated as empty for this update.", parseError);
            }
          }
          
          const docIndex = libraryDocsMetadata.findIndex(d => d.id === document.id);
          if (docIndex > -1) {
              const currentMetadata = libraryDocsMetadata[docIndex];
              const updatedMetadataEntry: DocumentMetadata = {
                  id: currentMetadata.id,
                  name: currentMetadata.name,
                  type: currentMetadata.type,
                  uploadedAt: currentMetadata.uploadedAt,
                  source: updatedDocFile.source || currentMetadata.source,
                  summary: summary, 
                  coverImageDataUri: updatedDocFile.coverImageDataUri || currentMetadata.coverImageDataUri,
                  author: updatedDocFile.author || currentMetadata.author, 
                  edition: updatedDocFile.edition || currentMetadata.edition,
              };
              libraryDocsMetadata[docIndex] = updatedMetadataEntry;
          } else {
            console.warn(`Document with ID ${document.id} not found in 'docuview-library' metadata list during summary update.`);
          }
          
          localStorage.setItem('docuview-library', JSON.stringify(libraryDocsMetadata));

          // Update summary in Firestore
          try {
            const articleRef = doc(db, "articles", document.id);
            await updateDoc(articleRef, {
              summary: summary,
              updatedAt: serverTimestamp()
            });
            toast({ title: "Summary Synced", description: "Summary successfully updated in the cloud.", duration: 3000 });
          } catch (firestoreError) {
            console.error("Error updating summary in Firestore:", firestoreError);
            toast({ title: "Cloud Sync Error", description: "Failed to update summary in the cloud. It is saved locally.", variant: "destructive" });
          }

        } catch (e) { 
            console.error("Failed to update summary in localStorage", e); 
            toast({ title: "Storage Error", description: "Could not save summary update due to storage limitations.", variant: "destructive"});
        }
    }
  }, [document, toast]);

  const docIsPlaceholder = useMemo(() => {
    return isTextPlaceholder(document?.textContent, document?.name, document?.type);
  }, [document?.textContent, document?.name, document?.type]);

  const highlightedContent = useMemo(() => {
    if (!document?.textContent) {
      return <p className="text-muted-foreground italic">Document text content is empty or not available for preview.</p>;
    }
    
    const textToDisplay = document.textContent;

    if (!searchTerm.trim() || docIsPlaceholder) {
      return textToDisplay; 
    }
    
    try {
      const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = textToDisplay.split(regex).map((part, index) => 
        regex.test(part) ? (
          <mark key={index} className="bg-primary/30 text-primary-foreground px-0.5 py-px rounded">{part}</mark>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      );
      return <>{parts}</>; 
    } catch (e) {
      console.error("Search regex error:", e);
      return textToDisplay; 
    }
  }, [document?.textContent, searchTerm, docIsPlaceholder]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-8">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" /> 
        <p className="text-lg text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-8 text-center">
        <FileText className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Document Not Found</h2>
        <p className="text-muted-foreground mb-6">The document you are looking for does not exist or could not be loaded.</p>
        <Button asChild variant="outline">
          <Link href="/"><ChevronLeft className="mr-2 h-4 w-4" /> Back to Library</Link>
        </Button>
      </div>
    );
  }
  
  let placeholderSpecificMessage = "";
  if (docIsPlaceholder) {
    const docTextContent = document?.textContent || "";
    const docName = document?.name || "";
    const docType = document?.type || "";

    if (docTextContent.toLowerCase().startsWith(`pdf content for ${docName.toLowerCase()}`)) {
      placeholderSpecificMessage = `Text preview for PDF files is not currently supported. You can download the original file to view its content.`;
    } else if (docTextContent.toLowerCase().startsWith(`docx content for ${docName.toLowerCase()}`) && docTextContent.toLowerCase().includes("(this is a placeholder text. the original file can be downloaded.)")) {
       placeholderSpecificMessage = `Text preview for this DOCX file is a placeholder, indicating that the original text content is not available for direct viewing (similar to how PDF previews are handled). You can download the original file to view its content.`;
    } else if (docTextContent.toLowerCase().startsWith(`could not extract text from ${docName.toLowerCase()}`)) {
      placeholderSpecificMessage = `We tried to extract text from this DOCX file for preview, but an error occurred. This can happen with complex, corrupted, or password-protected files. Please check your browser's console during the upload process for specific error details if this issue persists. You can download the original file.`;
    } else if (docTextContent.toLowerCase().startsWith(`content of ${docName.toLowerCase()}`) && docTextContent.toLowerCase().includes("full parsing requires specific libraries")) {
       placeholderSpecificMessage = `The text content for this document type ("${docType}") is a placeholder because full parsing for this format requires specific libraries not yet implemented for direct preview. You can download the original file.`;
    } else if (docType && isTextPlaceholder(document?.textContent, document?.name, document?.type)) { 
        placeholderSpecificMessage = `The text content for this document type ("${docType}") is a placeholder or could not be extracted for preview. You can download the original file.`;
    } else {
      placeholderSpecificMessage = `The text content for this document is a placeholder. The original file might be downloadable.`;
    }
  }

  const displaySource = document.source && document.source.toLowerCase() !== 'file upload';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-shrink-0 p-3 md:p-4 border-b bg-card sticky top-16 z-30">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <Button variant="outline" size="icon" asChild className="flex-shrink-0">
            <Link href="/"><ChevronLeft className="w-5 h-5" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-semibold truncate flex items-center gap-2" title={document.name}>
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="truncate">{document.name}</span>
            </h1>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 items-center">
                <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {document.uploadedAt ? format(new Date(document.uploadedAt), "MMM d, yyyy, p") : 'N/A'}
                </span>
                {document.author && (
                    <span className="flex items-center gap-1 truncate" title={`Author: ${document.author}`}>
                        <UserCircle className="w-3 h-3" />
                        Author: <span className="font-medium">{document.author}</span>
                    </span>
                )}
                {displaySource && (
                    <span className="flex items-center gap-1 truncate" title={`Source: ${document.source}`}>
                        <Building className="w-3 h-3" />
                        Source: <span className="font-medium">{document.source}</span>
                    </span>
                )}
                {document.edition && (
                    <span className="flex items-center gap-1 truncate" title={`Edition: ${document.edition}`}>
                        <Layers className="w-3 h-3" />
                        Edition: <span className="font-medium">{document.edition}</span>
                    </span>
                )}
                 <Badge variant="outline" className="text-xs">{document.type}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <Button variant="outline" size="icon" onClick={() => setFontSize(s => Math.max(10, s - 1))} title="Zoom Out" disabled={docIsPlaceholder}>
              <ZoomOut className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setFontSize(s => Math.min(28, s + 1))} title="Zoom In" disabled={docIsPlaceholder}>
              <ZoomIn className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search in document text preview..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            aria-label="Search document content"
            disabled={docIsPlaceholder}
          />
        </div>
      </div>

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden">
        <ScrollArea className="lg:col-span-2 border-r border-border lg:h-full">
          <div className="p-4 md:p-6 prose-sm max-w-none" style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.6}px` }}>
            {docIsPlaceholder ? (
              <Alert variant="default" className="my-4">
                <FileText className="h-4 w-4" />
                <AlertTitle>Text Preview Information</AlertTitle>
                <AlertDescription>
                    <p className="mb-2 font-semibold">{document.textContent}</p>
                    {placeholderSpecificMessage && (
                      <p className="mt-1 text-sm italic">
                        {placeholderSpecificMessage}
                      </p>
                    )}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="whitespace-pre-wrap break-words">
                {highlightedContent}
              </div>
            )}
          </div>
        </ScrollArea>
        <ScrollArea className="lg:col-span-1 p-3 md:p-4 bg-card/50 lg:h-full">
          <Summarizer documentText={document.textContent || ''} onSummaryGenerated={handleSummaryUpdate} />
        </ScrollArea>
      </div>
    </div>
  );
}
