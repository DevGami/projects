"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Film,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  ArrowLeft,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { Button, Badge, Modal } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { BOOKING_STATUS_STYLES, TIER_COLORS } from "@/lib/constants";

interface BookingDetail {
  id: string;
  movieTitle: string;
  movieTmdbId: number;
  seats: { id: string; tier: string; price: number }[];
  totalAmount: string;
  status: string;
  bookedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  showtime: {
    id: string;
    showDate: string;
    showTime: string;
    screen: {
      name: string;
      theater: { name: string; city: string; address: string };
    };
  };
}

export default function BookingDetailPage() {
  const params = useParams();
  const bookingId = params.id as string;
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuthStore();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    async function fetchBooking() {
      try {
        const res = await api.get<BookingDetail>(`/bookings/${bookingId}`);
        setBooking(res.data || null);
      } catch (err) {
        console.error("Failed to fetch booking:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBooking();
  }, [bookingId, isAuthenticated]);

  async function handleCancel() {
    setIsCancelling(true);
    try {
      await api.post(`/bookings/${bookingId}/cancel`);
      toast.success("Booking cancelled successfully");
      // Refresh
      const res = await api.get<BookingDetail>(`/bookings/${bookingId}`);
      setBooking(res.data || null);
      setShowCancelModal(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to cancel booking");
      }
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-xl text-slate-400">Booking not found</p>
        <Button variant="secondary" onClick={() => router.push("/bookings")}>
          <ArrowLeft className="h-4 w-4" /> My Bookings
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Back */}
      <button
        onClick={() => router.push("/bookings")}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> My Bookings
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* ── Ticket Card ────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-800 border border-white/8 overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-600 to-accent-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-white" />
                <span className="text-sm font-semibold text-white/80">
                  {booking.id}
                </span>
              </div>
              <span
                className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg border ${
                  BOOKING_STATUS_STYLES[booking.status] || BOOKING_STATUS_STYLES.PENDING
                }`}
              >
                {booking.status}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            {/* Movie */}
            <div>
              <h2 className="text-xl font-bold text-white">
                {booking.movieTitle}
              </h2>
            </div>

            {/* Show Info */}
            <div className="grid grid-cols-2 gap-4">
              <InfoItem
                icon={<Calendar className="h-4 w-4 text-brand-400" />}
                label="Date"
                value={new Date(booking.showtime.showDate).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
              <InfoItem
                icon={<Clock className="h-4 w-4 text-brand-400" />}
                label="Time"
                value={booking.showtime.showTime}
              />
              <InfoItem
                icon={<MapPin className="h-4 w-4 text-accent-500" />}
                label="Theater"
                value={booking.showtime.screen.theater.name}
              />
              <InfoItem
                icon={<Film className="h-4 w-4 text-accent-500" />}
                label="Screen"
                value={booking.showtime.screen.name}
              />
            </div>

            {/* Seats */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                Seats ({booking.seats.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {booking.seats.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-1.5 bg-surface-700 rounded-lg px-3 py-1.5 border border-white/8"
                  >
                    <span className="text-sm font-semibold text-white">{s.id}</span>
                    <span
                      className={`text-[10px] font-medium ${TIER_COLORS[s.tier] || "text-slate-400"}`}
                    >
                      {s.tier}
                    </span>
                    <span className="text-xs text-slate-500">₹{Math.round(s.price)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Dashed Divider (ticket tear) ─────────────── */}
            <div className="border-t border-dashed border-white/10 relative">
              <div className="absolute -left-9 -top-3 w-6 h-6 rounded-full bg-surface-900" />
              <div className="absolute -right-9 -top-3 w-6 h-6 rounded-full bg-surface-900" />
            </div>

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Total Amount</span>
              <span className="text-2xl font-bold text-white">
                ₹{Math.round(Number(booking.totalAmount))}
              </span>
            </div>

            {/* Booked Time */}
            <p className="text-xs text-slate-600 text-center">
              Booked on{" "}
              {new Date(booking.bookedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Actions */}
          {booking.status === "PENDING" || booking.status === "CONFIRMED" ? (
            <div className="px-6 pb-5">
              <Button
                variant="danger"
                size="md"
                className="w-full"
                onClick={() => setShowCancelModal(true)}
              >
                <XCircle className="h-4 w-4" />
                Cancel Booking
              </Button>
            </div>
          ) : null}
        </div>
      </motion.div>

      {/* ── Cancel Modal ──────────────────────────────────── */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Booking"
      >
        <p className="text-sm text-slate-300 mb-6">
          Are you sure you want to cancel booking{" "}
          <span className="font-semibold text-white">{booking.id}</span> for{" "}
          <span className="font-semibold text-white">{booking.movieTitle}</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setShowCancelModal(false)}
          >
            Keep Booking
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={handleCancel}
            isLoading={isCancelling}
          >
            Yes, Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-white font-medium">{value}</p>
      </div>
    </div>
  );
}
