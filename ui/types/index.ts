export interface User {
  _id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface Auction {
  _id: string;
  carId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  startingBid: number;
  currentHighestBid: number;
  winnerId?: string;
  status: 'PENDING' | 'ACTIVE' | 'ENDED';
  bidCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Bid {
  _id: string;
  userId: string;
  auctionId: string;
  bidAmount: number;
  timestamp: string;
  isWinning: boolean;
  user?: User;
}