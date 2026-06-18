import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { TreePine, CheckCircle2, Clock, Leaf, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Incident } from '../lib/types';
import { format, subDays } from 'date-fns';

const CONDITION_COLORS: Record<string, string> = {
  healthy: '#16a34a',
  damaged: '#f59e0b',
  dangerous: '#dc2626',
  visible_issue: '#3b82f6',
};

const CONDITION_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  damaged: 'Damaged',
  dangerous: 'Dangerous',
  visible_issue: 'Visible Issue',
};

const GROUP_COLORS = ['#2d6a4f', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7'];

interface Stats {
  totalTrees: number;
  totalIncidents: number;
  verifiedIncidents: number;
  unverifiedIncidents: number;
  conditionData: { name: string; value: number; color: string }[];
  groupData: { name: string; count: number }[];
  dailyData: { date: string; incidents: number }[];
  recentIncidents: Incident[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    // Paginate trees to get all records
    const allTrees: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from('trees').select('group_no, tree_name').range(from, from + 999);
      if (!data || data.length === 0) break;
      allTrees.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }

    const allIncidents: any[] = [];
    let ifrom = 0;
    while (true) {
      const { data } = await supabase
        .from('incidents').select('*').order('submitted_at', { ascending: false }).range(ifrom, ifrom + 999);
      if (!data || data.length === 0) break;
      allIncidents.push(...data);
      if (data.length < 1000) break;
      ifrom += 1000;
    }

    const [
      { count: totalTrees },
      { data: incidents },
      { data: trees },
    ] = [
      { count: allTrees.length },
      { data: allIncidents },
      { data: allTrees },
    ];

    const inc = incidents || [];
    const verified = inc.filter(i => i.is_verified).length;

    // Condition breakdown
    const condMap: Record<string, number> = {};
    inc.forEach(i => { condMap[i.condition] = (condMap[i.condition] || 0) + 1; });
    const conditionData = Object.entries(condMap).map(([k, v]) => ({
      name: CONDITION_LABELS[k] || k,
      value: v,
      color: CONDITION_COLORS[k] || '#888',
    }));

    // Group breakdown
    const groupMap: Record<string, number> = {};
    (trees || []).forEach(t => {
      const g = t.group_no || 'Unknown';
      groupMap[g] = (groupMap[g] || 0) + 1;
    });
    const groupData = Object.entries(groupMap).map(([name, count]) => ({ name, count }));

    // Daily incidents (last 14 days)
    const dailyMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      dailyMap[format(subDays(new Date(), i), 'MMM dd')] = 0;
    }
    inc.forEach(i => {
      const d = format(new Date(i.submitted_at), 'MMM dd');
      if (d in dailyMap) dailyMap[d] = (dailyMap[d] || 0) + 1;
    });
    const dailyData = Object.entries(dailyMap).map(([date, incidents]) => ({ date, incidents }));

    setStats({
      totalTrees: totalTrees || 0,
      totalIncidents: inc.length,
      verifiedIncidents: verified,
      unverifiedIncidents: inc.length - verified,
      conditionData,
      groupData,
      dailyData,
      recentIncidents: inc.slice(0, 8) as Incident[],
    });
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-stone-500 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const s = stats!;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-800">Analytics Dashboard</h1>
          <p className="text-stone-500 text-sm mt-1">UoM Campus Tree Monitoring Overview</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard icon={<TreePine className="w-5 h-5 text-green-700" />} label="Total Trees" value={s.totalTrees.toLocaleString()} bg="bg-green-50" />
          <KpiCard icon={<Leaf className="w-5 h-5 text-teal-700" />} label="Total Incidents" value={s.totalIncidents.toLocaleString()} bg="bg-teal-50" />
          <KpiCard icon={<CheckCircle2 className="w-5 h-5 text-blue-700" />} label="Verified" value={s.verifiedIncidents.toLocaleString()} bg="bg-blue-50" />
          <KpiCard icon={<Clock className="w-5 h-5 text-amber-700" />} label="Pending Review" value={s.unverifiedIncidents.toLocaleString()} bg="bg-amber-50" />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Condition pie */}
          <ChartCard title="Tree Conditions Reported">
            {s.conditionData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={s.conditionData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={false} labelLine={false}>
                    {s.conditionData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Reports']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Group bar chart */}
          <ChartCard title="Trees by Campus Zone">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={s.groupData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} />
                <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                <Tooltip cursor={{ fill: '#f5f1eb' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {s.groupData.map((_, i) => (
                    <Cell key={i} fill={GROUP_COLORS[i % GROUP_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Incidents by day */}
        <div className="mb-6">
          <ChartCard title="Incidents Reported — Last 14 Days">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={s.dailyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#78716c' }} />
                <YAxis tick={{ fontSize: 10, fill: '#78716c' }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="incidents" stroke="#16a34a" fill="url(#incGrad)" strokeWidth={2} dot={{ r: 3, fill: '#16a34a' }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Condition breakdown bar */}
        <div className="mb-6">
          <ChartCard title="Condition Distribution (Bar View)">
            {s.conditionData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={s.conditionData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#78716c' }} width={90} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {s.conditionData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Recent incidents table */}
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
            <h3 className="font-semibold text-stone-800">Recent Incidents</h3>
            <Link to="/map" className="text-sm text-green-700 hover:text-green-800 flex items-center gap-1">
              View on map <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {s.recentIncidents.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-sm">No incidents reported yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">Condition</th>
                    <th className="px-6 py-3 text-left">Description</th>
                    <th className="px-6 py-3 text-left">Submitted By</th>
                    <th className="px-6 py-3 text-left">Date</th>
                    <th className="px-6 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {s.recentIncidents.map(inc => (
                    <tr key={inc.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-3">
                        <ConditionBadge condition={inc.condition} />
                      </td>
                      <td className="px-6 py-3 text-stone-600 max-w-xs truncate">
                        {inc.description || '—'}
                      </td>
                      <td className="px-6 py-3 text-stone-500">{inc.submitted_by || 'Anonymous'}</td>
                      <td className="px-6 py-3 text-stone-400 text-xs">
                        {format(new Date(inc.submitted_at), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-3">
                        {inc.is_verified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl p-5 border border-white`}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-stone-800">{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-6">
      <h3 className="font-semibold text-stone-800 mb-4 text-sm">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-48 flex items-center justify-center text-stone-400 text-sm">
      No data yet — submit the first report!
    </div>
  );
}

export function ConditionBadge({ condition }: { condition: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    healthy: { label: 'Healthy', cls: 'bg-green-100 text-green-800' },
    damaged: { label: 'Damaged', cls: 'bg-amber-100 text-amber-800' },
    dangerous: { label: 'Dangerous', cls: 'bg-red-100 text-red-800' },
    visible_issue: { label: 'Visible Issue', cls: 'bg-blue-100 text-blue-800' },
  };
  const { label, cls } = map[condition] || { label: condition, cls: 'bg-stone-100 text-stone-800' };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}
