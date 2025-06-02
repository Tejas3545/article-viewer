"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DocumentFile, DocumentMetadata } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Search, ChevronLeft, FileText, Loader2, UserCircle, CalendarDays, Building, Layers, Download } from 'lucide-react';
import { Summarizer } from './Summarizer';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
  const [currentDocument, setCurrentDocument] = useState<DocumentFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const { toast } = useToast();

  useEffect(() => {
    if (docId && typeof window !== 'undefined') {
      setIsLoading(true);
      
      const loadDocument = async () => {
        try {
          // First try to get the document from Firestore
          const docRef = doc(db, "articles", docId);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            const documentData: DocumentFile = {
              id: docId,
              name: firestoreData.name || "",
              type: firestoreData.type || "document",
              uploadedAt: firestoreData.uploadedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              textContent: firestoreData.textContent || "",
              summary: firestoreData.summary || null,
              coverImageDataUri: firestoreData.coverImageDataUri || null,
              author: firestoreData.author || null,
              source: firestoreData.source || null,
              edition: firestoreData.edition || null,
              fileUrl: firestoreData.fileUrl || null,
              cloudinaryPublicId: firestoreData.cloudinaryPublicId || null,
            };
            
            setCurrentDocument(documentData);
            
            // Update localStorage with the latest data from Firestore
            try {
              localStorage.setItem(`docuview-doc-${docId}`, JSON.stringify(documentData));
            } catch (storageError) {
              console.warn("Could not update localStorage with Firestore data:", storageError);
            }
          } else {
            // If not in Firestore, try localStorage as fallback
            const item = localStorage.getItem(`docuview-doc-${docId}`);
            if (item) {
              const parsedDoc = JSON.parse(item) as DocumentFile;
              setCurrentDocument(parsedDoc);
            } else {
              toast({ 
                title: "Document Not Found", 
                description: "The requested document could not be found in the cloud or local storage.", 
                variant: "destructive" 
              });
              setCurrentDocument(null);
            }
          }
        } catch (error) {
          console.error("Error loading document:", error);
          toast({ 
            title: "Loading Error", 
            description: "An error occurred while trying to load the document.", 
            variant: "destructive" 
          });
          setCurrentDocument(null);
        } finally {
          setIsLoading(false);
        }
      };

      loadDocument();
    }
  }, [docId, toast]);

  const handleSummaryUpdate = useCallback(async (summary: string) => {
    if (currentDocument) {
        const updatedDocFile: DocumentFile = { ...currentDocument, summary };
        setCurrentDocument(updatedDocFile); 
        try {
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
          
          const docIndex = libraryDocsMetadata.findIndex(d => d.id === currentDocument.id);
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
            console.warn(`Document with ID ${currentDocument.id} not found in 'docuview-library' metadata list during summary update.`);
          }
          
          localStorage.setItem('docuview-library', JSON.stringify(libraryDocsMetadata));

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

        } catch (e) { 
            console.error("Failed to update summary in localStorage", e); 
            toast({ title: "Storage Error", description: "Could not save summary update due to storage limitations.", variant: "destructive"});
        }
    }
  }, [currentDocument, toast]);

  const docIsPlaceholder = useMemo(() => {
    return isTextPlaceholder(currentDocument?.textContent, currentDocument?.name, currentDocument?.type);
  }, [currentDocument?.textContent, currentDocument?.name, currentDocument?.type]);

  const highlightedContent = useMemo(() => {
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

  const handleDownload = useCallback(async () => {
    if (!currentDocument) return;

    try {
      let filename = currentDocument.name;
      const nameParts = currentDocument.name.split(".");
      const hasExtension =
        nameParts.length > 1 &&
        nameParts[nameParts.length - 1].length > 0 &&
        nameParts[nameParts.length - 1].length < 5;

      if (!hasExtension) {
        if (currentDocument.type === "text/plain" && !filename.endsWith(".txt")) {
          filename += ".txt";
        } else if (
          currentDocument.type === "application/pdf" &&
          !filename.endsWith(".pdf")
        ) {
          filename += ".pdf";
        } else if (
          (currentDocument.type === "application/msword" ||
            currentDocument.type ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document") &&
          !filename.endsWith(".docx")
        ) {
          filename += ".docx";
        }
      }

      let blob: Blob;
      if (currentDocument.fileUrl) {
        const response = await fetch(currentDocument.fileUrl);
        blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "Download Started",
          description: `${filename} is being downloaded.`,
        });
      } else if (currentDocument.textContent) {
        // If no file URL but we have text content, create a text file
        blob = new Blob([currentDocument.textContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename.endsWith(".txt") ? filename : `${filename}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "Download Started",
          description: `${filename} is being downloaded as text.`,
        });
      } else {
        toast({
          title: "Error",
          description: "No downloadable content found for this document.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error preparing document for download:", error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Could not prepare document for download.",
        variant: "destructive",
      });
    }
  }, [currentDocument, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-8">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" /> 
        <p className="text-lg text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (!currentDocument) {
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
            <h1 className="text-lg md:text-xl font-semibold truncate flex items-center gap-2" title={currentDocument?.name}>
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="truncate">{currentDocument?.name}</span>
            </h1>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 items-center">
                <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {currentDocument?.uploadedAt ? format(new Date(currentDocument.uploadedAt), "MMM d, yyyy, p") : 'N/A'}
                </span>
                {currentDocument?.author && (
                    <span className="flex items-center gap-1 truncate" title={`Author: ${currentDocument.author}`}>
                        <UserCircle className="w-3 h-3" />
                        Author: <span className="font-medium">{currentDocument.author}</span>
                    </span>
                )}
                {displaySource && currentDocument?.source && (
                    <span className="flex items-center gap-1 truncate" title={`Source: ${currentDocument.source}`}>
                        <Building className="w-3 h-3" />
                        Source: <span className="font-medium">{currentDocument.source}</span>
                    </span>
                )}
                {currentDocument?.edition && (
                    <span className="flex items-center gap-1 truncate" title={`Edition: ${currentDocument.edition}`}>
                        <Layers className="w-3 h-3" />
                        Edition: <span className="font-medium">{currentDocument.edition}</span>
                    </span>
                )}
                 <Badge variant="outline" className="text-xs">{currentDocument?.type}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleDownload}
              title="Download Document">
              <Download className="w-5 h-5" />
            </Button>
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
          <Summarizer 
            documentText={currentDocument.textContent || ''} 
            documentId={currentDocument.id}
            onSummaryGenerated={handleSummaryUpdate} 
          />
        </ScrollArea>
      </div>
    </div>
  );
}
