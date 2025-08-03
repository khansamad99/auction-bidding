export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/royal-class-auctions?authSource=admin',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    username: process.env.RABBITMQ_USERNAME || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
    websocketConnectionLimit: parseInt(process.env.WEBSOCKET_CONNECTION_LIMIT || '5', 10),
    bidFrequencyLimit: parseInt(process.env.BID_FREQUENCY_LIMIT || '10', 10),
  },
});