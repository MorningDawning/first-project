import { Beer, Brewery, Review, User } from "@prisma/client";
import { USERS_MIN_VOTES } from "./crowdTaste";
import { tasteVector } from "./taste";

type BeerWithBrewery = Beer & { brewery: Brewery };
type BeerWithReviews = BeerWithBrewery & { reviews: (Review & { user: User })[] };

export function serializeBeer(beer: BeerWithBrewery, matchPercent: number | null = null, isWishlisted = false) {
  return {
    id: beer.id,
    name: beer.name,
    style: beer.style,
    abv: beer.abv,
    ibu: beer.ibu,
    description: beer.description,
    imageUrl: beer.imageUrl,
    brewery: {
      id: beer.brewery.id,
      name: beer.brewery.name,
      country: beer.brewery.country,
      logoUrl: beer.brewery.logoUrl,
    },
    tasteProfile: tasteVector(beer),
    tasteVotes: beer.tasteVotes,
    tasteSource: beer.tasteVotes >= USERS_MIN_VOTES ? "users" : "style",
    foodPairings: JSON.parse(beer.foodPairings) as string[],
    matchPercent,
    isWishlisted,
  };
}

export function serializeBeerDetail(
  beer: BeerWithReviews,
  matchPercent: number | null,
  recommendations: { beer: BeerWithBrewery; match: number }[],
  isWishlisted = false
) {
  return {
    ...serializeBeer(beer, matchPercent, isWishlisted),
    avgRating:
      beer.reviews.length > 0
        ? Math.round((beer.reviews.reduce((s, r) => s + r.rating, 0) / beer.reviews.length) * 10) / 10
        : null,
    reviews: beer.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      tags: JSON.parse(r.tags) as string[],
      createdAt: r.createdAt,
      user: { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl },
    })),
    recommendations: recommendations.map((s) => serializeBeer(s.beer, s.match)),
  };
}
