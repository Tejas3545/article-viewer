"use client";
import Link from "next/link";
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

interface DocumentCardProps {
  doc: DocumentMetadata;
  onDelete: (id: string) => void;
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

export function DocumentCard({ doc, onDelete }: DocumentCardProps) {
  const { toast } = useToast();

  const handleDownload = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const item = localStorage.getItem(`docuview-doc-${doc.id}`);
        if (item) {
          const fullDoc = JSON.parse(item) as DocumentFile;

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
          if (fullDoc.fileDataUri) {
            blob = dataURIToBlob(fullDoc.fileDataUri);
            toast({
              title: "Download Started",
              description: `${filename} (original file) is downloading.`,
            });
          } else if (fullDoc.textContent) {
            blob = new Blob([fullDoc.textContent], {
              type: fullDoc.type || "application/octet-stream",
            });
            toast({
              title: "Download Started (Text Fallback)",
              description: `${filename} (text representation) is downloading. Original file data not found.`,
              variant: "default",
            });
          } else {
            toast({
              title: "Error",
              description: "No content found for this document.",
              variant: "destructive",
            });
            return;
          }

          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          toast({
            title: "Error",
            description: "Document content not found for download.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error preparing document for download:", error);
        toast({
          title: "Download Error",
          description: "Could not prepare the document for download.",
          variant: "destructive",
        });
      }
    }
  }, [doc, toast]);

  const displaySource =
    doc.source && doc.source.toLowerCase() !== "file upload";

  return (
    <Card className="flex flex-col overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 rounded-lg border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between mb-2">
          <FileText className="w-10 h-10 text-primary flex-shrink-0" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(doc.id)}
            className="text-muted-foreground hover:text-destructive w-8 h-8">
            <Trash2 className="w-4 h-4" />
            <span className="sr-only">Delete document</span>
          </Button>
        </div>
        <CardTitle
          className="text-lg truncate font-semibold leading-tight"
          title={doc.name}>
          {doc.name}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground space-y-0.5 pt-1">
          <div className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            Uploaded:{" "}
            {doc.uploadedAt
              ? format(new Date(doc.uploadedAt), "MMM d, yyyy")
              : "N/A"}
          </div>
          {doc.author && (
            <div
              className="flex items-center gap-1 truncate"
              title={`Author: ${doc.author}`}>
              <UserCircle className="w-3 h-3" />
              Author: {doc.author}
            </div>
          )}
          {displaySource && (
            <div
              className="flex items-center gap-1 truncate"
              title={`Source: ${doc.source}`}>
              <Building className="w-3 h-3" />
              Source: {doc.source}
            </div>
          )}
          {doc.edition && (
            <div
              className="flex items-center gap-1 truncate"
              title={`Edition: ${doc.edition}`}>
              <Layers className="w-3 h-3" />
              Edition: {doc.edition}
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow py-3">
        <p
          className="text-sm text-muted-foreground truncate"
          title={
            displaySource
              ? `Source: ${doc.source}`
              : `Type: ${doc.type || "document"}`
          }>
          {displaySource
            ? `Source: ${doc.source}`
            : `Type: ${doc.type || "document"}`}
        </p>
        {doc.summary && (
          <p
            className="mt-2 text-xs text-muted-foreground line-clamp-3"
            title={doc.summary}>
            <span className="font-medium text-foreground/80">Summary: </span>
            {doc.summary}
          </p>
        )}
      </CardContent>
      <CardFooter className="pt-3 grid grid-cols-2 gap-2">
        <Link href={`/documents/${doc.id}`}>
          <Button
            variant="outline"
            className="w-full border-primary/50 text-primary hover:bg-primary/10">
            <ArrowRight className="mr-2 h-4 w-4" /> Open
          </Button>
        </Link>
        <Button
          variant="outline"
          className="w-full border-accent/50 text-accent hover:bg-accent/10"
          onClick={handleDownload}
          aria-label={`Download ${doc.name}`}>
          <Download className="mr-2 h-4 w-4" /> Download
        </Button>
      </CardFooter>
    </Card>
  );
}
