'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { connectSocket, getSocket, disconnectSocket } from '@/lib/socket';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import { Auction, Bid } from '@/types';
import toast from 'react-hot-toast';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  AlertCircle, 
  Gavel, 
  Trophy,
  Zap
} from 'lucide-react';

interface RealTimeBiddingProps {
  auction: Auction;
  initialBids: Bid[];
  onAuctionUpdate: (auction: Auction) => void;
}

export default function RealTimeBidding({ 
  auction: initialAuction, 
  initialBids, 
  onAuctionUpdate 
}: RealTimeBiddingProps) {
  const { user, token } = useAuth();
  const [auction, setAuction] = useState(initialAuction);
  const [bids, setBids] = useState<Bid[]>(initialBids);
  const [bidAmount, setBidAmount] = useState('');
  const [placing, setPlacing] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);
  const [lastBidTime, setLastBidTime] = useState<Date | null>(null);
  const bidSectionRef = useRef<HTMLDivElement>(null);

  // Real-time timer
  useEffect(() => {
    if (auction.status === 'ACTIVE' || auction.status === 'PENDING') {
      const timer = setInterval(() => {
        const end = new Date(auction.endTime).getTime();
        const start = new Date(auction.startTime).getTime();
        const now = new Date().getTime();
        
        // For PENDING auctions, show time until start
        if (auction.status === 'PENDING') {
          const diffToStart = start - now;
          if (diffToStart <= 0) {
            setTimeLeft('Starting...');
            // Refresh the auction data to check if it's now active
            window.location.reload();
          } else {
            const days = Math.floor(diffToStart / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffToStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diffToStart % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffToStart % (1000 * 60)) / 1000);

            if (days > 0) {
              setTimeLeft(`Starts in ${days}d ${hours}h ${minutes}m`);
            } else if (hours > 0) {
              setTimeLeft(`Starts in ${hours}h ${minutes}m ${seconds}s`);
            } else {
              setTimeLeft(`Starts in ${minutes}m ${seconds}s`);
            }
          }
        } else {
          // For ACTIVE auctions, show time until end
          const diff = end - now;
          if (diff <= 0) {
            setTimeLeft('ENDED');
            setAuction(prev => ({ ...prev, status: 'ENDED' }));
            clearInterval(timer);
          } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (days > 0) {
              setTimeLeft(`${days}d ${hours}h ${minutes}m`);
            } else if (hours > 0) {
              setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
            } else {
              setTimeLeft(`${minutes}m ${seconds}s`);
            }
          }
        }
      }, 1000);

      return () => clearInterval(timer);
    } else if (auction.status === 'ENDED') {
      setTimeLeft('ENDED');
    }
  }, [auction]);

  // WebSocket connection and event handlers
  useEffect(() => {
    if (token) {
      const socket = connectSocket(token);
      
      socket.on('connect', () => {
        setIsConnected(true);
        socket.emit('joinAuction', auction._id);
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });
      
      socket.on('bidUpdate', (data) => {
        if (data.auctionId === auction._id) {
          const updatedAuction = {
            ...auction,
            currentHighestBid: data.bidAmount,
            bidCount: auction.bidCount + 1
          };
          setAuction(updatedAuction);
          onAuctionUpdate(updatedAuction);
          
          const newBid = {
            _id: data.bidId,
            userId: data.userId,
            auctionId: data.auctionId,
            bidAmount: data.bidAmount,
            timestamp: data.timestamp,
            isWinning: true,
            user: data.user
          };

          setBids(prev => [newBid, ...prev.map(b => ({ ...b, isWinning: false }))]);
          setLastBidTime(new Date());
          
          if (data.userId !== user?._id) {
            toast.error(`New highest bid: ${formatCurrency(data.bidAmount)}`, {
              icon: '🏁',
              duration: 3000,
            });
          } else {
            toast.success('Your bid is now the highest!', {
              icon: '🎉',
              duration: 4000,
            });
          }
        }
      });
      
      socket.on('auctionEnd', (data) => {
        if (data.auctionId === auction._id) {
          setAuction(prev => ({ ...prev, status: 'ENDED' }));
          toast.success('Auction has ended!', {
            icon: '🏁',
            duration: 5000,
          });
        }
      });

      socket.on('auctionWon', (data) => {
        if (data.auctionId === auction._id) {
          toast.success(data.message, {
            icon: '🏆',
            duration: 8000,
          });
        }
      });

      socket.on('outbid', (data) => {
        if (data.auctionId === auction._id) {
          toast.error(data.message, {
            icon: '😔',
            duration: 5000,
          });
        }
      });

      socket.on('userJoined', () => {
        setActiveUsers(prev => prev + 1);
      });

      socket.on('userLeft', () => {
        setActiveUsers(prev => Math.max(0, prev - 1));
      });
      
      return () => {
        socket.emit('leaveAuction', auction._id);
        socket.off('bidUpdate');
        socket.off('auctionEnd');
        socket.off('auctionWon');
        socket.off('outbid');
        socket.off('userJoined');
        socket.off('userLeft');
      };
    }
  }, [token, auction._id, auction.status, user]);

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please login to place a bid');
      return;
    }

    const amount = parseFloat(bidAmount);
    const minBid = (auction.currentHighestBid || auction.startingBid) + 100;

    if (amount < minBid) {
      toast.error(`Minimum bid amount is ${formatCurrency(minBid)}`);
      return;
    }

    setPlacing(true);

    try {
      const socket = getSocket();
      // Try WebSocket first, fallback to HTTP API
      if (socket && isConnected) {
        socket.emit('placeBid', {
          auctionId: auction._id,
          bidAmount: amount
        });
      } else {
        // Fallback to HTTP API if WebSocket not available
        await api.post('/bids', {
          auctionId: auction._id,
          bidAmount: amount,
          userId: user?._id
        });
      }
      
      setBidAmount('');
      toast.success('Bid submitted! Processing...', {
        icon: '⏳',
        duration: 2000,
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to place bid');
    } finally {
      setPlacing(false);
    }
  };

  const getConnectionStatus = () => {
    if (!user) return { color: 'gray', text: 'Not logged in' };
    if (!token) return { color: 'gray', text: 'No token' };
    if (!isConnected) return { color: 'yellow', text: 'Connecting...' };
    return { color: 'green', text: 'Live' };
  };

  const connectionStatus = getConnectionStatus();
  const isWinning = bids.length > 0 && bids[0].userId === user?._id;
  const minBidAmount = (auction.currentHighestBid || auction.startingBid) + 100;
  const isAuctionActive = auction.status === 'ACTIVE' && timeLeft !== 'ENDED';

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full bg-${connectionStatus.color}-500 animate-pulse`}></div>
            <span className="text-sm font-medium">{connectionStatus.text}</span>
          </div>
          {isConnected && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>{activeUsers} active bidders</span>
            </div>
          )}
        </div>
        {lastBidTime && (
          <div className="text-sm text-gray-500">
            Last bid: {lastBidTime.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Current Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
              <span className="text-sm text-gray-600">Current Highest Bid</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(auction.currentHighestBid || auction.startingBid)}
            </div>
            {isWinning && (
              <div className="flex items-center justify-center mt-2 text-green-600">
                <Trophy className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">You're winning!</span>
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Gavel className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm text-gray-600">Total Bids</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{auction.bidCount}</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-orange-600 mr-2" />
              <span className="text-sm text-gray-600">Time Remaining</span>
            </div>
            <div className={`text-3xl font-bold ${
              timeLeft === 'ENDED' ? 'text-red-600' : 
              timeLeft.includes('m') && !timeLeft.includes('h') ? 'text-orange-600' : 
              'text-gray-900'
            }`}>
              {isAuctionActive ? timeLeft : 'ENDED'}
            </div>
          </div>
        </div>
      </div>

      {/* Bidding Form */}
      {isAuctionActive && user && (
        <div className="bg-white rounded-lg shadow p-6" ref={bidSectionRef}>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Zap className="w-5 h-5 text-yellow-500 mr-2" />
            Place Your Bid
          </h3>
          
          <form onSubmit={handlePlaceBid} className="space-y-4">
            <div>
              <label htmlFor="bidAmount" className="block text-sm font-medium text-gray-700 mb-2">
                Bid Amount (USD)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  id="bidAmount"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  min={minBidAmount}
                  step="100"
                  placeholder={minBidAmount.toString()}
                  className="block w-full pl-7 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  required
                />
              </div>
              <p className="text-sm text-gray-500 mt-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                Minimum bid: {formatCurrency(minBidAmount)}
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setBidAmount(minBidAmount.toString())}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Min Bid
              </button>
              <button
                type="button"
                onClick={() => setBidAmount((minBidAmount + 1000).toString())}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                +$1,000
              </button>
              <button
                type="button"
                onClick={() => setBidAmount((minBidAmount + 5000).toString())}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                +$5,000
              </button>
            </div>

            <button
              type="submit"
              disabled={placing || !isAuctionActive || !user}
              className="w-full px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {placing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Placing Bid...
                </>
              ) : (
                <>
                  <Gavel className="w-5 h-5 mr-2" />
                  Place Bid
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Login prompt */}
      {!user && isAuctionActive && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Login to Bid</h3>
          <p className="text-blue-700 mb-4">You need to be logged in to participate in this auction</p>
          <a
            href="/login"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Login to Bid
          </a>
        </div>
      )}

      {/* Auction ended */}
      {!isAuctionActive && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <Clock className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Auction Ended</h3>
          <p className="text-gray-600">This auction has concluded</p>
          {bids.length > 0 && bids[0].user && (
            <p className="text-sm text-gray-500 mt-2">
              Winner: <span className="font-medium">{bids[0].user.username}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}