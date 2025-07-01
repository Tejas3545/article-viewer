"use client";
import React from 'react';
import Link from 'next/link';
import { useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  CalendarDays,
  ArrowRight,
  Trash2,
  Download,
  UserCircle,
  Building,
  Layers,
} from "lucide-react";
import type { DocumentMetadata, DocumentFile } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface DocumentCardProps {
  doc: DocumentMetadata;
  onDelete?: (id: string) => void;
}

interface FirestoreDocData {
  id: string;
  name: string;
  type?: string;
  uploadedAt: { toDate: () => Date } | string | null;
  textContent: string;
  summary: string | null;
  coverImageDataUri: string | null;
  author: string | null;
  source: string | null;
  edition: string | null;
  fileUrl: string | null;
  cloudinaryPublicId: string | null;
}

const dataURIToBlob = (dataURI: string): Blob => {
  const splitDataURI = dataURI.split(",");
  const byteString =
    splitDataURI[0].indexOf("base64") >= 0
      ? atob(splitDataURI[1])
      : decodeURI(splitDataURI[1]);
  const mimeString = splitDataURI[0].split(":")[1].split(";")[0];

  const ia = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ia], { type: mimeString });
};

export function DocumentCard({ doc: documentMetadata, onDelete }: DocumentCardProps) {
  const { toast } = useToast();

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return format(date, "MMM d, yyyy");
    } catch (error) {
      console.warn(`Invalid date: ${dateString}`);
      return 'N/A';
    }
  };

  const handleDownload = useCallback(async () => {
    if (typeof window !== "undefined") {
      try {
        // First try to get from Firestore
        const docRef = doc(db, "articles", documentMetadata.id);
        const docSnap = await getDoc(docRef);
        
        let fullDoc: DocumentFile;
        
        if (docSnap.exists()) {
          const firestoreData = docSnap.data() as FirestoreDocData;
          fullDoc = {
            id: documentMetadata.id,
            name: firestoreData.name || "",
            type: firestoreData.type || "document",
            uploadedAt: typeof firestoreData.uploadedAt === 'object' && firestoreData.uploadedAt?.toDate 
              ? firestoreData.uploadedAt.toDate().toISOString() 
              : typeof firestoreData.uploadedAt === 'string'
                ? firestoreData.uploadedAt
                : new Date().toISOString(),
            textContent: firestoreData.textContent || "",
            summary: firestoreData.summary || undefined,
            coverImageDataUri: firestoreData.coverImageDataUri ?? "",
            author: firestoreData.author ?? "",
            source: firestoreData.source ?? "",
            edition: firestoreData.edition ?? "",
            fileUrl: firestoreData.fileUrl ?? "",
            cloudinaryPublicId: firestoreData.cloudinaryPublicId ?? "",
          };
        } else {
          // Fallback to localStorage
          const item = localStorage.getItem(`docuview-doc-${documentMetadata.id}`);
          if (!item) {
            throw new Error("Document not found in cloud or local storage");
          }
          fullDoc = JSON.parse(item) as DocumentFile;
        }

        let filename = fullDoc.name;
        const nameParts = fullDoc.name.split(".");
        const hasExtension =
          nameParts.length > 1 &&
          nameParts[nameParts.length - 1].length > 0 &&
          nameParts[nameParts.length - 1].length < 5;

        if (!hasExtension) {
          if (fullDoc.type === "text/plain" && !filename.endsWith(".txt")) {
            filename += ".txt";
          } else if (
            fullDoc.type === "application/pdf" &&
            !filename.endsWith(".pdf")
          ) {
            filename += ".pdf";
          } else if (
            (fullDoc.type === "application/msword" ||
              fullDoc.type ===
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document") &&
            !filename.endsWith(".docx")
          ) {
            filename += ".docx";
          }
        }

        let blob: Blob;
        if (fullDoc.fileUrl) {
          const response = await fetch(fullDoc.fileUrl);
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
        } else if (fullDoc.textContent) {
          // If no file URL but we have text content, create a text file
          blob = new Blob([fullDoc.textContent], { type: "text/plain" });
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
    }
  }, [documentMetadata, toast]);

  const displaySource = documentMetadata.source && documentMetadata.source.toLowerCase() !== "file upload";

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg border border-primary/30 overflow-hidden">
      <CardHeader className="pb-3">
        <OptimizedImage
          src={documentMetadata.coverImageDataUri}
          alt={documentMetadata.coverImageDataUri ? `Cover for ${documentMetadata.name}` : "Abstract document representation"}
          width={600}
          height={300}
          className="w-full h-48 object-cover rounded-t-md"
          priority={false}
        />
        <CardTitle className="text-lg font-semibold leading-tight mt-4 truncate" title={documentMetadata.name}>
          {documentMetadata.name}
        </CardTitle>
        <div className="text-xs text-muted-foreground space-y-1 pt-1">
          <div className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            Uploaded: {formatDate(documentMetadata.uploadedAt)}
          </div>
          {documentMetadata.author && (
            <div className="flex items-center gap-1 truncate" title={`Author: ${documentMetadata.author}`}>
              <UserCircle className="w-3 h-3" />
              Author: {documentMetadata.author}
            </div>
          )}
          {displaySource && documentMetadata.source && (
            <div className="flex items-center gap-1 truncate" title={`Source: ${documentMetadata.source}`}>
              <Building className="w-3 h-3" />
              Source: {documentMetadata.source}
            </div>
          )}
          {documentMetadata.edition && (
            <div className="flex items-center gap-1 truncate" title={`Edition: ${documentMetadata.edition}`}>
              <Layers className="w-3 h-3" />
              Edition: {documentMetadata.edition}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {documentMetadata.summary ? documentMetadata.summary : `Type: ${documentMetadata.type || "document"}`}
        </p>
        <div className="flex justify-between items-center mt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Document</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{documentMetadata.name}&quot;? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete && onDelete(documentMetadata.id)} className="bg-destructive hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Link href={`/documents/${documentMetadata.id}`}>
            <Button size="sm">
              View <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
