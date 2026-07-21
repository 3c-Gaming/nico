export interface FontePreset {
  id: string
  label: string
  googleFont?: string
  cssStack: string
}

export const FONTES_PRESET: FontePreset[] = [
  { id: 'geist', label: 'Padrão (Geist)', cssStack: 'var(--font-geist-sans), sans-serif' },
  { id: 'sf-pro', label: 'SF Pro Display (Apple)', cssStack: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" },
  { id: 'inter', label: 'Inter', googleFont: 'Inter:wght@400;600;700;800', cssStack: "'Inter', sans-serif" },
  { id: 'poppins', label: 'Poppins', googleFont: 'Poppins:wght@400;600;700;800', cssStack: "'Poppins', sans-serif" },
  { id: 'space-grotesk', label: 'Space Grotesk', googleFont: 'Space+Grotesk:wght@400;600;700', cssStack: "'Space Grotesk', sans-serif" },
  { id: 'playfair', label: 'Playfair Display', googleFont: 'Playfair+Display:wght@600;700;800', cssStack: "'Playfair Display', serif" },
  { id: 'roboto-slab', label: 'Roboto Slab', googleFont: 'Roboto+Slab:wght@400;600;700', cssStack: "'Roboto Slab', serif" },
]

export function getFontePreset(id: string | undefined): FontePreset {
  return FONTES_PRESET.find((f) => f.id === id) ?? FONTES_PRESET[0]
}
