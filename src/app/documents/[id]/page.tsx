import { DocumentView } from '@/components/document/DocumentView';

interface DocumentPageProps {
  params: {
    id: string;
  };
}

// This page will be client-rendered due to reliance on localStorage in DocumentView
// export const dynamic = 'force-dynamic'; // Not needed as child is client component

export default function DocumentPage({ params }: DocumentPageProps) {
  if (!params.id) {
    // This case should ideally be handled by Next.js routing or a not-found page
    return <div>Error: Document ID is missing.</div>;
  }
  return <DocumentView docId={params.id} />;
}
