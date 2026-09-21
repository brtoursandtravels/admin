import { z } from "zod";
import type { PackageRecord } from "../types";

export function overviewExcerpt(overview: string) {
  const description = overview.replace(/\s+/g, " ").trim();
  return description.length <= 500
    ? description
    : `${description.slice(0, 497).replace(/[\uD800-\uDBFF]$/u, "").trimEnd()}...`;
}

const listText = z.string().max(20_000);
const itineraryItem = z.object({
  dayNumber: z.string().regex(/^\d+$/, "Use a day number."),
  title: z.string().max(200),
  description: z.string().max(10000),
  activitiesText: listText,
  meals: z.string(),
  accommodation: z.string(),
  imageMediaId: z.string(),
});
const departureItem = z
  .object({
    startDate: z.string().min(1, "Choose a start date."),
    endDate: z.string().min(1, "Choose an end date."),
    pricePerPerson: z.string().refine(value => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0), "Enter a valid non-negative price."),
    currency: z.string().length(3, "Use a 3-letter currency."),
    status: z.enum(["SCHEDULED", "FILLING_FAST", "CANCELLED", "COMPLETED"]),
    seatsAvailable: z.string().refine(value => value === "" || (/^\d+$/.test(value) && Number(value) <= 100000), "Use a non-negative seat count."),
    note: z.string().max(500),
  })
  .refine((item) => item.endDate >= item.startDate, {
    path: ["endDate"],
    message: "End date must follow the start date.",
  });
export const packageFormSchema = z
  .object({
    slug: z
      .string()
      .min(2)
      .max(180)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase words separated by hyphens.",
      ),
    title: z.string().min(2).max(200),
    overview: z.string().max(30_000),
    days: z.string().regex(/^\d+$/, "Use a whole number.").refine(value => Number(value) >= 1 && Number(value) <= 90, "Use 1 to 90 days."),
    nights: z.string().regex(/^\d+$/, "Use a whole number.").refine(value => Number(value) <= 89, "Use 0 to 89 nights."),
    startingCity: z.string(),
    basePrice: z.string(),
    currency: z.string().length(3),
    priceBasis: z.enum(["PER_PERSON", "PER_GROUP", "PER_ROOM", "ON_REQUEST"]),
    highlightsText: listText,
    inclusionsText: listText,
    exclusionsText: listText,
    transportInformation: z.string(),
    accommodationNotes: z.string(),
    importantInformation: z.string(),
    cancellationRules: z.string(),
    seoTitle: z.string().max(70),
    seoDescription: z.string().max(170),
    brochureMediaId: z.string(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    publishedAt: z.string(),
    isFeatured: z.boolean(),
    featuredOrder: z.string(),
    isDemo: z.boolean(),
    destinationsText: z.string().max(4_000).superRefine((value, context) => {
      const names = lines(value);
      if (names.length > 20) context.addIssue({ code: "custom", message: "Add up to 20 destinations." });
      if (names.some((name) => name.length > 160)) context.addIssue({ code: "custom", message: "Keep each destination within 160 characters." });
    }),
    categoryIds: z.array(z.string()).max(1, "Select only one category."),
    itinerary: z.array(itineraryItem),
    departures: z.array(departureItem),
    media: z.array(
      z.object({
        mediaAssetId: z.string(),
        sortOrder: z.number(),
        isCover: z.boolean(),
      }),
    ),
  })
  .superRefine((value, context) => {
    if (value.status === "PUBLISHED") {
      value.itinerary.forEach((day, index) => {
        if (!day.title.trim()) context.addIssue({ code: "custom", path: ["itinerary", index, "title"], message: "Add a title." });
        if (!day.description.trim()) context.addIssue({ code: "custom", path: ["itinerary", index, "description"], message: "Add a description." });
      });
      if (overviewExcerpt(value.overview).length < 20) context.addIssue({ code: "custom", path: ["overview"], message: "Add an overview of at least 20 characters." });
    }
    if (Number(value.nights) > Number(value.days))
      context.addIssue({
        code: "custom",
        path: ["nights"],
        message: "Nights cannot exceed days.",
      });
    if (
      value.priceBasis !== "ON_REQUEST" &&
      (!value.basePrice || !Number.isFinite(Number(value.basePrice)) || Number(value.basePrice) < 0)
    )
      context.addIssue({
        code: "custom",
        path: ["basePrice"],
        message: "Add a valid base price or choose price on request.",
      });
    if (value.media.filter((item) => item.isCover).length > 1)
      context.addIssue({
        code: "custom",
        path: ["media"],
        message: "Choose only one cover image.",
      });
  });
export type PackageForm = z.infer<typeof packageFormSchema>;

export const blankForm: PackageForm = {
  slug: "",
  title: "",
  overview: "",
  days: "1",
  nights: "0",
  startingCity: "",
  basePrice: "",
  currency: "INR",
  priceBasis: "ON_REQUEST",
  highlightsText: "",
  inclusionsText: "",
  exclusionsText: "",
  transportInformation: "",
  accommodationNotes: "",
  importantInformation: "",
  cancellationRules: "",
  seoTitle: "",
  seoDescription: "",
  brochureMediaId: "",
  status: "DRAFT",
  publishedAt: "",
  isFeatured: false,
  featuredOrder: "",
  isDemo: false,
  destinationsText: "",
  categoryIds: [],
  itinerary: [],
  departures: [],
  media: [],
};
const lines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
const text = (value: string | null | undefined) => value ?? "";
const joinLines = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join("\n")
    : "";

export function recordToForm(record: PackageRecord): PackageForm {
  return {
    slug: record.slug,
    title: record.title,
    overview: record.overview,
    days: String(record.days),
    nights: String(record.nights),
    startingCity: text(record.startingCity),
    basePrice: text(record.basePrice),
    currency: record.currency,
    priceBasis: record.priceBasis,
    highlightsText: joinLines(record.highlights),
    inclusionsText: joinLines(record.inclusions),
    exclusionsText: joinLines(record.exclusions),
    transportInformation: text(record.transportInformation),
    accommodationNotes: text(record.accommodationNotes),
    importantInformation: text(record.importantInformation),
    cancellationRules: text(record.cancellationRules),
    seoTitle: text(record.seoTitle),
    seoDescription: text(record.seoDescription),
    brochureMediaId: record.brochure?.id ?? "",
    status: record.status,
    publishedAt: record.publishedAt
      ? new Date(new Date(record.publishedAt).getTime() - new Date(record.publishedAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
      : "",
    isFeatured: record.isFeatured,
    featuredOrder:
      record.featuredOrder === null ? "" : String(record.featuredOrder),
    isDemo: record.isDemo,
    destinationsText: record.destinations.map((item) => item.name).join("\n"),
    categoryIds: record.categories.map((item) => item.id),
    itinerary: record.itinerary.map((item) => ({
      dayNumber: String(item.dayNumber),
      title: item.title,
      description: item.description,
      activitiesText: joinLines(item.activities),
      meals: text(item.meals),
      accommodation: text(item.accommodation),
      imageMediaId: item.imageMediaId ?? "",
    })),
    departures: record.departures.map((item) => ({
      startDate: item.startDate,
      endDate: item.endDate,
      pricePerPerson: text(item.pricePerPerson),
      currency: item.currency,
      status: item.status,
      note: text(item.note),
      seatsAvailable: item.seatsAvailable == null ? "" : String(item.seatsAvailable),
    })),
    media: record.media.map((item) => ({
      mediaAssetId: item.id,
      sortOrder: item.sortOrder,
      isCover: item.isCover,
    })),
  };
}

export function formToPayload(value: PackageForm) {
  return {
    slug: value.slug,
    title: value.title,
    summary: overviewExcerpt(value.overview),
    overview: value.overview,
    days: Number(value.days),
    nights: Number(value.nights),
    startingCity: value.startingCity || null,
    basePrice:
      value.priceBasis === "ON_REQUEST" || !value.basePrice
        ? null
        : Number(value.basePrice),
    currency: value.currency.toUpperCase(),
    priceBasis: value.priceBasis,
    highlights: lines(value.highlightsText),
    inclusions: lines(value.inclusionsText),
    exclusions: lines(value.exclusionsText),
    transportInformation: value.transportInformation || null,
    accommodationNotes: value.accommodationNotes || null,
    importantInformation: value.importantInformation || null,
    cancellationRules: value.cancellationRules || null,
    seoTitle: value.seoTitle.trim() || null,
    seoDescription: value.seoDescription.trim() || null,
    brochureMediaId: value.brochureMediaId || null,
    status: value.status,
    publishedAt: value.publishedAt
      ? new Date(value.publishedAt).toISOString()
      : null,
    isFeatured: value.isFeatured,
    featuredOrder:
      value.isFeatured && value.featuredOrder
        ? Number(value.featuredOrder)
        : null,
    isDemo: value.isDemo,
    destinationNames: lines(value.destinationsText),
    categoryIds: value.categoryIds,
    itinerary: value.itinerary.map((item, index) => ({
      dayNumber: index + 1,
      title: item.title,
      description: item.description,
      activities: lines(item.activitiesText),
      meals: item.meals || null,
      accommodation: item.accommodation || null,
      imageMediaId: item.imageMediaId || null,
    })),
    departures: value.departures.map((item) => ({
      startDate: item.startDate,
      endDate: item.endDate,
      pricePerPerson: item.pricePerPerson ? Number(item.pricePerPerson) : null,
      currency: item.currency.toUpperCase(),
      status: item.status,
      note: item.note || null,
      seatsAvailable: item.seatsAvailable === "" ? null : Number(item.seatsAvailable),
    })),
    media: value.media.map((item, index) => ({ ...item, sortOrder: index })),
  };
}

