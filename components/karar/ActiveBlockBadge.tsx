"use client";

/**
 * ACTIVE BLOCK BADGE — verdict WAIT/NO iken aktif hard block sebeplerini
 * VerdictBadge'in HEMEN ALTINDA, "Detaylar" accordion'ını açmaya gerek
 * kalmadan görünür kılar.
 *
 * BlocksList (components/karar/BlocksList.tsx, Detaylar accordion'ı içinde)
 * zaten aynı result.blocks/softBlocks verisini gösteriyor — bu bileşen onun
 * YERİNE geçmiyor, sadece erken/prominent bir özet katmanı. block string'leri
 * lib/score/blocks.ts'ten ZATEN insan-okunur geliyor (örn. "🚨 BTC
 * correlation 42m cooldown", "Hafta sonu düşük hacim koruması") — burada
 * YENİDEN YAZILMIYOR/eşlenmiyor, olduğu gibi gösteriliyor.
 *
 * Sadece hard blocks (result.blocks) — verdict zaten bunlardan "no" oluyor.
 * Soft blocks (result.softBlocks, verdict "wait" ama skor yeterliyken) bu
 * badge'e dahil edilmedi çünkü "wait" durumunda skor zaten eşiği geçmiş
 * olabilir — o incelik BlocksList'in ayrı (amber) render'ında zaten var,
 * burada hard/soft'u aynı kırmızı rozette karıştırmamak için sade tutuldu.
 */

export function ActiveBlockBadge({
  verdict,
  blocks,
}: {
  verdict: "go" | "wait" | "no";
  blocks: readonly string[];
}): React.ReactElement | null {
  if (verdict === "go" || blocks.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {blocks.map((b, i) => (
        <span
          key={i}
          className="bg-soft-red text-signal-red border-signal-red/40 inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[9px] tracking-wide"
        >
          <span>❌</span>
          <span>{b}</span>
        </span>
      ))}
    </div>
  );
}
