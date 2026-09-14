export type TasteProfile = {
  sweetness: number;
  bitterness: number;
  sourness: number;
  body: number;
  aroma: number;
};

export type Brewery = {
  id: string;
  name: string;
  country: string;
  city?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  beerCount?: number;
};

export type BeerSummary = {
  id: string;
  name: string;
  style: string;
  abv: number;
  ibu: number | null;
  description: string;
  imageUrl: string | null;
  brewery: { id: string; name: string; country: string };
  tasteProfile: TasteProfile;
  foodPairings: string[];
  matchPercent: number | null;
};

export type Review = {
  id: string;
  rating: number;
  text: string | null;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
};

export type BeerDetail = BeerSummary & {
  avgRating: number | null;
  reviews: Review[];
  recommendations: BeerSummary[];
};

export type BarEntry = {
  scanId: string;
  scannedAt: string;
  beer: {
    id: string;
    name: string;
    style: string;
    imageUrl: string | null;
    brewery: { id: string; name: string };
  };
};

export type FriendPost = {
  id: string;
  text: string;
  imageUrl: string | null;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  stats: { scanCount: number; reviewCount: number };
};

export type TasteProfileResponse = {
  profile: TasteProfile | null;
  favoriteStyle: string | null;
  beersScanned: number;
  hasEnoughData: boolean;
};
