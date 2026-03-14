export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type MealType = "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER";
export type WineType = "RED" | "WHITE" | "SPARKLING" | "ROSE" | "DESSERT" | "FORTIFIED" | "OTHER";

export type User = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  authProviderUserId: string | null;
  betterAuthUserId: string | null;
};

export type Household = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  shareTokenHash: string | null;
  shareTokenVersion: number;
  claimedByUserId: string | null;
  claimedAt: Date | null;
};

export type HouseholdMember = {
  id: string;
  userId: string;
  householdId: string;
  role: Role;
  joinedAt: Date;
};

export type Recipe = {
  id: string;
  householdId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  ingredients: JsonValue;
  instructions: JsonValue;
  notes: JsonValue | null;
  prepGroups: JsonValue;
  tags: JsonValue;
  createdAt: Date;
  updatedAt: Date;
  videoUrl: string | null;
  ingredientCount: number;
  cookCount: number;
};

export type MealPlan = {
  id: string;
  householdId: string;
  recipeId: string;
  date: Date;
  mealType: MealType;
  servings: number;
  cooked: boolean;
  cookedAt: Date | null;
};

export type ShoppingListItem = {
  id: string;
  householdId: string;
  weekStart: Date;
  line: string;
  lineNormalized: string;
  category: string;
  manual: boolean;
  checked: boolean;
  createdAt: Date;
  updatedAt: Date;
  location: string;
};

export type Wine = {
  id: string;
  householdId: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  grapes: JsonValue;
  region: string | null;
  country: string | null;
  type: WineType;
  rating: number | null;
  tastingNotes: string | null;
  triedAt: Date | null;
  locationName: string | null;
  locationAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  imageUrl: string | null;
  danMurphysProductId: string | null;
  danMurphysUrl: string | null;
  danMurphysPrice: number | null;
  danMurphysSource: string | null;
  danMurphysPriceAt: Date | null;
  stockists: JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};
