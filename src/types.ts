export type Role = "SUPER_ADMIN" | "CONTENT_EDITOR" | "SALES_AGENT";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  status?: "ACTIVE" | "DISABLED";
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type Taxonomy = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  coverMediaId?: string | null;
  status: PublicationStatus;
  sortOrder: number;
  isDemo: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type MediaAsset = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  width: number | null;
  height: number | null;
  altText: string;
  caption: string | null;
  sourceNotes: string | null;
  licenseNotes: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  provider: string;
  createdAt: string;
  updatedAt: string;
};

export type PackageSummary = Pick<PackageRecord,
  "id" | "slug" | "title" | "status" | "days" | "nights" | "basePrice" |
  "currency" | "priceBasis" | "isDemo" | "updatedAt"
>;

export type PackageRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  overview: string;
  days: number;
  nights: number;
  startingCity: string | null;
  basePrice: string | null;
  currency: string;
  priceBasis: "PER_PERSON" | "PER_GROUP" | "PER_ROOM" | "ON_REQUEST";
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  transportInformation: string | null;
  accommodationNotes: string | null;
  importantInformation: string | null;
  cancellationRules: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  brochure: {
    id: string;
    originalName: string;
    mimeType: string;
    visibility: "PUBLIC" | "PRIVATE";
  } | null;
  status: PublicationStatus;
  publishedAt: string | null;
  isFeatured: boolean;
  featuredOrder: number | null;
  isDemo: boolean;
  destinations: Array<{
    id: string;
    slug: string;
    name: string;
    sortOrder: number;
  }>;
  categories: Array<{ id: string; slug: string; name: string }>;
  itinerary: Array<{
    id?: string;
    dayNumber: number;
    title: string;
    description: string;
    activities: string[];
    meals: string | null;
    accommodation: string | null;
  }>;
  departures: Array<{
    id?: string;
    startDate: string;
    endDate: string;
    pricePerPerson: string | null;
    currency: string;
    status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
    note: string | null;
  }>;
  media: Array<MediaAsset & { sortOrder: number; isCover: boolean }>;
  createdAt: string;
  updatedAt: string;
};
