import { useEffect, useState } from 'react';
import {
  TreePine, CheckCircle2, Clock, Trash2, Edit2, Search,
  RefreshCw, AlertTriangle, Leaf, Camera, ExternalLink, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Tree, Incident } from '../lib/types';
import { ConditionBadge } from './Dashboard';
import { format } from 'date-fns';

type AdminTab = 'incidents' | 'trees' | 'photos';

interface PhotoStats {
  total: number;
  google: number;
  storage: number;
  loading: boolean;
}

export default function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>('incidents');
  const [incidents, setIncidents] = useState<(Incident & { tree?: Tree })[]>([]);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, trees: 0 });
  const [photoStats, setPhotoStats] = useState<PhotoStats>({ total: 0, google: 0, storage: 0, loading: true });

  useEffect(() => { loadAll(); loadPhotoStats(); }, []);

  async function loadAll() {
    setLoading(true);

    // Paginate incidents
    const allInc: any[] = [];
    let ifrom = 0;
    while (true) {
      const { data } = await supabase
        .from('incidents')
        .select('*, tree:trees(id, tree_name, lat, lng, group_no)')
        .order('submitted_at', { ascending: false })
        .range(ifrom, ifrom + 999);
      if (!data || data.length === 0) break;
      allInc.push(...data);
      if (data.length < 1000) break;
      ifrom += 1000;
    }

    // Paginate trees
    const allTrees: any[] = [];
    let tfrom = 0;
    while (true) {
      const { data } = await supabase
        .from('trees')
        .select('*')
        .order('created_at', { ascending: false })
        .range(tfrom, tfrom + 999);
      if (!data || data.length === 0) break;
      allTrees.push(...data);
      if (data.length < 1000) break;
      tfrom += 1000;
    }

    const incData = allInc as (Incident & { tree?: Tree })[];
    setIncidents(incData);
    setTrees(allTrees as Tree[]);
    setStats({
      total: incData.length,
      pending: incData.filter(i => !i.is_verified).length,
      verified: incData.filter(i => i.is_verified).length,
      trees: allTrees.length,
    });
    setLoading(false);
  }

  async function loadPhotoStats() {
    setPhotoStats(s => ({ ...s, loading: true }));
    const [
      { count: total },
      { count: google },
    ] = await Promise.all([
      supabase.from('tree_photos').select('*', { count: 'exact', head: true }),
      supabase.from('tree_photos').select('*', { count: 'exact', head: true }).like('url', 'https://lh3.googleusercontent.com%'),
    ]);
    const t = total ?? 0;
    const g = google ?? 0;
    setPhotoStats({ total: t, google: g, storage: t - g, loading: false });
  }

  async function verifyIncident(id: string, verified: boolean) {
    await supabase.from('incidents').update({ is_verified: verified }).eq('id', id);
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, is_verified: verified } : i));
    setStats(s => ({
      ...s,
      pending: s.pending + (verified ? -1 : 1),
      verified: s.verified + (verified ? 1 : -1),
    }));
  }

  async function deleteIncident(id: string) {
    if (!confirm('Delete this incident report?')) return;
    await supabase.from('incidents').delete().eq('id', id);
    setIncidents(prev => prev.filter(i => i.id !== id));
  }

  async function deleteTree(id: string, name: string) {
    if (!confirm(`Delete "${name || 'this tree'}" and all its data?`)) return;
    await supabase.from('trees').delete().eq('id', id);
    setTrees(prev => prev.filter(t => t.id !== id));
  }

  const filteredIncidents = incidents.filter(i =>
    !search ||
    i.tree?.tree_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.submitted_by?.toLowerCase().includes(search.toLowerCase()) ||
    i.condition.includes(search.toLowerCase())
  );

  const filteredTrees = trees.filter(t =>
    !search ||
    t.tree_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.department?.toLowerCase().includes(search.toLowerCase()) ||
    t.group_no?.toLowerCase().includes(search.toLowerCase())
  );

  const googlePct = photoStats.total > 0 ? Math.round((photoStats.google / photoStats.total) * 100) : 0;
  const storagePct = 100 - googlePct;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Admin Panel</h1>
            <p className="text-stone-500 text-sm">UoM GeoLens — Data Management</p>
          </div>
          <button
            onClick={() => { loadAll(); loadPhotoStats(); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<TreePine className="w-4 h-4 text-green-700" />} label="Total Trees" value={stats.trees} bg="bg-green-50" />
          <StatCard icon={<Leaf className="w-4 h-4 text-teal-700" />} label="Total Incidents" value={stats.total} bg="bg-teal-50" />
          <StatCard icon={<Clock className="w-4 h-4 text-amber-700" />} label="Pending" value={stats.pending} bg="bg-amber-50" />
          <StatCard icon={<CheckCircle2 className="w-4 h-4 text-blue-700" />} label="Verified" value={stats.verified} bg="bg-blue-50" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit mb-6">
          <TabBtn active={tab === 'incidents'} onClick={() => setTab('incidents')}>
            <AlertTriangle className="w-4 h-4" /> Incidents ({stats.pending} pending)
          </TabBtn>
          <TabBtn active={tab === 'trees'} onClick={() => setTab('trees')}>
            <TreePine className="w-4 h-4" /> Trees ({stats.trees})
          </TabBtn>
          <TabBtn active={tab === 'photos'} onClick={() => setTab('photos')}>
            <Camera className="w-4 h-4" /> Photos
            {photoStats.google > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full leading-none">
                {photoStats.google}
              </span>
            )}
          </TabBtn>
        </div>

        {tab !== 'photos' && (
          /* Search */
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'incidents' ? 'Search by tree, reporter, condition…' : 'Search trees…'}
              className="w-full pl-9 pr-4 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            />
          </div>
        )}

        {loading && tab !== 'photos' ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-green-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'incidents' ? (
          /* ── INCIDENTS TABLE ─────────────────────────────────── */
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Tree</th>
                    <th className="px-4 py-3 text-left">Condition</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Reporter</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Photo</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {filteredIncidents.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-stone-400">No incidents found.</td></tr>
                  )}
                  {filteredIncidents.map(inc => (
                    <tr key={inc.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-stone-700 max-w-[120px] truncate">
                        {inc.tree?.tree_name || 'Unknown'}
                      </td>
                      <td className="px-4 py-3"><ConditionBadge condition={inc.condition} /></td>
                      <td className="px-4 py-3 text-stone-500 max-w-[160px] truncate">{inc.description || '—'}</td>
                      <td className="px-4 py-3 text-stone-500">{inc.submitted_by || 'Anon'}</td>
                      <td className="px-4 py-3 text-stone-400 text-xs whitespace-nowrap">
                        {format(new Date(inc.submitted_at), 'MMM dd, yy')}
                      </td>
                      <td className="px-4 py-3">
                        {inc.is_verified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {inc.photo_url ? (
                          <a href={inc.photo_url} target="_blank" rel="noopener noreferrer">
                            <img src={inc.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-stone-100" />
                          </a>
                        ) : <span className="text-stone-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {inc.is_verified ? (
                            <button
                              onClick={() => verifyIncident(inc.id, false)}
                              className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Mark as unverified"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => verifyIncident(inc.id, true)}
                              className="p-1.5 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Verify"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteIncident(inc.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'trees' ? (
          /* ── TREES TABLE ─────────────────────────────────────── */
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Species</th>
                    <th className="px-4 py-3 text-left">Zone</th>
                    <th className="px-4 py-3 text-left">Department</th>
                    <th className="px-4 py-3 text-left">Height</th>
                    <th className="px-4 py-3 text-left">Diameter</th>
                    <th className="px-4 py-3 text-left">Coordinates</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {filteredTrees.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-stone-400">No trees found.</td></tr>
                  )}
                  {filteredTrees.map(tree => (
                    <tr key={tree.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-stone-700">{tree.tree_name || <span className="text-stone-400">Unnamed</span>}</td>
                      <td className="px-4 py-3 text-stone-500">{tree.group_no || '—'}</td>
                      <td className="px-4 py-3 text-stone-500 max-w-[140px] truncate">{tree.department || '—'}</td>
                      <td className="px-4 py-3 text-stone-500">{tree.height || '—'}</td>
                      <td className="px-4 py-3 text-stone-500">{tree.diameter || '—'}</td>
                      <td className="px-4 py-3 text-xs text-stone-400 font-mono">{tree.lat.toFixed(5)}, {tree.lng.toFixed(5)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <a
                            href={`/tree/${tree.id}`}
                            className="p-1.5 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="View"
                          >
                            <Edit2 className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => deleteTree(tree.id, tree.tree_name || '')}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ── PHOTOS TAB ──────────────────────────────────────── */
          <div className="space-y-6">
            {/* Status cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-stone-100 p-5">
                <div className="text-xs text-stone-400 mb-1">Total Photos</div>
                <div className="text-3xl font-bold text-stone-800">
                  {photoStats.loading ? '…' : photoStats.total.toLocaleString()}
                </div>
                <div className="text-xs text-stone-500 mt-1">in database</div>
              </div>
              <div className={`rounded-2xl border p-5 ${photoStats.google > 0 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'}`}>
                <div className="text-xs text-stone-400 mb-1">Google URLs</div>
                <div className={`text-3xl font-bold ${photoStats.google > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {photoStats.loading ? '…' : photoStats.google.toLocaleString()}
                </div>
                <div className="text-xs text-stone-500 mt-1">
                  {photoStats.google > 0 ? 'need migration to Supabase' : 'all migrated!'}
                </div>
              </div>
              <div className="bg-green-50 rounded-2xl border border-green-100 p-5">
                <div className="text-xs text-stone-400 mb-1">Supabase Storage</div>
                <div className="text-3xl font-bold text-green-700">
                  {photoStats.loading ? '…' : photoStats.storage.toLocaleString()}
                </div>
                <div className="text-xs text-stone-500 mt-1">permanently stored</div>
              </div>
            </div>

            {/* Progress bar */}
            {!photoStats.loading && photoStats.total > 0 && (
              <div className="bg-white rounded-2xl border border-stone-100 p-5">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-stone-600 font-medium">Migration Progress</span>
                  <span className="text-stone-400">{storagePct}% complete</span>
                </div>
                <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${storagePct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-stone-400 mt-1.5">
                  <span>{photoStats.storage.toLocaleString()} in Supabase</span>
                  <span>{photoStats.google.toLocaleString()} still on Google</span>
                </div>
              </div>
            )}

            {/* Instructions */}
            {photoStats.google > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <div className="flex gap-3 mb-4">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                    <Info className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-1">
                      {photoStats.google.toLocaleString()} photos need migration
                    </h3>
                    <p className="text-sm text-amber-700">
                      These photos are still linked to Google's servers (lh3.googleusercontent.com).
                      They require your Google login to display, and may not work for all visitors.
                      Run the migration script below to download them permanently into Supabase Storage.
                    </p>
                  </div>
                </div>

                <div className="bg-amber-900/10 rounded-xl p-4 font-mono text-sm space-y-1">
                  <div className="text-amber-800">
                    <span className="text-amber-500 select-none"># </span>
                    Run once in your project folder:
                  </div>
                  <div className="text-amber-900 font-semibold">
                    python scripts/download_photos_playwright.py
                  </div>
                  <div className="text-amber-700 text-xs mt-2">
                    A browser will open — log in with sandaruwan.silva97@gmail.com,
                    then press ENTER in the terminal. The script is resumable if interrupted.
                  </div>
                </div>

                <div className="mt-4 text-xs text-amber-600 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Photos currently work in your browser because you're logged into Google.
                    Visitors without a Google session will see "Photo unavailable" until migration is complete.
                  </span>
                </div>
              </div>
            ) : photoStats.total > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">All photos migrated!</h3>
                  <p className="text-sm text-green-700">
                    All {photoStats.total.toLocaleString()} photos are stored in Supabase Storage and work for every visitor without any login.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Sample photo test */}
            <PhotoSampleTest />
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoSampleTest() {
  const [samples, setSamples] = useState<{ url: string; id: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('tree_photos')
      .select('id, url')
      .limit(4)
      .then(({ data }) => {
        if (data) setSamples(data);
        setLoaded(true);
      });
  }, []);

  if (!loaded || samples.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-5">
      <h3 className="font-semibold text-stone-800 mb-1 text-sm">Live Photo Test</h3>
      <p className="text-xs text-stone-400 mb-4">
        Sample photos from the database. Green border = loading OK, broken = migration needed.
      </p>
      <div className="grid grid-cols-4 gap-3">
        {samples.map(s => (
          <PhotoTestCard key={s.id} url={s.url} />
        ))}
      </div>
    </div>
  );
}

function PhotoTestCard({ url }: { url: string }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'fail'>('loading');
  const isGoogle = url.includes('lh3.googleusercontent.com');

  return (
    <div className={`rounded-xl overflow-hidden border-2 transition-colors ${
      status === 'ok' ? 'border-green-400' : status === 'fail' ? 'border-red-300' : 'border-stone-200'
    }`}>
      <div className="relative w-full aspect-square bg-stone-100">
        <img
          src={url}
          alt="Test"
          className="w-full h-full object-cover"
          onLoad={() => setStatus('ok')}
          onError={() => setStatus('fail')}
        />
        <div className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border border-white ${
          status === 'ok' ? 'bg-green-500' : status === 'fail' ? 'bg-red-500' : 'bg-stone-300 animate-pulse'
        }`} />
      </div>
      <div className="px-2 py-1.5 text-center">
        <div className={`text-xs font-medium ${
          status === 'ok' ? 'text-green-600' : status === 'fail' ? 'text-red-500' : 'text-stone-400'
        }`}>
          {status === 'ok' ? 'OK' : status === 'fail' ? 'Failed' : 'Testing…'}
        </div>
        <div className="text-xs text-stone-400">
          {isGoogle ? 'Google' : 'Supabase'}
        </div>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-1 text-xs text-stone-400 hover:text-stone-600 pb-1.5">
        <ExternalLink className="w-3 h-3" /> Open
      </a>
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl p-4 border border-white`}>
      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm mb-2">{icon}</div>
      <div className="text-xl font-bold text-stone-800">{value.toLocaleString()}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
    >
      {children}
    </button>
  );
}
