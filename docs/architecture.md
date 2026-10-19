# SubReel — Architecture

## Product
SubReel is a unified platform for watching video content,
reading books and comics, and enjoying content together.

## Clients
- Web: Next.js, React, TypeScript.
- Mobile: React Native with Expo, planned for a later stage.

## Backend
- Supabase PostgreSQL for structured data.
- Supabase Auth for authentication.
- Supabase Realtime for live events and synchronized rooms.
- Object storage for images and authorized media assets.

## Core content model
- Franchise
- Title
- Title relationships
- Season and episode for video content
- Volume and chapter for reading content
- Media provider and source
- User profile and personal progress

## Main product areas
- Catalog and search
- Franchise and title pages
- Video player
- Reading interface
- User profiles and progress
- Watch/read together rooms
- Administration and moderation

## Architecture principles
- One shared backend for web and future mobile clients.
- Separate franchises from individual titles.
- Keep video and reading content models extensible.
- Keep media providers replaceable.
- Never expose server secrets in client-side code.
- Use only content that we own, license, or are authorized to access.
- Add dependencies only when needed.
