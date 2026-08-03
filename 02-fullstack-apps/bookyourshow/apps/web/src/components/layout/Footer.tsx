import Link from "next/link";
import { Film, ExternalLink, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-surface-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <Film className="h-6 w-6 text-brand-400" />
              <span className="text-lg font-bold">
                Book<span className="text-brand-400">Your</span>Show
              </span>
            </Link>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
              Your one-stop destination for booking movie tickets online. 
              Browse movies, select seats, and pay securely.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
              Explore
            </h3>
            <ul className="space-y-2">
              {[
                { label: "Now Showing", href: "/" },
                { label: "All Movies", href: "/movies" },
                { label: "My Bookings", href: "/bookings" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-brand-400 transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
              Project
            </h3>
            <ul className="space-y-2">
              {[
                { label: "GitHub Repo", href: "#" },
                { label: "API Docs", href: "#" },
                { label: "Tech Stack", href: "#" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-brand-400 transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} BookYourShow. Built as a portfolio project.
          </p>
          <div className="flex items-center gap-1 text-xs text-slate-600">
            Made with <Heart className="h-3 w-3 text-accent-500 fill-accent-500" /> by dgami
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-slate-500 hover:text-white transition"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
