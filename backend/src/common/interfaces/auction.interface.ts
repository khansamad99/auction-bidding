import { AuctionStatus, BidStatus } from '../enums/auction.enum';

export interface IAuction {
  _id?: string;
  carId: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  startingBid: number;
  currentHighestBid: number;
  winnerId?: string;
  status: AuctionStatus;
  bidCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBid {
  _id?: string;
  userId: string;
  auctionId: string;
  bidAmount: number;
  timestamp: Date;
  isWinning: boolean;
  status: BidStatus;
}

export interface IUser {
  _id?: string;
  username: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJwtPayload {
  sub: string;
  username: string;
  email: string;
}

export interface IBidEvent {
  auctionId: string;
  bidId: string;
  userId: string;
  username: string;
  bidAmount: number;
  previousHighestBid: number;
  timestamp: Date;
}

export interface IAuctionEvent {
  auctionId: string;
  eventType: 'started' | 'ended' | 'bid_placed';
  data: any;
  timestamp: Date;
}

export interface IConnectedUser {
  userId: string;
  username: string;
  socketId: string;
  auctionId: string;
  connectedAt: Date;
}