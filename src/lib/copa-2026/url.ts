export function montarLinkWhatsApp(
  phone: string,
  flowId: string,
  texto: string,
): string {
  const text = encodeURIComponent(texto)
  return `https://wa.pulse.is/${phone}?start=${flowId}&text=${text}`
}
