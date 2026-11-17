import {
  Apple, Bed, Bike, BookOpen, Brain, Check, Code, Droplet, Dumbbell, Footprints, GraduationCap, Heart, House, Leaf,
  Moon, Music, Pencil, PhoneOff, Salad, Smile, Sparkles, Sun, Timer, Trophy, type LucideIcon,
} from "lucide-react";
import { corHabito } from "@/lib/catalogo";
import { cn } from "@/lib/cn";

export const MAPA_ICONES: Record<string, LucideIcon> = {
  check: Check, droplet: Droplet, "book-open": BookOpen, "graduation-cap": GraduationCap, moon: Moon, bed: Bed,
  dumbbell: Dumbbell, footprints: Footprints, bike: Bike, trophy: Trophy, apple: Apple, salad: Salad, brain: Brain,
  heart: Heart, smile: Smile, sun: Sun, music: Music, code: Code, pencil: Pencil, sparkles: Sparkles, home: House,
  "phone-off": PhoneOff, leaf: Leaf, timer: Timer,
};

export function IconeHabito({ icone, cor, className, tamanho = "m" }: { icone: string; cor: string; className?: string; tamanho?: "p" | "m" | "g" }) {
  const I = MAPA_ICONES[icone] ?? Check;
  const c = corHabito(cor);
  const t = { p: "h-8 w-8 rounded-lg", m: "h-10 w-10 rounded-xl", g: "h-14 w-14 rounded-2xl" }[tamanho];
  return (
    <span className={cn("grid grid-cols-1 shrink-0 place-items-center border", t, className)} style={{ color: c, borderColor: c + "44", background: c + "14" }} aria-hidden>
      <I className={tamanho === "g" ? "h-6 w-6" : "h-[18px] w-[18px]"} />
    </span>
  );
}
