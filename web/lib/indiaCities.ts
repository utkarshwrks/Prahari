// Extended Indian-city gazetteer for LIVE OSINT mode, so real news/posts that
// mention any major Indian city can be geolocated on the map. The MP cities in
// cities.ts remain the geofence set; these are additional plot points.

export interface GeoCity {
  name: string;
  lat: number;
  lng: number;
}

export const INDIA_CITIES: GeoCity[] = [
  { name: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "New Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Bangalore", lat: 12.9716, lng: 77.5946 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Surat", lat: 21.1702, lng: 72.8311 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { name: "Kanpur", lat: 26.4499, lng: 80.3319 },
  { name: "Nagpur", lat: 21.1458, lng: 79.0882 },
  { name: "Patna", lat: 25.5941, lng: 85.1376 },
  { name: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { name: "Bhopal", lat: 23.2599, lng: 77.4126 },
  { name: "Indore", lat: 22.7196, lng: 75.8577 },
  { name: "Gwalior", lat: 26.2183, lng: 78.1828 },
  { name: "Ujjain", lat: 23.1765, lng: 75.7885 },
  { name: "Jabalpur", lat: 23.1815, lng: 79.9864 },
  { name: "Katni", lat: 23.8343, lng: 80.3894 },
  { name: "Narsinghpur", lat: 22.9463, lng: 79.1926 },
  { name: "Sagar", lat: 23.8388, lng: 78.7378 },
  { name: "Rewa", lat: 24.5362, lng: 81.3037 },
  { name: "Satna", lat: 24.5709, lng: 80.8322 },
  { name: "Ranchi", lat: 23.3441, lng: 85.3096 },
  { name: "Raipur", lat: 21.2514, lng: 81.6296 },
  { name: "Bhubaneswar", lat: 20.2961, lng: 85.8245 },
  { name: "Guwahati", lat: 26.1445, lng: 91.7362 },
  { name: "Kochi", lat: 9.9312, lng: 76.2673 },
  { name: "Thiruvananthapuram", lat: 8.5241, lng: 76.9366 },
  { name: "Coimbatore", lat: 11.0168, lng: 76.9558 },
  { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
  { name: "Vijayawada", lat: 16.5062, lng: 80.648 },
  { name: "Amritsar", lat: 31.634, lng: 74.8723 },
  { name: "Ludhiana", lat: 30.901, lng: 75.8573 },
  { name: "Agra", lat: 27.1767, lng: 78.0081 },
  { name: "Varanasi", lat: 25.3176, lng: 82.9739 },
  { name: "Meerut", lat: 28.9845, lng: 77.7064 },
  { name: "Nashik", lat: 19.9975, lng: 73.7898 },
  { name: "Vadodara", lat: 22.3072, lng: 73.1812 },
  { name: "Dehradun", lat: 30.3165, lng: 78.0322 },
  { name: "Srinagar", lat: 34.0837, lng: 74.7973 },
  { name: "Jodhpur", lat: 26.2389, lng: 73.0243 },
];

const INDIA_MAP: Record<string, GeoCity> = Object.fromEntries(
  INDIA_CITIES.map((c) => [c.name.toLowerCase(), c])
);

export function getIndiaCity(name: string): GeoCity | undefined {
  return INDIA_MAP[name.trim().toLowerCase()];
}

export const INDIA_CITY_NAMES: string[] = INDIA_CITIES.map((c) => c.name);
