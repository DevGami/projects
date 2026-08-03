"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Monitor,
  Clock,
  MapPin,
  Calendar,
  Minus,
  Plus,
  ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { TIER_COLORS, TIER_SELECTED_STYLES, RAZORPAY_KEY_ID } from "@/lib/constants";

// ── Types ───────────────────────────────────────────────────────────────────
interface Seat {
  id: string;
  row: string;
  col: number;
  tier: string;
  price: number;
  status: "available" | "booked" | "held";
}

interface SeatRow {
  row: string;
  tier: string;
  seats: Seat[];
}

interface ShowtimeDetail {
  id: string;
  movieTitle: string;
  movieTmdbId: number;
  showDate: string;
  showTime: string;
  priceMultiplier: string;
  screen: {
    id: string;
    name: string;
    rows: number;
    cols: number;
    seatLayout: { tier: string; rows: string; price: number }[];
    theater: { name: string; city: string; address: string };
  };
}

interface SeatMapData {
  showtime: ShowtimeDetail;
  seatMap: SeatRow[];
  summary: { totalSeats: number; booked: number; held: number; available: number };
}

// ═══════════════════════════════════════════════════════════════════════════
export default function BookingPage() {
  const params = useParams();
  const showtimeId = params.showtimeId as string;
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuthStore();

  const [data, setData] = useState<SeatMapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [isBooking, setIsBooking] = useState(false);

  // Auth guard
  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      toast.error("Please login to book tickets");
      router.push(`/auth/login?redirect=${encodeURIComponent(`/book/${showtimeId}`)}`);
    }
  }, [isHydrated, isAuthenticated, router, showtimeId]);

  // Fetch seat map
  useEffect(() => {
    async function fetchSeatMap() {
      try {
        const res = await api.get<SeatMapData>(`/showtimes/${showtimeId}`);
        setData(res.data || null);
      } catch (err) {
        console.error("Failed to fetch seat map:", err);
        toast.error("Failed to load seat map");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSeatMap();
  }, [showtimeId]);

  // Toggle seat selection
  function toggleSeat(seat: Seat) {
    if (seat.status !== "available") return;

    setSelectedSeats((prev) => {
      const isSelected = prev.some((s) => s.id === seat.id);
      if (isSelected) {
        return prev.filter((s) => s.id !== seat.id);
      }
      if (prev.length >= 10) {
        toast.error("Maximum 10 seats per booking");
        return prev;
      }
      return [...prev, seat];
    });
  }

  // Calculate total
  const totalAmount = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  // Create booking
  async function handleBooking() {
    if (selectedSeats.length === 0) {
      toast.error("Select at least one seat");
      return;
    }

    setIsBooking(true);
    try {
      const bookingRes = await api.post<{
        id: string;
        totalAmount: string;
        status: string;
      }>("/bookings", {
        showtimeId,
        seats: selectedSeats.map((s) => ({
          id: s.id,
          tier: s.tier,
          price: s.price,
        })),
      });

      const booking = bookingRes.data!;
      toast.success(`Booking ${booking.id} created! Proceeding to payment...`);

      // Create payment order
      const payRes = await api.post<{
        order: { id: string; amount: number; currency: string };
        paymentId: string;
        key: string;
      }>("/payments/order", { bookingId: booking.id });

      const payment = payRes.data!;

      // Open Razorpay Checkout
      openRazorpayCheckout(payment, booking.id);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Booking failed. Try again.");
      }
      setIsBooking(false);
    }
  }

  // Razorpay Checkout
  function openRazorpayCheckout(
    payment: {
      order: { id: string; amount: number; currency: string };
      paymentId: string;
      key: string;
    },
    bookingId: string
  ) {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => {
      const options = {
        key: payment.key || RAZORPAY_KEY_ID,
        amount: payment.order.amount,
        currency: payment.order.currency,
        name: "BookYourShow",
        description: `Booking ${bookingId}`,
        order_id: payment.order.id,
        handler: async function (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) {
          try {
            await api.post("/payments/verify", {
              ...response,
              bookingId,
            });
            toast.success("Payment successful! Booking confirmed 🎬");
            router.push(`/bookings/${bookingId}`);
          } catch (err) {
            if (err instanceof ApiError) {
              toast.error(err.message);
            } else {
              toast.error("Payment verification failed");
            }
          }
          setIsBooking(false);
        },
        modal: {
          ondismiss: function () {
            toast.error("Payment cancelled");
            setIsBooking(false);
          },
        },
        prefill: {
          email: useAuthStore.getState().user?.email || "",
        },
        theme: {
          color: "#7C3AED",
        },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    };
    document.body.appendChild(script);
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-400">Showtime not found</p>
      </div>
    );
  }

  const { showtime, seatMap, summary } = data;

  // Get unique tiers for the legend
  const tiers = [...new Set(seatMap.map((r) => r.tier))];

  return (
    <div className="min-h-screen mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* ── Show Info ──────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-800 border border-white/8 p-5 mb-6">
          <h1 className="text-xl font-bold text-white mb-2">
            {showtime.movieTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-accent-500" />
              {showtime.screen.theater.name} — {showtime.screen.name}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(showtime.showDate).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {showtime.showTime}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Seat Map ───────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-surface-800 border border-white/8 p-5 overflow-x-auto">
              {/* Screen indicator */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-3/4 h-2 bg-gradient-to-r from-transparent via-brand-400/60 to-transparent rounded-full" />
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <Monitor className="h-3 w-3" />
                  Screen this way
                </div>
              </div>

              {/* Seat Grid */}
              <div className="flex flex-col items-center gap-1.5 min-w-fit">
                {seatMap.map((row, rowIdx) => {
                  // Show tier label when tier changes
                  const prevTier = rowIdx > 0 ? seatMap[rowIdx - 1].tier : null;
                  const showTierLabel = row.tier !== prevTier;

                  return (
                    <div key={row.row}>
                      {showTierLabel && (
                        <div className="flex items-center gap-2 mb-2 mt-3 first:mt-0">
                          <span
                            className={`text-xs font-semibold uppercase tracking-wider ${
                              TIER_COLORS[row.tier] || "text-slate-400"
                            }`}
                          >
                            {row.tier} — ₹
                            {Math.round(row.seats[0]?.price || 0)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        {/* Row label */}
                        <span className="w-6 text-center text-xs font-semibold text-slate-500">
                          {row.row}
                        </span>

                        {/* Seats */}
                        {row.seats.map((seat) => {
                          const isSelected = selectedSeats.some(
                            (s) => s.id === seat.id
                          );
                          let seatClass =
                            "border border-emerald-500/50 text-emerald-500 hover:border-emerald-400 hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer";
                          if (seat.status === "booked")
                            seatClass =
                              "bg-slate-700 border-slate-700 text-slate-400 cursor-not-allowed opacity-50";
                          else if (seat.status === "held")
                            seatClass =
                              "bg-amber-600/60 border-amber-600/60 text-amber-200/50 cursor-not-allowed opacity-60";
                          else if (isSelected)
                            seatClass =
                              TIER_SELECTED_STYLES[seat.tier] || "bg-cyan-500 ring-2 ring-cyan-300 cursor-pointer text-white";

                          return (
                            <button
                              key={seat.id}
                              onClick={() => toggleSeat(seat)}
                              disabled={seat.status !== "available"}
                              className={`w-7 h-7 rounded-md text-[10px] font-medium transition-all duration-150 ${seatClass}`}
                              title={`${seat.id} — ₹${Math.round(seat.price)} (${seat.tier})`}
                            >
                              {seat.col}
                            </button>
                          );
                        })}

                        {/* Row label (right) */}
                        <span className="w-6 text-center text-xs font-semibold text-slate-500">
                          {row.row}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Legend ──────────────────────────────────── */}
              <div className="flex flex-wrap items-center justify-center gap-4 mt-8 pt-4 border-t border-white/5">
                <LegendItem color="border border-emerald-500/50 text-emerald-500" label="Available" />
                <LegendItem color="bg-slate-300 border-slate-300" label="Selected" />
                <LegendItem color="bg-slate-700 border-slate-700 opacity-50" label="Booked" />
                <LegendItem color="bg-amber-600/60 border-amber-600/60 opacity-60" label="Held" />
              </div>
            </div>
          </div>

          {/* ── Booking Summary ─────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-surface-800 border border-white/8 p-5 sticky top-20">
              <h3 className="text-sm font-semibold text-white mb-4">
                Booking Summary
              </h3>

              {selectedSeats.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">
                  Select seats from the map to proceed
                </p>
              ) : (
                <>
                  {/* Selected Seats */}
                  <div className="space-y-2 mb-4">
                    {selectedSeats
                      .sort((a, b) => a.id.localeCompare(b.id))
                      .map((seat) => (
                        <div
                          key={seat.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="brand">{seat.id}</Badge>
                            <span className="text-xs text-slate-500">
                              {seat.tier}
                            </span>
                          </div>
                          <span className="text-white font-medium">
                            ₹{Math.round(seat.price)}
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/10 pt-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">
                        {selectedSeats.length} Ticket{selectedSeats.length > 1 ? "s" : ""}
                      </span>
                      <span className="text-xl font-bold text-white">
                        ₹{Math.round(totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Pay Button */}
                  <Button
                    variant="accent"
                    size="lg"
                    className="w-full"
                    onClick={handleBooking}
                    isLoading={isBooking}
                  >
                    Pay ₹{Math.round(totalAmount)}
                  </Button>
                </>
              )}

              {/* Availability Summary */}
              <div className="mt-6 pt-4 border-t border-white/5 text-xs text-slate-500 space-y-1">
                <p>Available: {summary.available}</p>
                <p>Booked: {summary.booked}</p>
                <p>Held: {summary.held}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-5 h-5 rounded-md ${color}`} />
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}
