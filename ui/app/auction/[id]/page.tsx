'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Auction, Bid } from '@/types';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import RealTimeBidding from '@/components/RealTimeBidding';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Car, Calendar, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function AuctionDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchAuctionDetails();
      fetchBidHistory();
    }
  }, [params.id]);

  const fetchAuctionDetails = async () => {
    try {
      const response = await api.get(`/auctions/${params.id}`);
      setAuction(response.data);
    } catch (error) {
      toast.error('Failed to load auction details');
    } finally {
      setLoading(false);
    }
  };

  const fetchBidHistory = async () => {
    try {
      const response = await api.get(`/auctions/${params.id}/bids`);
      setBids(response.data);
    } catch (error) {
      console.error('Failed to load bid history');
    }
  };

  const handleAuctionUpdate = (updatedAuction: Auction) => {
    setAuction(updatedAuction);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="text-center py-12">
          <p className="text-gray-500">Auction not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Auctions
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{auction.title}</h1>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span className="flex items-center">
              <Car className="w-4 h-4 mr-1" />
              {auction.carId}
            </span>
            <span className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              {formatDate(auction.startTime)} - {formatDate(auction.endTime)}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              auction.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
              auction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {auction.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-3">About This Car</h2>
              <p className="text-gray-700 leading-relaxed">{auction.description}</p>
              
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t">
                <div>
                  <p className="text-sm text-gray-500">Starting Bid</p>
                  <p className="font-medium text-lg flex items-center">
                    <DollarSign className="w-4 h-4 mr-1" />
                    {formatCurrency(auction.startingBid)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Bids</p>
                  <p className="font-medium text-lg">{auction.bidCount}</p>
                </div>
              </div>
            </div>

            {/* Real-time Bidding Component */}
            <RealTimeBidding 
              auction={auction}
              initialBids={bids}
              onAuctionUpdate={handleAuctionUpdate}
            />
          </div>

          {/* Bid History Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-xl font-semibold mb-4">Recent Bids</h2>
              
              {bids.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <DollarSign className="w-8 h-8 mx-auto" />
                  </div>
                  <p className="text-gray-500">No bids yet</p>
                  <p className="text-sm text-gray-400 mt-1">Be the first to bid!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {bids.slice(0, 10).map((bid, index) => (
                    <div
                      key={bid._id}
                      className={`p-3 rounded-lg border ${
                        bid.isWinning 
                          ? 'bg-green-50 border-green-200' 
                          : index === 0 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {bid.user?.username || 'Anonymous'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(bid.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {formatCurrency(bid.bidAmount)}
                          </p>
                          {bid.isWinning && (
                            <p className="text-xs text-green-600 font-medium">Winning</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {auction.status === 'ENDED' && bids.length > 0 && bids[0].user && (
                <div className="mt-6 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-yellow-500 mb-2">
                      <svg className="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2L13 8l6 .75-4.12 4.62L16 19l-6-3-6 3 1.13-5.63L1 8.75 7 8l3-6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900">Auction Winner</h3>
                    <p className="text-lg font-bold text-green-600 mt-1">
                      {bids[0].user.username}
                    </p>
                    <p className="text-sm text-gray-600">
                      Winning bid: {formatCurrency(bids[0].bidAmount)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}