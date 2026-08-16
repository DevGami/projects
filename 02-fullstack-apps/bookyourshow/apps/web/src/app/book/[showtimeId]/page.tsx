"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Monitor,
  Clock,
  MapPin,
  Calendar,
  ArrowLeft,
  Armchair,
  RefreshCw,
  Timer,
} from "lucide-react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  TIER_COLORS,
  TIER_BORDER_COLORS,
  TIER_SELECTED_STYLES,
  TIER_HOVER_STYLES,
  TIER_DOT_COLORS,
  TIER_ORDER,
  RAZORPAY_KEY_ID,
} from "@/lib/constants";

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [isBooking, setIsBooking] = useState(false);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { execute: executeRecaptcha } = useRecaptcha();

  // Seat map fetcher (reusable for both initial load and polling)
  const fetchSeatMap = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await api.get<SeatMapData>(`/showtimes/${showtimeId}`);
      setData(res.data || null);
      // Clear any selected seats that became booked/held by others
      if (res.data) {
        const bookedOrHeld = new Set(
          res.data.seatMap.flatMap((row) =>
            row.seats.filter((s) => s.status !== "available").map((s) => s.id)
          )
        );
        setSelectedSeats((prev) => prev.filter((s) => !bookedOrHeld.has(s.id)));
      }
    } catch (err) {
      if (!silent) toast.error("Failed to load seat map");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showtimeId]);


  // Auth guard
  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      toast.error("Please login to book tickets");
      router.push(`/auth/login?redirect=${encodeURIComponent(`/book/${showtimeId}`)}`);
    }
  }, [isHydrated, isAuthenticated, router, showtimeId]);

  // Initial fetch + 30-second live refresh poll
  useEffect(() => {
    fetchSeatMap(false);
    // Poll every 30s to show live hold changes from other users
    pollTimerRef.current = setInterval(() => fetchSeatMap(true), 30_000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchSeatMap]);

  // 5-minute countdown timer when seats are selected
  useEffect(() => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    if (selectedSeats.length === 0) {
      setHoldSecondsLeft(null);
      return;
    }
    // Start 5-min countdown
    setHoldSecondsLeft(5 * 60);
    holdTimerRef.current = setInterval(() => {
      setHoldSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(holdTimerRef.current!);
          toast.error("Your seat hold expired. Please reselect.");
          setSelectedSeats([]);
          fetchSeatMap(true);
          return null;
        }
        return prev - 1;
      });
    }, 1_000);
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    };
  }, [selectedSeats.length > 0, fetchSeatMap]);


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

  // Create booking + open Razorpay
  async function handleBooking() {
    if (selectedSeats.length === 0) {
      toast.error("Select at least one seat");
      return;
    }

    setIsBooking(true);
    try {
      const captchaToken = await executeRecaptcha("create_booking");

      const bookingRes = await api.post<{
        id: string;
        totalAmount: string;
        status: string;
      }>("/bookings", {
        showtimeId,
        captchaToken,
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
      openRazorpayCheckout(payment, booking.id);
    } catch (err) {
      if (err instanceof ApiError) {
        // Handle seat hold expired — clear selection and refresh
        if (err.code === "SEAT_HOLD_EXPIRED") {
          toast.error("Your seat hold expired. Please select seats again.", { duration: 5000 });
          setSelectedSeats([]);
          fetchSeatMap(true);
        } else if (err.code === "SEAT_CONFLICT") {
          toast.error("Some seats were taken. Please reselect.", { duration: 5000 });
          setSelectedSeats([]);
          fetchSeatMap(true);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Booking failed. Please try again.");
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

  // Group rows by tier for rendering tier sections
  const tierSections: { tier: string; rows: SeatRow[] }[] = [];
  let currentTier = "";
  for (const row of seatMap) {
    if (row.tier !== currentTier) {
      tierSections.push({ tier: row.tier, rows: [row] });
      currentTier = row.tier;
    } else {
      tierSections[tierSections.length - 1].rows.push(row);
    }
  }

  // Sort tier sections by defined order
  tierSections.sort((a, b) => {
    const ai = TIER_ORDER.indexOf(a.tier);
    const bi = TIER_ORDER.indexOf(b.tier);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

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
            <div className="rounded-2xl bg-surface-800 border border-white/8 p-5 overflow-hidden">
              {/* Screen indicator */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-3/4 h-1.5 bg-gradient-to-r from-transparent via-slate-400/50 to-transparent rounded-full" />
                <div className="w-2/3 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent mt-1" />
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <Monitor className="h-3 w-3" />
                  Screen this way
                </div>
              </div>

              {/* Seat Grid — Tier Sections */}
              <div className="flex flex-col items-center gap-0">
                {tierSections.map((section, sectionIdx) => {
                  const tierPrice = section.rows[0]?.seats[0]?.price || 0;
                  const isRecliner = section.tier === "Recliner";

                  return (
                    <div key={section.tier} className="w-full">
                      {/* Tier divider */}
                      {sectionIdx > 0 && (
                        <div
                          className={`${
                            isRecliner ? "mt-8 mb-3" : "mt-5 mb-2"
                          }`}
                        >
                          <div className="border-t border-white/5" />
                        </div>
                      )}

                      {/* Tier label */}
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-widest ${
                            TIER_COLORS[section.tier] || "text-slate-400"
                          }`}
                        >
                          {isRecliner && (
                            <Armchair className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                          )}
                          {section.tier}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          ₹{Math.round(tierPrice)}
                        </span>
                        <div className="flex-1 h-px bg-white/5" />
                      </div>

                      {/* Rows */}
                      <div className="flex flex-col items-center gap-1.5">
                        {section.rows.map((row) => (
                          <div key={row.row} className="flex items-center gap-1">
                            {/* Row label left */}
                            <span className="w-5 text-center text-[10px] font-semibold text-slate-600">
                              {row.row}
                            </span>

                            {/* Seats */}
                            <div className="flex items-center gap-1">
                              {row.seats.map((seat) => {
                                const isSelected = selectedSeats.some(
                                  (s) => s.id === seat.id
                                );

                                // Determine seat style
                                let seatClass: string;
                                if (seat.status === "booked") {
                                  seatClass =
                                    "bg-slate-800/80 border-slate-700/50 text-slate-700 cursor-not-allowed";
                                } else if (seat.status === "held") {
                                  seatClass =
                                    "bg-transparent border-amber-500/30 text-amber-500/40 cursor-not-allowed";
                                } else if (isSelected) {
                                  seatClass =
                                    TIER_SELECTED_STYLES[seat.tier] ||
                                    "bg-cyan-500 border-cyan-500 text-white";
                                } else {
                                  // Available — transparent with tier-colored border
                                  seatClass = `bg-transparent ${
                                    TIER_BORDER_COLORS[seat.tier] || "border-slate-500/40"
                                  } text-slate-500 cursor-pointer ${
                                    TIER_HOVER_STYLES[seat.tier] || "hover:bg-white/5"
                                  }`;
                                }

                                const seatSize = isRecliner
                                  ? "w-8 h-8 rounded-lg text-[11px]"
                                  : "w-7 h-7 rounded-md text-[10px]";

                                return (
                                  <button
                                    key={seat.id}
                                    onClick={() => toggleSeat(seat)}
                                    disabled={seat.status !== "available"}
                                    className={`${seatSize} border font-medium transition-all duration-150 ${seatClass}`}
                                    title={`${seat.id} — ₹${Math.round(
                                      seat.price
                                    )} (${seat.tier})`}
                                  >
                                    {seat.col}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Row label right */}
                            <span className="w-5 text-center text-[10px] font-semibold text-slate-600">
                              {row.row}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Legend ──────────────────────────────────── */}
              <div className="mt-8 pt-4 border-t border-white/5">
                {/* Status legend */}
                <div className="flex flex-wrap items-center justify-center gap-5 mb-3">
                  <LegendItem
                    swatch={
                      <div className="w-5 h-5 rounded-md border border-slate-500/40 bg-transparent" />
                    }
                    label="Available"
                  />
                  <LegendItem
                    swatch={
                      <div className="w-5 h-5 rounded-md bg-slate-400 shadow-sm" />
                    }
                    label="Selected"
                  />
                  <LegendItem
                    swatch={
                      <div className="w-5 h-5 rounded-md bg-slate-800/80 border border-slate-700/50" />
                    }
                    label="Booked"
                  />
                </div>
                {/* Tier color legend */}
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {TIER_ORDER.map((tier) => (
                    <div key={tier} className="flex items-center gap-1.5">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          TIER_DOT_COLORS[tier] || "bg-slate-400"
                        }`}
                      />
                      <span className="text-[10px] text-slate-500">{tier}</span>
                    </div>
                  ))}
                </div>
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
                            <span
                              className={`inline-flex items-center justify-center w-8 h-6 rounded text-[10px] font-bold ${
                                TIER_SELECTED_STYLES[seat.tier] ||
                                "bg-slate-400 text-slate-900"
                              }`}
                            >
                              {seat.id}
                            </span>
                            <span
                              className={`text-xs ${
                                TIER_COLORS[seat.tier] || "text-slate-400"
                              }`}
                            >
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

                  {/* Hold Timer */}
                  {holdSecondsLeft !== null && (
                    <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-3 ${
                      holdSecondsLeft < 60
                        ? "bg-red-500/10 border border-red-500/30 text-red-400"
                        : holdSecondsLeft < 120
                        ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                        : "bg-surface-700 border border-white/8 text-slate-400"
                    }`}>
                      <Timer className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Hold expires in{" "}
                        <strong className="font-mono">
                          {Math.floor(holdSecondsLeft / 60)}:{String(holdSecondsLeft % 60).padStart(2, "0")}
                        </strong>
                      </span>
                    </div>
                  )}

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
                <div className="flex items-center justify-between">
                  <span>Available: {summary.available}</span>
                  {isRefreshing && (
                    <span className="flex items-center gap-1 text-brand-400">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Live
                    </span>
                  )}
                </div>
                <p>Booked: {summary.booked}</p>
                <p>Held: {summary.held}</p>
                <p className="text-slate-600 mt-1">Updates every 30s</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {swatch}
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}
