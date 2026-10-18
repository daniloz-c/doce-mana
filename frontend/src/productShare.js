export function productIdFromUrl(href) {
  const value = new URL(href).searchParams.get('produto');
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function productUrl(href, id) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Produto inválido');
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('produto', String(id));
  return url.href;
}

export async function shareProduct(product, href, browser) {
  const url = productUrl(href, product.id);
  if (browser.share) {
    try {
      await browser.share({ title: product.name, text: `Confira ${product.name} na Doce Maná`, url });
      return 'Compartilhamento concluído.';
    } catch (error) {
      if (error.name === 'AbortError') return '';
    }
  }
  if (browser.clipboard?.writeText) {
    await browser.clipboard.writeText(url);
    return 'Link copiado!';
  }
  throw new Error('Copie o link do campo abaixo para compartilhar.');
}
