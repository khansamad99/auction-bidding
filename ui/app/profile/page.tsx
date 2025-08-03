'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Auction, Bid } from '@/types';
import Navbar from '@/components/Navbar';
import { formatCurrency, formatDate } from '@/lib/utils';
import { 
  User, 
  Gavel, 
  TrendingUp, 
  Calendar, 
  Car,
  Trophy,
  DollarSign,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface UserStats {
  totalBids: number;
  totalAuctions: number;
  wonAuctions: number;
  totalSpent: number;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [userBids, setUserBids] = useState<Bid[]>([]);
  const [userAuctions, setUserAuctions] = useState<Auction[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalBids: 0,
    totalAuctions: 0,
    wonAuctions: 0,
    totalSpent: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bids' | 'auctions'>('bids');

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const [bidsResponse, auctionsResponse] = await Promise.all([
        api.get(`/bids/user/${user?._id}`),
        api.get(`/auctions?userId=${user?._id}`)
      ]);

      const bids = bidsResponse.data;
      const auctions = auctionsResponse.data;

      setUserBids(bids);
      setUserAuctions(auctions);

      // Calculate stats
      const wonAuctions = bids.filter((bid: Bid) => bid.isWinning).length;
      const totalSpent = bids
        .filter((bid: Bid) => bid.isWinning)
        .reduce((sum: number, bid: Bid) => sum + bid.bidAmount, 0);

      setStats({
        totalBids: bids.length,
        totalAuctions: auctions.length,
        wonAuctions,
        totalSpent
      });
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center h-screen">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Please login to view your profile</p>
            <Link href="/login" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user.username}</h1>
              <p className="text-gray-600">{user.email}</p>
              <p className="text-sm text-gray-500">
                Member since {formatDate(user.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Gavel className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Bids</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalBids}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Car className="w-8 h-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">My Auctions</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalAuctions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Trophy className="w-8 h-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Won Auctions</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.wonAuctions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="w-8 h-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Spent</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(stats.totalSpent)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('bids')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'bids'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  My Bids ({userBids.length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('auctions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'auctions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <Car className="w-4 h-4 mr-2" />
                  My Auctions ({userAuctions.length})
                </div>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'bids' ? (
              <div className="space-y-4">
                {userBids.length === 0 ? (
                  <div className="text-center py-12">
                    <Gavel className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No bids yet</h3>
                    <p className="text-gray-500 mb-4">Start bidding on auctions to see your history here</p>
                    <Link
                      href="/"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Browse Auctions
                    </Link>
                  </div>
                ) : (
                  userBids.map((bid) => (
                    <div
                      key={bid._id}
                      className={`border rounded-lg p-4 ${
                        bid.isWinning ? 'border-green-200 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="text-lg font-medium text-gray-900 truncate">
                              Auction #{bid.auctionId.slice(-6)}
                            </h4>
                            {bid.isWinning && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <Trophy className="w-3 h-3 mr-1" />
                                Winning
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {formatDate(bid.timestamp)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-xl font-bold text-gray-900">
                              {formatCurrency(bid.bidAmount)}
                            </p>
                          </div>
                          <Link
                            href={`/auction/${bid.auctionId}`}
                            className="inline-flex items-center text-blue-600 hover:text-blue-800"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {userAuctions.length === 0 ? (
                  <div className="text-center py-12">
                    <Car className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No auctions created</h3>
                    <p className="text-gray-500 mb-4">Create your first auction to start selling</p>
                    <Link
                      href="/auctions/create"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create Auction
                    </Link>
                  </div>
                ) : (
                  userAuctions.map((auction) => (
                    <div key={auction._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="text-lg font-medium text-gray-900 truncate">
                              {auction.title}
                            </h4>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              auction.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                              auction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {auction.status}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Car className="w-4 h-4 mr-1" />
                              {auction.carId}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDate(auction.startTime)}
                            </span>
                            <span className="flex items-center">
                              <Gavel className="w-4 h-4 mr-1" />
                              {auction.bidCount} bids
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Current Bid</p>
                            <p className="text-xl font-bold text-gray-900">
                              {formatCurrency(auction.currentHighestBid || auction.startingBid)}
                            </p>
                          </div>
                          <Link
                            href={`/auction/${auction._id}`}
                            className="inline-flex items-center text-blue-600 hover:text-blue-800"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}