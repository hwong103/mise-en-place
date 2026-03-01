"use client";

import { Wine } from "@prisma/client";
import { useState } from "react";

const WINE_TYPES = ["RED", "WHITE", "SPARKLING", "ROSE", "DESSERT", "FORTIFIED", "OTHER"];

export default function WineEditForm({
    wine,
    updateAction,
    mode = "edit",
}: {
    wine: Wine;
    updateAction: (fd: FormData) => Promise<void>;
    mode?: "photo" | "url" | "manual" | "edit";
}) {
    const [locationAddress, setLocationAddress] = useState(wine.locationAddress ?? "");
    const [lat, setLat] = useState<number | null>(wine.locationLat ?? null);
    const [lng, setLng] = useState<number | null>(wine.locationLng ?? null);

    // Geocode address on blur using browser Geocoding API (free, no key)
    const geocodeAddress = async (address: string) => {
        if (!address) return;
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
                { headers: { "Accept-Language": "en" } }
            );
            const data = await response.json();
            if (data[0]) {
                setLat(Number(data[0].lat));
                setLng(Number(data[0].lon));
            }
        } catch { /* silent fail */ }
    };

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                    {mode === "manual" ? "Log a Wine" : "Review Wine"}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {mode === "photo" && "Groq read your label — review and fill in the rest."}
                    {mode === "url" && "Groq extracted details from the URL — review and fill in the rest."}
                    {mode === "manual" && "Fill in what you know. You can always edit later."}
                    {mode === "edit" && "Edit wine details."}
                </p>
            </div>

            <form action={updateAction} className="space-y-5">
                <input type="hidden" name="id" value={wine.id} />
                <input type="hidden" name="locationLat" value={lat ?? ""} />
                <input type="hidden" name="locationLng" value={lng ?? ""} />

                {/* Type selector */}
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Type</label>
                    <div className="flex flex-wrap gap-2">
                        {WINE_TYPES.map((t) => (
                            <label key={t} className="cursor-pointer">
                                <input type="radio" name="type" value={t} defaultChecked={wine.type === t} className="sr-only" />
                                <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:has-[:checked]:border-emerald-500 dark:has-[:checked]:bg-emerald-950/40 dark:has-[:checked]:text-emerald-300">
                                    {t.charAt(0) + t.slice(1).toLowerCase()}
                                </span>
                            </label>
                        ))}
                    </div>
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
                    defaultValue={wine.grapes?.join(", ") ?? ""}
                    placeholder="Shiraz, Grenache"
                />

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Region" name="region" defaultValue={wine.region ?? ""} />
                    <Field label="Country" name="country" defaultValue={wine.country ?? ""} />
                </div>

                {/* Rating */}
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Your Rating (1–10)
                    </label>
                    <input
                        type="range" name="rating" min={1} max={10}
                        defaultValue={wine.rating ?? 7}
                        className="w-full accent-emerald-600"
                    />
                </div>

                <Field label="Tasting Notes" name="tastingNotes" defaultValue={wine.tastingNotes ?? ""} multiline />

                {/* Date tried */}
                <Field label="Date Tried" name="triedAt" type="date"
                    defaultValue={wine.triedAt ? wine.triedAt.toISOString().split("T")[0] : ""} />

                {/* Location */}
                <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Where did you try it?</p>
                    <Field label="Venue Name" name="locationName" defaultValue={wine.locationName ?? ""} placeholder="Icebergs Dining Room" />
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Address</label>
                        <input
                            name="locationAddress"
                            value={locationAddress}
                            onChange={(e) => setLocationAddress(e.target.value)}
                            onBlur={(e) => geocodeAddress(e.target.value)}
                            placeholder="1 Notts Ave, Bondi Beach NSW 2026"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                        {lat && lng ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                📍 Located: {lat.toFixed(4)}, {lng.toFixed(4)}
                            </p>
                        ) : null}
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
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
