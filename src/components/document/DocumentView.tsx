"use client";
import React, { useState, useMemo, useCallback } from 'react'; // Removed useEffect
import type { DocumentFile, DocumentMetadata } from '@/lib/types'; // DocumentMetadata might not be needed here anymore
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
  document: DocumentFile; // Changed from docId to document
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

// document prop is now directly passed
export function DocumentView({ document: initialDocument }: DocumentViewProps) { 
  // Use state to allow local modifications to the document, e.g., summary updates
  const [currentDocument, setCurrentDocument] = useState<DocumentFile>(initialDocument);
  const [searchTerm, setSearchTerm] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const { toast } = useToast();

  // If the initialDocument prop changes (e.g. parent re-fetches), update the local state.
  useEffect(() => {
    setCurrentDocument(initialDocument);
  }, [initialDocument]);


  const handleSummaryUpdate = useCallback(async (summary: string) => {
    if (currentDocument) {
        const updatedDocFile: DocumentFile = { ...currentDocument, summary };
        setCurrentDocument(updatedDocFile); // Optimistically update UI

        // Update localStorage (optional, if still needed for some other part or as fallback)
        // Consider if this is truly needed given Firestore is the source of truth.
        // For now, keeping it for compatibility as per original logic for updating 'docuview-library'
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(`docuview-doc-${currentDocument.id}`, JSON.stringify(updatedDocFile));
            
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
                }
              } catch (parseError) {
                console.error("Error parsing 'docuview-library' from localStorage.", parseError);
              }
            }
            
            const docIndex = libraryDocsMetadata.findIndex(d => d.id === currentDocument.id);
            if (docIndex > -1) {
                const currentMetadataEntry = libraryDocsMetadata[docIndex];
                libraryDocsMetadata[docIndex] = {
                    ...currentMetadataEntry, // Preserve existing fields
                    source: updatedDocFile.source || currentMetadataEntry.source,
                    summary: summary, 
                    coverImageDataUri: updatedDocFile.coverImageDataUri || currentMetadataEntry.coverImageDataUri,
                    author: updatedDocFile.author || currentMetadataEntry.author, 
                    edition: updatedDocFile.edition || currentMetadataEntry.edition,
                    // Ensure essential fields from DocumentMetadata are preserved
                    id: currentMetadataEntry.id,
                    name: currentMetadataEntry.name,
                    type: currentMetadataEntry.type,
                    uploadedAt: currentMetadataEntry.uploadedAt,
                };
            }
            localStorage.setItem('docuview-library', JSON.stringify(libraryDocsMetadata));
          }
        } catch (e) { 
            console.error("Failed to update summary in localStorage", e); 
        }

        // Update summary in Firestore
        try {
            const articleRef = doc(db, "articles", currentDocument.id);
            await updateDoc(articleRef, {
              summary: summary,
              updatedAt: serverTimestamp()
            });
            toast({ title: "Summary Synced", description: "Summary successfully updated in the cloud.", duration: 3000 });
          } catch (firestoreError) {
            console.error("Error updating summary in Firestore:", firestoreError);
            toast({ title: "Cloud Sync Error", description: "Failed to update summary in the cloud. It is saved locally.", variant: "destructive" });
          }
    }
  }, [currentDocument, toast]);

  const docIsPlaceholder = useMemo(() => {
    // Use currentDocument instead of document
    return isTextPlaceholder(currentDocument?.textContent, currentDocument?.name, currentDocument?.type);
  }, [currentDocument?.textContent, currentDocument?.name, currentDocument?.type]);

  const highlightedContent = useMemo(() => {
    // Use currentDocument instead of document
    if (!currentDocument?.textContent) {
      return <p className="text-muted-foreground italic">Document text content is empty or not available for preview.</p>;
    }
    
    const textToDisplay = currentDocument.textContent;

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
  }, [currentDocument?.textContent, searchTerm, docIsPlaceholder]);

  // isLoading state is removed as data is passed via prop
  // if (isLoading) {
  //   return (
  //     <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-8">
  //       <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" /> 
  //       <p className="text-lg text-muted-foreground">Loading document...</p>
  //     </div>
  //   );
  // }

  // The parent page now handles the "not found" case based on getDocument result
  if (!currentDocument) {
    // This should ideally not be reached if parent handles it, but as a fallback:
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-8 text-center">
        <FileText className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Document Data Error</h2>
        <p className="text-muted-foreground mb-6">Could not display document. Data might be missing.</p>
        <Button asChild variant="outline">
          <Link href="/"><ChevronLeft className="mr-2 h-4 w-4" /> Back to Library</Link>
        </Button>
      </div>
    );
  }
  
  let placeholderSpecificMessage = "";
  if (docIsPlaceholder) {
    // Use currentDocument
    const docTextContent = currentDocument?.textContent || "";
    const docName = currentDocument?.name || "";
    const docType = currentDocument?.type || "";

    if (docTextContent.toLowerCase().startsWith(`pdf content for ${docName.toLowerCase()}`)) {
      placeholderSpecificMessage = `Text preview for PDF files is not currently supported. You can download the original file to view its content.`;
    } else if (docTextContent.toLowerCase().startsWith(`docx content for ${docName.toLowerCase()}`) && docTextContent.toLowerCase().includes("(this is a placeholder text. the original file can be downloaded.)")) {
       placeholderSpecificMessage = `Text preview for this DOCX file is a placeholder, indicating that the original text content is not available for direct viewing (similar to how PDF previews are handled). You can download the original file to view its content.`;
    } else if (docTextContent.toLowerCase().startsWith(`could not extract text from ${docName.toLowerCase()}`)) {
      placeholderSpecificMessage = `We tried to extract text from this DOCX file for preview, but an error occurred. This can happen with complex, corrupted, or password-protected files. Please check your browser's console during the upload process for specific error details if this issue persists. You can download the original file.`;
    } else if (docTextContent.toLowerCase().startsWith(`content of ${docName.toLowerCase()}`) && docTextContent.toLowerCase().includes("full parsing requires specific libraries")) {
       placeholderSpecificMessage = `The text content for this document type ("${docType}") is a placeholder because full parsing for this format requires specific libraries not yet implemented for direct preview. You can download the original file.`;
    } else if (docType && isTextPlaceholder(currentDocument?.textContent, currentDocument?.name, currentDocument?.type)) { 
        placeholderSpecificMessage = `The text content for this document type ("${docType}") is a placeholder or could not be extracted for preview. You can download the original file.`;
    } else {
      placeholderSpecificMessage = `The text content for this document is a placeholder. The original file might be downloadable.`;
    }
  }

  const displaySource = currentDocument.source && currentDocument.source.toLowerCase() !== 'file upload';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-shrink-0 p-3 md:p-4 border-b bg-card sticky top-16 z-30">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <Button variant="outline" size="icon" asChild className="flex-shrink-0">
            <Link href="/"><ChevronLeft className="w-5 h-5" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            {/* Use currentDocument */}
            <h1 className="text-lg md:text-xl font-semibold truncate flex items-center gap-2" title={currentDocument.name}>
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="truncate">{currentDocument.name}</span>
            </h1>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 items-center">
                <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {currentDocument.uploadedAt ? format(new Date(currentDocument.uploadedAt), "MMM d, yyyy, p") : 'N/A'}
                </span>
                {currentDocument.author && (
                    <span className="flex items-center gap-1 truncate" title={`Author: ${currentDocument.author}`}>
                        <UserCircle className="w-3 h-3" />
                        Author: <span className="font-medium">{currentDocument.author}</span>
                    </span>
                )}
                {displaySource && (
                    <span className="flex items-center gap-1 truncate" title={`Source: ${currentDocument.source}`}>
                        <Building className="w-3 h-3" />
                        Source: <span className="font-medium">{currentDocument.source}</span>
                    </span>
                )}
                {currentDocument.edition && (
                    <span className="flex items-center gap-1 truncate" title={`Edition: ${currentDocument.edition}`}>
                        <Layers className="w-3 h-3" />
                        Edition: <span className="font-medium">{currentDocument.edition}</span>
                    </span>
                )}
                 <Badge variant="outline" className="text-xs">{currentDocument.type}</Badge>
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
                    {/* Use currentDocument */}
                    <p className="mb-2 font-semibold">{currentDocument.textContent}</p>
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
          {/* Use currentDocument */}
          <Summarizer documentText={currentDocument.textContent || ''} onSummaryGenerated={handleSummaryUpdate} />
           {/* Download Button Logic */}
           <div className="mt-4">
            {(currentDocument.fileUrl || currentDocument.fileDataUri) ? (
              <a
                href={currentDocument.fileUrl || currentDocument.fileDataUri}
                download={currentDocument.name}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
              >
                Download Original File
              </a>
            ) : (
              <Button disabled className="w-full">Download Unavailable</Button>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

