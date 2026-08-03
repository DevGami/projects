"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Film, Calendar, Clock, MapPin, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { Badge } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { BOOKING_STATUS_STYLES } from "@/lib/constants";

interface Booking {
  id: string;
  movieTitle: string;
  movieTmdbId: number;
  seats: { id: string; tier: string; price: number }[];
  totalAmount: string;
  status: string;
  bookedAt: string;
  showtime: {
    showDate: string;
    showTime: string;
    screen: {
      name: string;
      theater: { name: string; city: string };
    };
  };
}

export default function BookingsPage() {
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }
  }, [isHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    async function fetchBookings() {
      try {
        const res = await api.get<{ bookings: Booking[] }>("/bookings");
        setBookings(res.data?.bookings || []);
      } catch (err) {
        console.error("Failed to fetch bookings:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBookings();
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-white mb-8">My Bookings</h1>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20">
            <Film className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-lg text-slate-400">No bookings yet</p>
            <p className="text-sm text-slate-600 mt-1">
              Browse movies and book your first show!
            </p>
            <Link
              href="/"
              className="inline-block mt-4 text-sm text-brand-400 hover:text-brand-300 font-medium"
            >
              Explore Movies →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="block group"
              >
                <div className="rounded-2xl bg-surface-800 border border-white/8 p-5 hover:border-brand-500/30 transition-all duration-300">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Movie + Status */}
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-white group-hover:text-brand-300 transition">
                          {booking.movieTitle}
                        </h3>
                        <span
                          className={`inline-flex text-[10px] font-semibold uppercase px-2 py-0.5 rounded-lg border ${
                            BOOKING_STATUS_STYLES[booking.status] || BOOKING_STATUS_STYLES.PENDING
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(booking.showtime.showDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {booking.showtime.showTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {booking.showtime.screen.theater.name}
                        </span>
                      </div>

                      {/* Seats */}
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {booking.seats.map((s) => (
                          <Badge key={s.id} variant="brand">
                            {s.id}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Amount + Arrow */}
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-white">
                        ₹{Math.round(Number(booking.totalAmount))}
                      </p>
                      <p className="text-[10px] text-slate-600 uppercase mt-0.5">
                        {booking.id}
                      </p>
                      <ChevronRight className="h-4 w-4 text-slate-600 ml-auto mt-2 group-hover:text-brand-400 transition" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
