export enum AuctionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
}

export enum BidStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  OUTBID = 'OUTBID',
}

export enum WebSocketEvents {
  JOIN_AUCTION = 'joinAuction',
  LEAVE_AUCTION = 'leaveAuction',
  PLACE_BID = 'placeBid',
  BID_UPDATE = 'bidUpdate',
  BID_RECEIVED = 'bidReceived',
  AUCTION_UPDATE = 'auctionUpdate',
  AUCTION_END = 'auctionEnd',
  AUCTION_WON = 'auctionWon',
  USER_JOINED = 'userJoined',
  USER_LEFT = 'userLeft',
  OUTBID = 'outbid',
  ERROR = 'error',
}

export enum RabbitMQQueues {
  BID_PROCESSING = 'bid-processing',
  NOTIFICATIONS = 'notifications',
  AUDIT_LOGS = 'audit-logs',
  DEAD_LETTER = 'dead-letter',
}

export enum RedisChannels {
  BID_UPDATES = 'bid-updates',
  AUCTION_EVENTS = 'auction-events',
  GLOBAL_NOTIFICATIONS = 'global-notifications',
}