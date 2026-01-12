import Image from "next/image";
import Link from "next/link";

export default function BrandLogo({
  size = 44,
  showText = true,
  href = "/",
}: {
  size?: number;
  showText?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <Image
        src="/logo-deus.webp"
        alt="Deus Code"
        width={size}
        height={size}
        priority
        className="rounded-md"
      />
      {showText && (
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight text-white">Deus Code</div>
          <div className="text-xs text-white/70">SOP & Admin Docs</div>
        </div>
      )}
    </Link>
  );
}
