# Islamic Finance Staff Management System

A comprehensive full-stack web application for Islamic finance operations with role-based access control, user management, and administrative features.

## Features

- **Authentication & Authorization**: Secure login with email/password using Supabase Auth
- **Role-Based Access Control**: Admin, Member, and Viewer roles with granular permissions
- **User Management**: Complete CRUD operations for user accounts via admin panel
- **Dashboard Analytics**: Role-specific dashboards with relevant metrics and quick actions
- **Edge Functions**: Server-side API endpoints for secure admin operations
- **Responsive Design**: Modern, professional UI optimized for desktop and tablet use

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth + PostgreSQL + Edge Functions)
- **State Management**: React Context API
- **Routing**: React Router DOM
- **Icons**: Lucide React

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. Supabase account and project

### Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   - Copy `.env.example` to `.env`
   - Fill in your Supabase project details:
     - `VITE_SUPABASE_URL`: Your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
     - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for Edge Functions)

3. **Set up Supabase**:
   - Click "Connect to Supabase" button in the top right
   - The database schema will be created automatically via migrations
   - Edge functions are deployed automatically

4. **Create test users** (optional):
   You can create test users through the admin panel or directly in Supabase:
   - Admin user: `admin@example.com` / `password123`
   - Member user: `member@example.com` / `password123`

5. **Start development server**:
   ```bash
   npm run dev
   ```

## User Roles & Permissions

### Admin
- Full system access
- User management (create, read, update, delete)
- Access to admin dashboard
- All report and transaction permissions

### Member
- Dashboard access
- View reports
- Create transactions
- Limited system access

### Viewer
- Dashboard access (read-only)
- View reports only
- No transaction or admin capabilities

## Key Features

### Authentication Flow
- Secure login with email/password
- Role-based redirects (Admin → `/admin/dashboard`, Others → `/dashboard`)
- Session management with automatic refresh
- Protected routes with permission checks

### Role-Based Access Control
Helper functions for permission checking:
- `hasPermission(user, resource, action)`
- `hasMenuAccess(user, menuId)`
- `hasSubMenuAccess(user, menuId, subMenuId)`
- `hasComponentAccess(user, componentId)`

### Admin User Management
- Complete user CRUD operations
- Role assignment and modification
- Account activation/deactivation
- Secure API calls via Edge Functions

### Security Features
- Row Level Security (RLS) enabled on all tables
- Service role key secured in Edge Functions
- Authorization header validation
- Admin-only operations protected

## Database Schema

### Tables
- `users`: User profiles with roles and permissions
- `roles`: System roles (admin, member, viewer)
- `permissions`: Granular permissions system
- `role_permissions`: Role-permission relationships

### Key Features
- Automatic timestamp updates
- UUID primary keys
- Foreign key constraints
- Comprehensive RLS policies

## API Endpoints

### Edge Functions
- `POST /functions/v1/admin-users`: Create user
- `GET /functions/v1/admin-users`: List users
- `PUT /functions/v1/admin-users/{id}`: Update user
- `DELETE /functions/v1/admin-users/{id}`: Delete user

All endpoints require admin authorization and include proper error handling.

## Development

### File Structure
- `src/components/`: Reusable UI components
- `src/contexts/`: React contexts (Auth)
- `src/pages/`: Route components
- `src/types/`: TypeScript type definitions
- `src/utils/`: Helper functions and API clients
- `src/lib/`: External service configurations
- `supabase/migrations/`: Database migrations
- `supabase/functions/`: Edge Functions

### Best Practices
- TypeScript for type safety
- Modular component architecture
- Consistent error handling
- Responsive design patterns
- Security-first approach

## Deployment

The application is ready for deployment to any modern hosting platform. Ensure environment variables are properly configured in your deployment environment.

## Contributing

1. Follow the existing code style and patterns
2. Maintain TypeScript strict mode compliance
3. Add proper error handling for new features
4. Update tests for any new functionality
5. Follow the established file organization structure

## License

This project is proprietary software for Islamic finance operations.