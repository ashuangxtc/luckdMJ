# 麻将抽奖系统

## Overview

This is a Chinese mahjong-themed lottery system where users flip mahjong tiles to win prizes. The system features a mobile-first design with traditional mahjong visual elements, including shuffling and flipping animations. Users have one chance to participate, and winners receive redeemable codes for tote bags. The application includes an admin dashboard for managing the lottery activity status, configuring win probabilities, and viewing participation statistics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript running on Vite
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Radix UI primitives with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom mahjong-themed color scheme (deep green, gold accents, ivory white)
- **State Management**: React Query for server state, local React state for UI interactions
- **Design System**: Mobile-first responsive design with custom CSS animations for tile shuffling and flipping

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript with ESNext modules
- **API Design**: RESTful endpoints for activity status, lottery draws, and admin functions
- **Middleware**: Custom request logging and admin authentication middleware
- **Session Management**: Express sessions with PostgreSQL store

### Database Design
- **ORM**: Drizzle ORM with PostgreSQL
- **Schema**: 
  - Users table for admin authentication
  - Events table for activity state management (waiting/open/closed with optional time windows)
  - Draws table for lottery participation records with unique user keys
  - Configs table for system settings like win probability
- **User Identification**: MD5 hash of IP address + User Agent for one-time participation enforcement

### Activity State Management
- **Status Control**: Three states (waiting, open, closed) with optional time-based automation
- **Admin Controls**: Manual status changes and time window configuration
- **Real-time Updates**: Polling-based status checking on frontend

### Game Mechanics
- **Participation**: One chance per user based on device fingerprinting
- **Animation System**: CSS keyframes for tile shuffling and 3D flip transitions
- **Prize Generation**: Configurable win probability with unique redemption code generation
- **Result Display**: Modal overlays with traditional Chinese styling

### Security & Access Control
- **Admin Authentication**: Password-based authentication with header-based verification
- **Rate Limiting**: One draw per unique user key (IP + User Agent hash)
- **Input Validation**: Zod schemas for API request validation

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM, React Query for state management
- **Build Tools**: Vite for development and bundling, TypeScript for type safety
- **Routing**: Wouter for client-side navigation

### UI and Styling
- **Component Library**: Radix UI primitives for accessibility-compliant components
- **Styling**: Tailwind CSS with custom configuration, PostCSS for processing
- **Icons**: Lucide React icon library

### Backend Services
- **Database**: Neon Database (PostgreSQL) as the managed database service
- **ORM**: Drizzle ORM with Drizzle Kit for migrations
- **Session Storage**: connect-pg-simple for PostgreSQL session storage

### Development and Deployment
- **Runtime Environment**: Node.js with Express server
- **Development**: tsx for TypeScript execution, esbuild for production builds
- **Code Quality**: TypeScript strict mode, ESLint configuration implied through shadcn/ui setup

### Utility Libraries
- **Date Handling**: date-fns for date manipulation
- **Validation**: Zod for schema validation and type inference
- **Styling Utilities**: clsx and tailwind-merge for conditional class names
- **Animation**: CSS-based animations with Embla Carousel for potential future carousel features