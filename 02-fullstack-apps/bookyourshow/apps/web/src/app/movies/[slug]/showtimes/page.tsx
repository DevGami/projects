"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MapPin, Clock, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useCityStore } from "@/stores/city.store";
import { Button } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";

interface Showtime {
  id: string;
  movieTmdbId: number;
  movieTitle: string;
  showDate: string;
  showTime: string;
  priceMultiplier: string;
  status: string;
  screen: {
    id: string;
    name: string;
    seatLayout: { tier: string; rows: string; price: number }[];
    theater: {
      id: string;
      name: string;
      city: string;
      address: string;
    };
  };
}

export default function ShowtimesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const { city } = useCityStore();
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [movieTitle, setMovieTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Compute IST date strings (UTC+5:30) — avoids wrong date after 6:30 PM IST
  const getISTDateStr = (offsetDays = 0) => {
    const now = new Date();
    const istMs = now.getTime() + (5.5 * 60 * 60 * 1000); // shift to IST
    const d = new Date(istMs + offsetDays * 86400000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Derive available dates from actual showtimes
  const dates = [...new Set(showtimes.map((st) => st.showDate.split("T")[0]))]
    .sort()
    .filter(Boolean) as string[];

  // If no dates loaded yet, show a placeholder with today (IST)
  const todayStr = getISTDateStr(0);
  const displayDates = dates.length > 0 ? dates : [todayStr];

  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    // Get movie info for tmdbId
    async function fetchData() {
      try {
        // First get movie to know tmdbId
        const movieRes = await api.get<{ movie: { tmdbId: number; title: string } }>(`/movies/${slug}`);
        const movie = movieRes.data?.movie;
        if (!movie) return;
        setMovieTitle(movie.title);

        // Fetch showtimes
        const stRes = await api.get<{ showtimes: Showtime[] }>("/showtimes", {
          movieTmdbId: movie.tmdbId,
          city,
        });
        const fetchedShowtimes = stRes.data?.showtimes || [];
        setShowtimes(fetchedShowtimes);

        // Auto-select the first available date
        if (fetchedShowtimes.length > 0) {
          const firstDate = fetchedShowtimes
            .map((st) => st.showDate.split("T")[0])
            .sort()[0];
          if (firstDate) setSelectedDate(firstDate);
        }
      } catch (err) {
        console.error("Failed to fetch showtimes:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [slug, city]);

  // Helper to parse time strings like "01:30 PM" to minutes for sorting
  const parseTime = (timeStr: string) => {
    const parts = timeStr.trim().split(' ');
    if (parts.length !== 2) return 0;
    const [time, modifier] = parts;
    let [hours, minutes] = time.split(':');
    let h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    if (h === 12) h = 0;
    if (modifier.toUpperCase() === 'PM') h += 12;
    return h * 60 + m;
  };

  // Filter by selected date and sort
  const filteredShowtimes = (selectedDate
    ? showtimes.filter((st) => st.showDate.startsWith(selectedDate))
    : showtimes).sort((a, b) => parseTime(a.showTime) - parseTime(b.showTime));

  // Group by theater
  const grouped = filteredShowtimes.reduce<Record<string, { theater: Showtime["screen"]["theater"]; shows: Showtime[] }>>(
    (acc, st) => {
      const theaterId = st.screen.theater.id;
      if (!acc[theaterId]) {
        acc[theaterId] = { theater: st.screen.theater, shows: [] };
      }
      acc[theaterId].shows.push(st);
      return acc;
    },
    {}
  );

  return (
    <div className="min-h-screen mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Link
        href={`/movies/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {movieTitle || "movie"}
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-white mb-6">
          {movieTitle ? `Showtimes for ${movieTitle}` : "Showtimes"}
        </h1>

        {/* ── Date Selector ──────────────────────────────────── */}
        <div className="flex overflow-x-auto pb-4 gap-2 no-scrollbar">
          {displayDates.map((dateStr) => {
            const dateObj = new Date(dateStr + "T00:00:00");
            const isSelected = selectedDate === dateStr;
            const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
            const dayNum = dateObj.getDate();
            const month = dateObj.toLocaleDateString("en-US", { month: "short" });
            // Use IST-aware date strings for accurate TODAY/TOM labels
            const todayIST = getISTDateStr(0);
            const tomorrowIST = getISTDateStr(1);
            const isToday = dateStr === todayIST;
            const isTomorrow = dateStr === tomorrowIST;

            let displayDayName = dayName;
            if (isToday) displayDayName = "TODAY";
            if (isTomorrow) displayDayName = "TOM";

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex flex-col items-center justify-center min-w-[64px] h-16 rounded-xl transition-all ${
                  isSelected
                    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25"
                    : "bg-surface-800 text-slate-400 hover:bg-surface-700 hover:text-white"
                }`}
              >
                <span className="text-[10px] font-semibold tracking-wider uppercase mb-1">
                  {displayDayName}
                </span>
                <span className="text-lg font-bold leading-none">{dayNum}</span>
                <span className="text-[10px] mt-0.5">{month}</span>
              </button>
            );
          })}
        </div>

        {/* ── Showtimes ──────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">No showtimes available</p>
            <p className="text-slate-600 text-sm mt-1">
              {selectedDate ? "Try a different date" : "Check back later for new showtimes"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(grouped).map(({ theater, shows }) => (
              <div
                key={theater.id}
                className="rounded-2xl bg-surface-800 border border-white/8 p-5"
              >
                {/* Theater Info */}
                <div className="flex items-start gap-3 mb-4">
                  <MapPin className="h-4 w-4 text-accent-500 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">{theater.name}</h3>
                    <p className="text-xs text-slate-500">{theater.address}</p>
                  </div>
                </div>

                {/* Time Chips */}
                <div className="flex flex-wrap gap-2">
                  {shows.map((show) => {
                    const minPrice = Math.min(
                      ...show.screen.seatLayout.map(
                        (t) => t.price * Number(show.priceMultiplier)
                      )
                    );
                    return (
                      <button
                        key={show.id}
                        onClick={() => router.push(`/book/${show.id}`)}
                        className="group flex flex-col items-center px-4 py-2.5 rounded-xl border border-brand-500/30 bg-brand-500/5 hover:bg-brand-500/15 hover:border-brand-500/50 transition"
                      >
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-300 group-hover:text-brand-200">
                          <Clock className="h-3 w-3" />
                          {show.showTime}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          {show.screen.name} • ₹{Math.round(minPrice)}+
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
