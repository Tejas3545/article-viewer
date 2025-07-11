# Article Viewer

A modern web application for viewing, managing, and sharing articles with AI-powered features.

## Features

- Document upload and management
- AI-powered cover image generation
- Cross-device synchronization
- Real-time updates
- Responsive design
- Search functionality
- Document metadata extraction

## Tech Stack

- Next.js 14
- React
- TypeScript
- Firebase/Firestore
- Cloudinary
- TailwindCSS
- Shadcn/ui

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

## Getting Started

1. Clone the repository:
```bash
git clone <repository-url>
cd article-viewer
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
- Copy `.env.example` to `.env.local`
- Fill in your Firebase and Cloudinary credentials

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

The application is configured for easy deployment on Vercel:

1. Push your code to a Git repository
2. Import the project in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy!

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
