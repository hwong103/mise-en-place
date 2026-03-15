"use client";

import { motion, useReducedMotion } from "framer-motion";

type FadeContentProps = {
    children: React.ReactNode;
    blur?: boolean;
    duration?: number;
    delay?: number;
    className?: string;
};

export default function FadeContent({
    children,
    blur = false,
    duration = 0.5,
    delay = 0,
    className,
}: FadeContentProps) {
    const prefersReducedMotion = useReducedMotion();

    return (
        <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, filter: blur ? "blur(8px)" : "none", y: 8 }}
            whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", y: 0 }}
            viewport={{ once: true, margin: "0px 0px -40px 0px" }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration, delay, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
