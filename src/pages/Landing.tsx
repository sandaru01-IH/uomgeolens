import {} from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TreePine, Map, BarChart3, ClipboardList, Shield,
  Leaf, AlertTriangle, CheckCircle2, ChevronRight,
  MapPin, Camera
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.12 } },
};

const FEATURES = [
  {
    icon: Map,
    title: 'Interactive Campus Map',
    desc: 'Visualize all 1,000+ trees across the UoM campus on a live Leaflet map with real-time status overlays.',
    color: 'bg-green-100 text-green-700',
  },
  {
    icon: ClipboardList,
    title: 'GPS-Based Reporting',
    desc: 'Students can submit tree conditions directly from mobile using GPS auto-detection. No account needed.',
    color: 'bg-amber-100 text-amber-700',
  },
  {
    icon: BarChart3,
    title: 'Live Analytics Dashboard',
    desc: 'Track tree health statistics, incident trends by day, species distribution, and department coverage.',
    color: 'bg-teal-100 text-teal-700',
  },
  {
    icon: Shield,
    title: 'Admin Verification',
    desc: 'Admin panel to review, verify, and manage all submitted tree data and incident reports in one place.',
    color: 'bg-stone-100 text-stone-700',
  },
  {
    icon: Camera,
    title: 'Photo Documentation',
    desc: 'Every tree entry supports full-tree, trunk, branch, leaves, and flower photos stored in the cloud.',
    color: 'bg-rose-100 text-rose-700',
  },
  {
    icon: MapPin,
    title: 'Zone Boundaries',
    desc: 'Campus zones and department boundaries are overlaid on the map for clear spatial context.',
    color: 'bg-indigo-100 text-indigo-700',
  },
];

const STATS = [
  { value: '1,200+', label: 'Trees Mapped', icon: TreePine },
  { value: '5', label: 'Campus Zones', icon: MapPin },
  { value: '4', label: 'Health Statuses', icon: Leaf },
  { value: '100%', label: 'GPS Enabled', icon: CheckCircle2 },
];

const CONDITION_CARDS = [
  { color: 'bg-red-500', label: 'Dangerous', desc: 'Risk of falling, poses safety hazard' },
  { color: 'bg-amber-400', label: 'Damaged', desc: 'Broken branches, trunk or root damage' },
  { color: 'bg-blue-500', label: 'Visible Issue', desc: 'Discoloration, lesions, visible symptoms' },
  { color: 'bg-green-500', label: 'Healthy', desc: 'Tree appears to be in good condition' },
];


export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-green-700 rounded-lg flex items-center justify-center">
              <TreePine className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-stone-800 text-sm block leading-none">UoM GeoLens</span>
              <span className="text-xs text-stone-500 leading-none">Tree Monitoring System</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/map" className="hidden sm:block text-sm text-stone-600 hover:text-stone-900 font-medium">
              Map
            </Link>
            <Link to="/dashboard" className="hidden sm:block text-sm text-stone-600 hover:text-stone-900 font-medium">
              Dashboard
            </Link>
            <Link
              to="/report"
              className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
            >
              Report a Tree
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-gradient-to-br from-stone-900 via-green-950 to-stone-900">
        {/* Background texture */}
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 20 }).map((_, i) => (
            <TreePine
              key={i}
              className="absolute text-green-400"
              style={{
                width: `${Math.random() * 40 + 20}px`,
                height: `${Math.random() * 40 + 20}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.5 + 0.1,
              }}
            />
          ))}
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="max-w-3xl"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-800/50 text-green-300 rounded-full text-xs font-medium mb-6 border border-green-700/50">
              <Leaf className="w-3 h-3" />
              University of Moratuwa — Tree Monitoring Platform
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6"
            >
              Campus Trees,
              <span className="block text-green-400">Mapped &amp; Monitored</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-lg text-stone-300 leading-relaxed mb-10 max-w-xl"
            >
              UoM GeoLens is the official geo-visualization and tree health monitoring platform
              for the University of Moratuwa campus, developed by the Department of Town and Country Planning.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-900/40"
              >
                <LayoutDashboardIcon />
                View Dashboard
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to="/map"
                className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all border border-white/20 backdrop-blur"
              >
                <Map className="w-4 h-4" />
                Explore Map
              </Link>
              <Link
                to="/report"
                className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-900/40"
              >
                <ClipboardList className="w-4 h-4" />
                Submit Report
              </Link>
            </motion.div>
          </motion.div>

          {/* Floating stats */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:grid grid-cols-2 gap-3"
          >
            {STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} className="bg-white/10 backdrop-blur border border-white/10 rounded-2xl p-5 text-center min-w-[120px]">
                <Icon className="w-5 h-5 text-green-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-xs text-stone-400 mt-0.5">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 inset-x-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 60L60 50C120 40 240 20 360 15C480 10 600 20 720 25C840 30 960 30 1080 25C1200 20 1320 10 1380 5L1440 0V60H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── CONDITION STATUS ───────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-10"
          >
            <motion.p variants={fadeUp} className="text-green-700 font-medium text-sm uppercase tracking-wider mb-2">Health Classification</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-stone-800">Four-tier Tree Condition System</motion.h2>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {CONDITION_CARDS.map(({ color, label, desc }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                className="p-5 rounded-2xl bg-stone-50 border border-stone-100 hover:shadow-md transition-shadow"
              >
                <div className={`w-10 h-10 rounded-full ${color} mb-3`} />
                <div className="font-semibold text-stone-800 mb-1">{label}</div>
                <div className="text-xs text-stone-500 leading-relaxed">{desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.p variants={fadeUp} className="text-green-700 font-medium text-sm uppercase tracking-wider mb-2">Platform Capabilities</motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl font-bold text-stone-800 mb-4">Everything you need to monitor campus trees</motion.h2>
            <motion.p variants={fadeUp} className="text-stone-500 max-w-2xl mx-auto">
              A complete ecosystem for tree data collection, visualization, and management — designed for the entire UoM community.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                className="bg-white rounded-2xl p-6 border border-stone-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-stone-800 mb-2">{title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.p variants={fadeUp} className="text-green-700 font-medium text-sm uppercase tracking-wider mb-2">Simple Process</motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl font-bold text-stone-800">How it works</motion.h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Go to a tree', desc: 'Walk up to any tree on the UoM campus. Your browser captures your GPS coordinates automatically.', icon: MapPin },
              { step: '02', title: 'Submit your observation', desc: 'Select the nearest tree or find it manually. Fill in the health condition and upload a photo.', icon: Camera },
              { step: '03', title: 'Data goes live', desc: 'Your report is instantly visible on the map. The admin reviews and verifies it for the permanent record.', icon: CheckCircle2 },
            ].map(({ step, title, desc, icon: Icon }) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="text-6xl font-black text-stone-100 select-none mb-4">{step}</div>
                <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center mb-4 -mt-8 ml-2">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-stone-800 text-lg mb-2">{title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-r from-green-800 to-green-700">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.div variants={fadeUp}>
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-white mb-4">
              Spotted a tree that needs attention?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-green-200 mb-8 max-w-xl mx-auto">
              Help keep the UoM campus safe. Submit a quick report from your mobile — no account needed, takes under 2 minutes.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-4">
              <Link
                to="/report"
                className="px-8 py-3 bg-white text-green-800 font-semibold rounded-xl hover:bg-green-50 transition-colors shadow-lg"
              >
                Submit a Report
              </Link>
              <Link
                to="/dashboard"
                className="px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-500 transition-colors border border-green-500"
              >
                View Dashboard
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="bg-stone-900 text-stone-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center">
                  <TreePine className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white text-sm">UoM GeoLens</span>
              </div>
              <p className="text-xs leading-relaxed max-w-xs">
                Enterprise-grade geo-visualization and tree monitoring system for the UoM campus ecosystem.
              </p>
            </div>
            <div>
              <h4 className="text-white font-medium text-sm mb-3">Department</h4>
              <p className="text-xs leading-relaxed">
                Department of Town and Country Planning<br />
                Faculty of Architecture<br />
                University of Moratuwa, Sri Lanka
              </p>
            </div>
            <div>
              <h4 className="text-white font-medium text-sm mb-3">Platform</h4>
              <ul className="space-y-1.5 text-xs">
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Analytics Dashboard</Link></li>
                <li><Link to="/map" className="hover:text-white transition-colors">Campus Tree Map</Link></li>
                <li><Link to="/report" className="hover:text-white transition-colors">Submit Field Report</Link></li>
                <li><Link to="/admin/login" className="hover:text-white transition-colors">Admin Access</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-stone-800 pt-6 text-center text-xs">
            © {new Date().getFullYear()} University of Moratuwa — Department of Town and Country Planning. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function LayoutDashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
