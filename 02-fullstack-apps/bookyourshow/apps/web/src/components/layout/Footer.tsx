import Link from "next/link";
import { Film, ExternalLink, Heart, BookOpen, Layers, GitBranch } from "lucide-react";

const GITHUB_REPO =
  "https://github.com/DevGami/projects/tree/main/02-fullstack-apps/bookyourshow";
const GITHUB_PROFILE = "https://github.com/DevGami";
const API_DOCS_URL = "https://bookyourshow-api.onrender.com/api/v1/health";

const TECH_STACK = [
  "Next.js 15", "TypeScript", "Node.js", "Express",
  "PostgreSQL (Supabase)", "MongoDB (Atlas)", "Redis (Upstash)",
  "Prisma", "Razorpay", "TMDB API", "Vercel", "Render",
];

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
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-4">
              Your one-stop destination for booking movie tickets online.
              Browse movies, select seats, and pay securely.
            </p>
            {/* Tech Stack badges */}
            <div className="flex flex-wrap gap-1.5">
              {TECH_STACK.map((tech) => (
                <span
                  key={tech}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10"
                >
                  {tech}
                </span>
              ))}
            </div>
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

          {/* Project Links */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
              Project
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href={GITHUB_REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-400 transition"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  GitHub Repo
                </a>
              </li>
              <li>
                <a
                  href={API_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-400 transition"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  API Health
                </a>
              </li>
              <li>
                <a
                  href={GITHUB_REPO + "#tech-stack"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-400 transition"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Tech Stack
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} BookYourShow. Built as a portfolio project.
          </p>
          <div className="flex items-center gap-1 text-xs text-slate-600">
            Made with <Heart className="h-3 w-3 text-accent-500 fill-accent-500 mx-0.5" /> by dgami
            <a
              href={GITHUB_PROFILE}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-slate-500 hover:text-white transition"
              title="DevGami on GitHub"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
