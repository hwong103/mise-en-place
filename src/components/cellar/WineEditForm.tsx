"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";

const WINE_TYPES = ["RED", "WHITE", "SPARKLING", "ROSE", "DESSERT", "FORTIFIED", "OTHER"];

const todayString = () => new Date().toISOString().split("T")[0];

type NominatimResult = {
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
    place_id?: string;
    address?: {
        amenity?: string;
        road?: string;
        suburb?: string;
        city?: string;
        town?: string;
        country?: string;
    };
};

export default function WineEditForm({
    wine,
    updateAction,
    mode = "edit",
}: {
    wine: {
        id: string;
        name: string;
        producer: string | null;
        vintage: number | null;
        grapes: string[];
        region: string | null;
        country: string | null;
        type: string;
        rating: number | null;
        tastingNotes: string | null;
        triedAt: Date | null;
        locationName: string | null;
        locationAddress: string | null;
        locationLat: number | null;
        locationLng: number | null;
    };
    updateAction: (fd: FormData) => Promise<void>;
    mode?: "photo" | "url" | "name" | "manual" | "edit";
}) {
    const router = useRouter();

    // Fix 2: controlled type state so badges highlight reliably
    const [selectedType, setSelectedType] = useState<string>(wine.type ?? "RED");

    // Fix 3: controlled rating so we can show the live number
    const [rating, setRating] = useState<number>(wine.rating ?? 7);

    // Fix 4: location autocomplete state
    const [locationQuery, setLocationQuery] = useState(
        wine.locationName
            ? wine.locationAddress
                ? `${wine.locationName}, ${wine.locationAddress}`
                : wine.locationName
            : ""
    );
    const [locationName, setLocationName] = useState(wine.locationName ?? "");
    const [locationAddress, setLocationAddress] = useState(wine.locationAddress ?? "");
    const [lat, setLat] = useState<number | null>(wine.locationLat ?? null);
    const [lng, setLng] = useState<number | null>(wine.locationLng ?? null);
    const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Fix 5: default date to today if no value
    const defaultDate = wine.triedAt
        ? new Date(wine.triedAt).toISOString().split("T")[0]
        : todayString();

    // Close suggestions on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const searchLocation = async (query: string) => {
        if (query.length < 3) { setSuggestions([]); return; }

        const googleKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY;

        if (googleKey) {
            try {
                const res = await fetch(
                    "https://places.googleapis.com/v1/places:autocomplete",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Goog-Api-Key": googleKey,
                        },
                        body: JSON.stringify({
                            input: query,
                            includedPrimaryTypes: ["restaurant", "bar", "food", "establishment"],
                            languageCode: "en",
                        }),
                    }
                );
                const data = await res.json();

                type GooglePrediction = {
                    placeId?: string;
                    text?: { text?: string };
                    structuredFormat?: { mainText?: { text?: string } };
                };

                const predictions: GooglePrediction[] = data.suggestions
                    ?.map((s: { placePrediction?: GooglePrediction }) => s.placePrediction)
                    .filter(Boolean) ?? [];

                if (predictions.length > 0) {
                    const googleSuggestions: NominatimResult[] = predictions
                        .slice(0, 5)
                        .map((p) => ({
                            display_name: p.text?.text ?? "",
                            lat: "",
                            lon: "",
                            name: p.structuredFormat?.mainText?.text ?? p.text?.text?.split(",")[0] ?? "",
                            place_id: p.placeId,
                        }));
                    setSuggestions(googleSuggestions);
                    setShowSuggestions(true);
                    return;
                }
            } catch { /* fall through to Nominatim */ }
        }

        // Fallback: Nominatim for plain addresses when no Google key or Google returns nothing
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
                { headers: { "Accept-Language": "en" } }
            );
            const data: NominatimResult[] = await res.json();
            setSuggestions(data);
            setShowSuggestions(true);
        } catch { /* silent fail */ }
    };

    const handleLocationInput = (value: string) => {
        setLocationQuery(value);
        // Clear resolved values while user is still typing
        setLocationName("");
        setLocationAddress("");
        setLat(null);
        setLng(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchLocation(value), 350);
    };

    const handleSelectSuggestion = async (result: NominatimResult) => {
        const name = result.address?.amenity ?? result.name ?? result.display_name.split(",")[0];
        setLocationName(name);
        setLocationAddress(result.display_name);
        setLocationQuery(result.display_name);
        setSuggestions([]);
        setShowSuggestions(false);

        const googleKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY;

        if (result.place_id && googleKey) {
            try {
                const res = await fetch(
                    `https://places.googleapis.com/v1/places/${result.place_id}`,
                    {
                        headers: {
                            "X-Goog-Api-Key": googleKey,
                            "X-Goog-FieldMask": "location",
                        },
                    }
                );
                const data = await res.json();
                const loc = data.location;
                if (loc) {
                    setLat(loc.latitude);   // new API: "latitude" not "lat"
                    setLng(loc.longitude);  // new API: "longitude" not "lng"
                    return;
                }
            } catch { /* fall through */ }
        }

        // Fallback: use Nominatim lat/lng if available (non-Google path)
        if (result.lat && result.lon) {
            setLat(Number(result.lat));
            setLng(Number(result.lon));
        }
    };

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            {/* Fix 1: header with Cancel button */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                        {mode === "manual" ? "Log a Wine" : "Review Wine"}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {mode === "photo" && "Groq read your label — review and fill in the rest."}
                        {mode === "url" && "Groq extracted details from the URL — review and fill in the rest."}
                        {mode === "name" && "We found these details — review and save to your cellar."}
                        {mode === "manual" && "Fill in what you know. You can always edit later."}
                        {mode === "edit" && "Edit wine details."}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    Cancel
                </button>
            </div>

            <form action={updateAction} className="space-y-5">
                <input type="hidden" name="id" value={wine.id} />
                <input type="hidden" name="locationName" value={locationName} />
                <input type="hidden" name="locationAddress" value={locationAddress} />
                <input type="hidden" name="locationLat" value={lat ?? ""} />
                <input type="hidden" name="locationLng" value={lng ?? ""} />

                {/* Fix 2: controlled type badges */}
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Type</label>
                    <div className="flex flex-wrap gap-2">
                        {WINE_TYPES.map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setSelectedType(t)}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors
                  ${selectedType === t
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    }`}
                            >
                                {t.charAt(0) + t.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                    {/* Hidden input carries the value to the server action */}
                    <input type="hidden" name="type" value={selectedType} />
                </div>

                {/* Name + Vintage */}
                <div className="grid grid-cols-[1fr_100px] gap-3">
                    <Field label="Wine Name" name="name" defaultValue={wine.name} required />
                    <Field label="Vintage" name="vintage" defaultValue={wine.vintage?.toString() ?? ""} placeholder="2021" />
                </div>

                <Field label="Producer / Winery" name="producer" defaultValue={wine.producer ?? ""} />

                <Field
                    label="Grapes (comma separated)"
                    name="grapes"
                    defaultValue={(wine.grapes as string[] | undefined)?.join(", ") ?? ""}
                    placeholder="Shiraz, Grenache"
                />

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Region" name="region" defaultValue={wine.region ?? ""} />
                    <Field label="Country" name="country" defaultValue={wine.country ?? ""} />
                </div>

                {/* Fix 3: rating slider with live number */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Your Rating
                        </label>
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {rating}
                        </span>
                    </div>
                    <input
                        type="range"
                        name="rating"
                        min={1}
                        max={10}
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                        <span>1</span>
                        <span>5</span>
                        <span>10</span>
                    </div>
                </div>

                <Field label="Tasting Notes" name="tastingNotes" defaultValue={wine.tastingNotes ?? ""} multiline />

                {/* Fix 5: default date to today */}
                <Field label="Date Tried" name="triedAt" type="date" defaultValue={defaultDate} />

                {/* Fix 4: location autocomplete */}
                <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Where did you try it?
                    </p>
                    <div className="relative" ref={suggestionsRef}>
                        <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-400">
                            Search venue or address
                        </label>
                        <input
                            type="text"
                            value={locationQuery}
                            onChange={(e) => handleLocationInput(e.target.value)}
                            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                            placeholder="Icebergs Dining Room, Bondi Beach…"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                                {suggestions.map((s, i) => {
                                    const name = s.address?.amenity ?? s.name ?? s.display_name.split(",")[0];
                                    const sub = s.display_name.split(",").slice(1, 3).join(",").trim();
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => handleSelectSuggestion(s)}
                                            className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{name}</span>
                                            {sub && <span className="text-xs text-slate-400">{sub}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {lat && lng && locationName && (
                            <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                                {locationName}
                            </p>
                        )}
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                >
                    Save to Cellar
                </button>
            </form>
        </div>
    );
}

function Field({
    label, name, defaultValue = "", placeholder, required, type = "text", multiline,
}: {
    label: string; name: string; defaultValue?: string;
    placeholder?: string; required?: boolean; type?: string; multiline?: boolean;
}) {
    const cls = "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
            {multiline ? (
                <textarea name={name} defaultValue={defaultValue} placeholder={placeholder} rows={3} className={cls} />
            ) : (
                <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} className={cls} />
            )}
        </div>
    );
}
