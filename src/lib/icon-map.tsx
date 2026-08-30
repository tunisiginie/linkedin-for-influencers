// Maps the icon name strings stored in `categories.icon` / `platforms.icon`
// (see supabase/schema.sql seed data) to the actual lucide component. Kept
// as an explicit map (not a dynamic import) so the bundle only includes the
// icons the app actually seeds.
//
// Platform icons are generic lucide icons, not brand logos: lucide-react v1
// dropped every trademarked brand/logo icon (Youtube, Instagram, Twitter,
// Twitch, ...), so schema.sql seeds a sensible generic stand-in per
// platform instead (Play, Camera, Music2, Radio, AtSign).
import {
  AtSign,
  Baby,
  Briefcase,
  Camera,
  ChefHat,
  Cpu,
  Dumbbell,
  Drama,
  GraduationCap,
  Gamepad2,
  Landmark,
  Music,
  Music2,
  Plane,
  Play,
  Radio,
  Shirt,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Gamepad2,
  Sparkles,
  Landmark,
  Dumbbell,
  Cpu,
  ChefHat,
  Plane,
  GraduationCap,
  Drama,
  Music,
  Baby,
  Shirt,
  Play,
  Camera,
  Music2,
  Radio,
  AtSign,
};

export function resolveIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Briefcase;
}

/** Renders the icon for a stored icon-name string. Prefer this over calling
 * resolveIcon() and using the result as a JSX tag directly at each call
 * site — this centralizes the one spot that needs the lint escape hatch
 * below, instead of scattering it everywhere an icon name is rendered.
 *
 * The prop is `iconName`, not `name` — SVGProps already declares a `name`
 * attribute (typed `string | undefined`), and intersecting that with a
 * nullable `name` prop silently drops `null` from the allowed type. */
export function ResolvedIcon({
  iconName,
  ...props
}: { iconName: string | null | undefined } & React.ComponentProps<LucideIcon>) {
  const Icon = resolveIcon(iconName);
  // resolveIcon() only ever returns a reference from the static ICONS map
  // above (or the static Briefcase fallback) — never a freshly-created
  // component — so this is safe despite looking like the anti-pattern the
  // rule targets.
  // eslint-disable-next-line react-hooks/static-components
  return <Icon {...props} />;
}
