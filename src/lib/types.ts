export type TreeCondition = 'healthy' | 'damaged' | 'dangerous' | 'visible_issue';
export type IncidentStatus = 'unverified' | 'verified' | 'resolved';
export type PhotoType = 'full' | 'trunk' | 'branch' | 'leaves' | 'flower' | 'report';

export interface Tree {
  id: string;
  tree_name: string | null;
  height: string | null;
  diameter: string | null;
  department: string | null;
  group_no: string | null;
  lat: number;
  lng: number;
  source_group: string;
  created_at: string;
  // joined
  photos?: TreePhoto[];
  incidents?: Incident[];
  latest_condition?: TreeCondition | null;
}

export interface TreePhoto {
  id: string;
  tree_id: string;
  photo_type: PhotoType;
  url: string;
  created_at: string;
}

export interface Incident {
  id: string;
  tree_id: string;
  submitted_by: string | null;
  description: string | null;
  condition: TreeCondition;
  is_verified: boolean;
  photo_url: string | null;
  submitted_at: string;
  tree?: Pick<Tree, 'id' | 'tree_name' | 'lat' | 'lng'>;
}

export interface ZoneBoundary {
  id: string;
  zone_name: string;
  geojson: object;
}

export interface DashboardStats {
  total_trees: number;
  total_incidents: number;
  verified_incidents: number;
  unverified_incidents: number;
  by_condition: Record<TreeCondition, number>;
  by_group: Record<string, number>;
  incidents_by_day: { date: string; count: number }[];
  top_species: { name: string; count: number }[];
}
