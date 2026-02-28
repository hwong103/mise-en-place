import React from "react";
import { motion } from "framer-motion";

type AnimatedListProps = {
    children: React.ReactNode;
    delay?: number;       // delay before the sequence starts (seconds)
    stagger?: number;     // gap between each item (seconds)
    className?: string;
};

const itemVariants = {
    hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

export default function AnimatedList({
    children,
    delay = 0,
    stagger = 0.07,
    className,
}: AnimatedListProps) {
    const childrenArray = React.Children.toArray(children);

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                visible: {
                    transition: {
                        delayChildren: delay,
                        staggerChildren: stagger,
                    },
                },
            }}
            className={className}
        >
            {childrenArray.map((child, index) => (
                <motion.div key={index} variants={itemVariants} transition={{ duration: 0.35, ease: "easeOut" }}>
                    {child}
                </motion.div>
            ))}
        </motion.div>
    );
}
