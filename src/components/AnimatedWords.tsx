import { motion, useReducedMotion } from 'framer-motion';

export default function AnimatedWords({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <span aria-hidden="true">
      {text.split(/\s+/).filter(Boolean).map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="animated-word"
          initial={reduceMotion ? false : { opacity: 0, y: 24, rotateX: -65, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
          transition={{
            delay: reduceMotion ? 0 : 0.12 + index * 0.065,
            duration: reduceMotion ? 0 : 0.62,
            ease: [0.2, 0.8, 0.2, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}
