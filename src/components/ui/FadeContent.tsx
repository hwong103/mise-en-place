"use client";

import { motion } from "framer-motion";

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
    return (
        <motion.div
            initial={{ opacity: 0, filter: blur ? "blur(8px)" : "none", y: 8 }}
            whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            viewport={{ once: true, margin: "0px 0px -40px 0px" }}
            transition={{ duration, delay, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
