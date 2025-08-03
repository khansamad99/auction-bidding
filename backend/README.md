# Royal Class Live Car Bidding System - Backend

A high-performance, real-time bidding system built with NestJS, MongoDB, Redis, and RabbitMQ for live car auctions.

## 🚀 Features

### Core Functionality
- **Real-time Bidding**: WebSocket-based live bidding with Socket.IO
- **User Authentication**: JWT-based authentication with bcrypt password hashing
- **Auction Management**: Complete CRUD operations for car auctions
- **Bid Processing**: Atomic bid placement with concurrency handling
- **Rate Limiting**: DDoS protection with configurable throttling

### Database & Caching
- **MongoDB**: Document-based storage with Mongoose ODM
- **Redis**: High-performance caching and pub/sub messaging
- **RabbitMQ**: Reliable message queuing for audit logs and notifications

### Security & Performance
- **Input Validation**: Class-validator with DTO validation
- **CORS Protection**: Configurable cross-origin resource sharing
- **Atomic Operations**: MongoDB transactions for data consistency
- **Optimized Queries**: Strategic indexing for high-performance reads

## 🛠 Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis for session management and real-time data
- **Message Queue**: RabbitMQ for reliable event processing
- **WebSocket**: Socket.IO for real-time communication
- **Authentication**: JWT with Passport strategies
- **Validation**: Class-validator and class-transformer

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker and Docker Compose (for development services)

## 🚀 Quick Start

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Development Services

```bash
# Start MongoDB, Redis, and RabbitMQ
npm run docker:dev:up

# View service logs
npm run docker:dev:logs
```

### 4. Run the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production build
npm run build
npm run start:prod
```

## 🔧 Environment Variables

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/royal-class-auctions

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=1d

# Application Configuration
PORT=3000
NODE_ENV=development

# Rate Limiting Configuration
THROTTLE_TTL=60
THROTTLE_LIMIT=100
WEBSOCKET_CONNECTION_LIMIT=5
BID_FREQUENCY_LIMIT=10
```

## 📚 API Documentation

### Authentication Endpoints

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/profile
```

### Auction Endpoints

```http
GET    /api/auctions              # Get all auctions
GET    /api/auctions/active       # Get active auctions
GET    /api/auctions/upcoming     # Get upcoming auctions
GET    /api/auctions/:id          # Get specific auction
GET    /api/auctions/:id/stats    # Get auction statistics
POST   /api/auctions              # Create new auction
PATCH  /api/auctions/:id          # Update auction
DELETE /api/auctions/:id          # Delete auction
POST   /api/auctions/:id/start    # Start auction
POST   /api/auctions/:id/end      # End auction
```

### Bidding Endpoints

```http
POST /api/bids                           # Place a bid
GET  /api/bids/auction/:id               # Get auction bids
GET  /api/bids/auction/:id/history       # Get bid history (paginated)
GET  /api/bids/auction/:id/highest       # Get current highest bid
GET  /api/bids/auction/:id/stats         # Get bidding statistics
GET  /api/bids/user/:id                  # Get user's bids
```

### User Endpoints

```http
GET    /api/users     # Get all users
GET    /api/users/:id # Get specific user
DELETE /api/users/:id # Delete user
```


## 🗄 Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  username: String (unique),
  email: String (unique),
  password: String (hashed),
  createdAt: Date,
  updatedAt: Date
}
```

### Auctions Collection
```javascript
{
  _id: ObjectId,
  carId: String,
  title: String,
  description: String,
  startTime: Date,
  endTime: Date,
  startingBid: Number,
  currentHighestBid: Number,
  winnerId: ObjectId (ref: Users),
  status: String, // 'PENDING', 'ACTIVE', 'ENDED'
  bidCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Bids Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: Users),
  auctionId: ObjectId (ref: Auctions),
  bidAmount: Number,
  timestamp: Date,
  isWinning: Boolean,
  status: String // 'PENDING', 'ACCEPTED', 'REJECTED'
}
```

## 🔍 Performance Optimizations

### Database Indexes
- **Users**: `username`, `email` (unique indexes)
- **Auctions**: `status + startTime`, `endTime`, `currentHighestBid`
- **Bids**: `auctionId + timestamp`, `auctionId + bidAmount`, `userId + timestamp`

### Caching Strategy
- Current highest bids cached in Redis
- Session data stored in Redis
- Pub/Sub channels for real-time updates

### Concurrency Handling
- MongoDB transactions for atomic bid operations
- Optimistic locking for auction updates
- Race condition prevention with `findOneAndUpdate`

## 🚧 Development Commands

```bash
# Development services
npm run docker:dev:up      # Start MongoDB, Redis, RabbitMQ
npm run docker:dev:down    # Stop all services
npm run docker:dev:logs    # View service logs

# Application
npm run start:dev          # Development mode with hot reload
npm run start:debug        # Debug mode
npm run build              # Production build
npm run lint               # ESLint code analysis
npm run format             # Prettier code formatting
```

## 🐳 Docker Services

The development environment includes:

- **MongoDB 7.0**: Primary database
- **Redis 7.2**: Caching and pub/sub messaging
- **RabbitMQ 3.13**: Message queuing with management UI

Access RabbitMQ Management UI at: http://localhost:15672 (guest/guest)

## 🔐 Security Features

### Authentication & Authorization
- JWT tokens with configurable expiration
- bcrypt password hashing (12 rounds)
- Passport.js integration with local and JWT strategies

### Rate Limiting & DDoS Protection
- Global API rate limiting (100 requests/minute by default)
- WebSocket connection limits (5 per IP)
- Bid frequency limiting (10 bids/minute per user)

### Input Validation
- DTO-based request validation
- Whitelist validation (strips unknown properties)
- Transform validation for data sanitization

## 🚀 Production Deployment

### Build for Production
```bash
npm run build
npm run start:prod
```

### Environment Considerations
- Use strong JWT secrets in production
- Configure MongoDB with authentication
- Set up Redis clustering for high availability
- Configure RabbitMQ clustering for reliability
- Use reverse proxy (nginx) for load balancing

## 🤝 API Usage

You can test the API endpoints with any HTTP client:

1. Register a new user via `/api/auth/register`
2. Login to get JWT token via `/api/auth/login`
3. Create auctions via `/api/auctions`
4. Place bids via `/api/bids`
5. Connect to WebSocket for real-time events

## 📝 Logging & Monitoring

- Structured logging with NestJS Logger
- Request/response logging middleware
- Error tracking and handling
- Performance monitoring ready

## 🔄 Message Queues

### RabbitMQ Queues
- `bid-processing`: Process incoming bids with validation
- `notifications`: Send real-time notifications to users
- `audit-logs`: Log all auction activities for compliance
- `dead-letter`: Handle failed message processing

### Redis Pub/Sub Channels
- `auction:{auctionId}:bids`: Bid updates for specific auction
- `auction:{auctionId}:events`: General auction events
- `global:notifications`: System-wide notifications

## 🎯 Key Features Implementation

### Real-time Bidding
- WebSocket gateway with Socket.IO
- Room-based auction channels
- Automatic reconnection handling
- Concurrent bid validation

### High Performance
- Database connection pooling
- Redis caching layer
- Optimized database queries
- Memory usage monitoring

### Scalability
- Horizontal scaling support
- Microservices-ready architecture
- Load balancer compatible
- Session management with Redis

---

**Built with ❤️ for Royal Class Live Car Bidding System**