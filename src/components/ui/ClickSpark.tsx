"use client";

import { useRef, useState, useCallback } from "react";

type Spark = {
    id: number;
    x: number;
    y: number;
    angle: number;
};

type ClickSparkProps = {
    children: React.ReactNode;
    sparkColor?: string;
    sparkCount?: number;
    sparkSize?: number;
    duration?: number;   // ms
    className?: string;
};

export default function ClickSpark({
    children,
    sparkColor = "#10b981", // emerald-500
    sparkCount = 8,
    sparkSize = 6,
    duration = 500,
    className,
}: ClickSparkProps) {
    const [sparks, setSparks] = useState<Spark[]>([]);
    const counterRef = useRef(0);

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newSparks: Spark[] = Array.from({ length: sparkCount }, (_, i) => ({
            id: counterRef.current++,
            x,
            y,
            angle: (360 / sparkCount) * i,
        }));

        setSparks((prev) => [...prev, ...newSparks]);
        setTimeout(() => {
            setSparks((prev) => prev.filter((s) => !newSparks.find((ns) => ns.id === s.id)));
        }, duration);
    }, [sparkCount, duration]);

    return (
        <div
            className={`relative overflow-hidden ${className ?? ""}`}
            onClick={handleClick}
        >
            {children}
            {sparks.map((spark) => (
                <span
                    key={spark.id}
                    style={{
                        position: "absolute",
                        left: spark.x,
                        top: spark.y,
                        width: sparkSize,
                        height: sparkSize,
                        borderRadius: "50%",
                        backgroundColor: sparkColor,
                        pointerEvents: "none",
                        transform: "translate(-50%, -50%)",
                        animation: `spark-fly-${spark.id % 8} ${duration}ms ease-out forwards`,
                    }}
                />
            ))}
            <style>{`
        @keyframes spark-fly-0 { to { transform: translate(calc(-50% + 30px), calc(-50% - 30px)) scale(0); opacity: 0; } }
        @keyframes spark-fly-1 { to { transform: translate(calc(-50% + 42px), calc(-50%)) scale(0); opacity: 0; } }
        @keyframes spark-fly-2 { to { transform: translate(calc(-50% + 30px), calc(-50% + 30px)) scale(0); opacity: 0; } }
        @keyframes spark-fly-3 { to { transform: translate(calc(-50%), calc(-50% + 42px)) scale(0); opacity: 0; } }
        @keyframes spark-fly-4 { to { transform: translate(calc(-50% - 30px), calc(-50% + 30px)) scale(0); opacity: 0; } }
        @keyframes spark-fly-5 { to { transform: translate(calc(-50% - 42px), calc(-50%)) scale(0); opacity: 0; } }
        @keyframes spark-fly-6 { to { transform: translate(calc(-50% - 30px), calc(-50% - 30px)) scale(0); opacity: 0; } }
        @keyframes spark-fly-7 { to { transform: translate(calc(-50%), calc(-50% - 42px)) scale(0); opacity: 0; } }
      `}</style>
        </div>
    );
}
