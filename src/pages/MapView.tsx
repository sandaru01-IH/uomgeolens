import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { Filter, CheckCircle2, Clock, X, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Tree } from '../lib/types';
import { ConditionBadge } from './Dashboard';

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CONDITION_COLORS: Record<string, string> = {
  healthy: '#16a34a',
  damaged: '#f59e0b',
  dangerous: '#dc2626',
  visible_issue: '#3b82f6',
  default: '#57534e',
};

const CONDITION_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  damaged: 'Damaged',
  dangerous: 'Dangerous',
  visible_issue: 'Visible Issue',
};

function makeIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;
      background:${color};
      border:2.5px solid white;
      border-radius:50%;
      box-shadow:0 1px 5px rgba(0,0,0,0.5);
      cursor:pointer;
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

function FlyToUser({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lng], 18, { duration: 1.2 }); }, [lat, lng, map]);
  return null;
}

interface Filters { condition: string; group: string; }
const UOM_CENTER: [number, number] = [6.7965, 79.9001];

type EnrichedTree = Tree & { latest_condition: string | null; latest_verified: boolean };

export default function MapView() {
  const [trees, setTrees] = useState<EnrichedTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState('Loading trees...');
  const [filters, setFilters] = useState<Filters>({ condition: '', group: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => { loadTrees(); }, []);

  async function loadTrees() {
    const all: any[] = [];
    let from = 0;
    const PAGE = 1000;

    while (true) {
      setLoadProgress(`Loading trees ${from}–${from + PAGE}...`);
      const { data, error } = await supabase
        .from('trees')
        .select('id, tree_name, lat, lng, department, group_no, height, diameter, incidents(condition, is_verified, submitted_at)')
        .order('created_at')
        .range(from, from + PAGE - 1);

      if (error || !data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    const enriched: EnrichedTree[] = all.map(t => {
      const sorted = ((t.incidents as any[]) || []).sort(
        (a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      );
      return {
        ...t,
        latest_condition: sorted[0]?.condition ?? null,
        latest_verified: sorted[0]?.is_verified ?? false,
      } as EnrichedTree;
    });

    const uniqueGroups = [...new Set(all.map((t: any) => t.group_no).filter(Boolean))].sort();
    setGroups(uniqueGroups);
    setTrees(enriched);
    setLoading(false);
  }

  const locateUser = useCallback(() => {
    if (!navigator.geolocation) return alert('Geolocation not supported by your browser.');
    navigator.geolocation.getCurrentPosition(
      pos => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => alert('Could not get your location. Please allow location access.')
    );
  }, []);

  const filtered = trees.filter(t => {
    if (filters.condition && t.latest_condition !== filters.condition) return false;
    if (filters.group && t.group_no !== filters.group) return false;
    return true;
  });

  const clearFilters = () => setFilters({ condition: '', group: '' });
  const hasFilters = !!(filters.condition || filters.group);

  return (
    // Fixed container: fills exactly the viewport below the 64px navbar
    <div style={{ position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0, zIndex: 0 }}>

      {/* ── Filter panel ── */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 500 }} className="flex flex-col gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-lg border border-stone-200 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filter
          {hasFilters && <span className="w-2 h-2 bg-green-600 rounded-full" />}
        </button>

        {showFilters && (
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 p-4 w-56">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-stone-800 text-sm">Filters</span>
              <div className="flex gap-2">
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700">Clear</button>
                )}
                <button onClick={() => setShowFilters(false)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-stone-500 font-medium block mb-1">Condition</label>
                <select
                  value={filters.condition}
                  onChange={e => setFilters(f => ({ ...f, condition: e.target.value }))}
                  className="w-full text-sm border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50"
                >
                  <option value="">All conditions</option>
                  {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-stone-500 font-medium block mb-1">Campus Zone</label>
                <select
                  value={filters.group}
                  onChange={e => setFilters(f => ({ ...f, group: e.target.value }))}
                  className="w-full text-sm border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50"
                >
                  <option value="">All zones</option>
                  {groups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats badge ── */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 500 }}
        className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-stone-200 px-4 py-3 text-right">
        <div className="text-xs text-stone-500">Showing</div>
        <div className="font-bold text-stone-800 text-xl leading-none">{filtered.length.toLocaleString()}</div>
        <div className="text-xs text-stone-400">of {trees.length.toLocaleString()} trees</div>
      </div>

      {/* ── Legend ── */}
      <div style={{ position: 'absolute', bottom: 32, left: 12, zIndex: 500 }}
        className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-stone-200 p-3">
        <div className="text-xs font-semibold text-stone-600 mb-2 flex items-center gap-1">
          <Layers className="w-3 h-3" /> Condition
        </div>
        {Object.entries(CONDITION_COLORS).map(([k, color]) => (
          <div key={k} className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ background: color }} />
            <span className="text-xs text-stone-500 capitalize">
              {k === 'default' ? 'No report' : CONDITION_LABELS[k] || k.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>

      {/* ── Locate Me ── */}
      <button
        onClick={locateUser}
        style={{ position: 'absolute', bottom: 32, right: 12, zIndex: 500 }}
        className="bg-white rounded-xl shadow-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors flex items-center gap-2"
      >
        📍 Locate Me
      </button>

      {/* ── Map ── */}
      {loading ? (
        <div className="w-full h-full flex items-center justify-center bg-stone-100">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-stone-600 font-medium">{loadProgress}</p>
            <p className="text-stone-400 text-xs mt-1">Fetching all campus trees</p>
          </div>
        </div>
      ) : (
        <MapContainer
          center={UOM_CENTER}
          zoom={16}
          style={{ width: '100%', height: '100%' }}
          zoomControl
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
            maxZoom={20}
          />

          {userPos && (
            <>
              <FlyToUser lat={userPos.lat} lng={userPos.lng} />
              <Circle
                center={[userPos.lat, userPos.lng]}
                radius={15}
                pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.4, weight: 2 }}
              />
            </>
          )}

          {filtered.map(tree => (
            <Marker
              key={tree.id}
              position={[tree.lat, tree.lng]}
              icon={makeIcon(
                CONDITION_COLORS[tree.latest_condition ?? ''] ?? CONDITION_COLORS.default
              )}
            >
              <Popup minWidth={240} maxWidth={300}>
                <div className="p-2">
                  <p className="font-semibold text-stone-800 text-sm mb-0.5">
                    {tree.tree_name || 'Unknown Species'}
                  </p>
                  <p className="text-xs text-stone-400 mb-2">
                    {tree.group_no} {tree.department ? `· ${tree.department}` : ''}
                  </p>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-2 text-xs text-stone-500">
                    {tree.height && <span>Height: <b className="text-stone-700">{tree.height}</b></span>}
                    {tree.diameter && <span>DBH: <b className="text-stone-700">{tree.diameter}</b></span>}
                  </div>

                  {tree.latest_condition ? (
                    <div className="flex items-center gap-2 mb-2">
                      <ConditionBadge condition={tree.latest_condition} />
                      {tree.latest_verified
                        ? <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />Verified</span>
                        : <span className="text-xs text-amber-600 flex items-center gap-0.5"><Clock className="w-3 h-3" />Unverified</span>
                      }
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 mb-2 italic">No condition report yet</p>
                  )}

                  <Link
                    to={`/tree/${tree.id}`}
                    className="block w-full text-center text-xs font-medium bg-green-700 text-white py-1.5 rounded-lg hover:bg-green-800 transition-colors"
                  >
                    View Details & Photos →
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}
