import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { createContext, ReactNode, useCallback, useContext, useState } from "react";

/** Motion for both pages, in one place, on the DESIGN.md rule: motion only
 * marks a state change that already happened in the data — a page arriving
 * or leaving, a claim added or superseded, a drawer opening. Framer Motion
 * handles the choreography; `MotionConfig reducedMotion="user"` turns it
 * into instant cuts when the OS asks for reduced motion. */

export const EASE = [0.22, 1, 0.36, 1] as const;

interface LeaveApi {
  leave: (href: string) => void;
}
const LeaveContext = createContext<LeaveApi>({ leave: (href) => window.location.assign(href) });

const LEAVE_MS = 220;

/** Wraps a whole page: fades/slides it in on mount, and fades it out before
 * a `TransitionLink` navigates to the other page (the two pages are separate
 * document loads, so the exit has to run before `location.assign`). */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  const [leaving, setLeaving] = useState(false);
  const reduced = useReducedMotion();
  const leave = useCallback(
    (href: string) => {
      if (reduced) {
        window.location.assign(href);
        return;
      }
      setLeaving(true);
      window.setTimeout(() => window.location.assign(href), LEAVE_MS);
    },
    [reduced]
  );
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.32, ease: EASE }}>
      <LeaveContext.Provider value={{ leave }}>
        <motion.div
          className={className}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: leaving ? 0 : 1, y: leaving ? -6 : 0 }}
          transition={{ duration: leaving ? LEAVE_MS / 1000 : 0.45, ease: EASE }}
          style={{ minHeight: "100%" }}
        >
          {children}
        </motion.div>
      </LeaveContext.Provider>
    </MotionConfig>
  );
}

/** An <a> that plays the page's exit before navigating. Modifier-clicks
 * (new tab) and same-page anchors are left to the browser. */
export function TransitionLink({
  href,
  children,
  className,
  title,
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "title" | "children">) {
  const { leave } = useContext(LeaveContext);
  return (
    <a
      href={href}
      className={className}
      title={title}
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (href.startsWith("#")) return;
        e.preventDefault();
        leave(href);
      }}
    >
      {children}
    </a>
  );
}

/** Scroll-triggered reveal for the front page: rises 24px into place the
 * first time it enters the viewport. `delay` staggers siblings. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

/** Fade-and-lift for something that appears because of data (a claim row,
 * a banner, the lamp's new verdict). Use inside an <AnimatePresence>. */
export const appear = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4, transition: { duration: 0.18 } },
};

export { AnimatePresence, motion };
