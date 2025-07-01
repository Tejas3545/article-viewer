import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#f6f7f8" offset="0%" />
      <stop stop-color="#edeef1" offset="20%" />
      <stop stop-color="#f6f7f8" offset="40%" />
      <stop stop-color="#f6f7f8" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#f6f7f8" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
</svg>`;

const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str);

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
}: OptimizedImageProps) {
  const placeholderDataUrl = `data:image/svg+xml;base64,${toBase64(shimmer(width, height))}`;

  // If src is null or undefined, use placeholder
  if (!src) {
    return (
      <Image
        src={placeholderDataUrl}
        alt={alt}
        width={width}
        height={height}
        className={cn('bg-muted', className)}
        priority={priority}
        placeholder="blur"
        blurDataURL={placeholderDataUrl}
      />
    );
  }

  // If src is a data URI, use it directly
  if (src.startsWith('data:')) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn('bg-muted', className)}
        priority={priority}
        unoptimized={true}
        placeholder="blur"
        blurDataURL={placeholderDataUrl}
      />
    );
  }

  // For regular URLs, use Next.js image optimization
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn('bg-muted', className)}
      priority={priority}
      placeholder="blur"
      blurDataURL={placeholderDataUrl}
      loading={priority ? 'eager' : 'lazy'}
    />
  );
} 