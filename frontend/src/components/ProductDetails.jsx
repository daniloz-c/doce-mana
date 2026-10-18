import { useEffect, useRef } from 'react';
import { formatPrice, getStockStatus } from '../utils';

export default function ProductDetails({
  product,
  loading,
  error,
  onClose,
  onAdd,
  onShare,
  addingDisabled,
  shareFeedback,
  quantity = 0
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  const stockStatus = product ? getStockStatus(product) : null;

  return (
    <dialog
      ref={dialogRef}
      className="product-dialog"
      aria-labelledby="product-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="product-dialog-content">
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar detalhes do produto"
          onClick={onClose}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <h2 id="product-dialog-title">{product ? product.name : 'Detalhes do produto'}</h2>
        {product ? (
          <>
            {product.image_url && (
              <img className="product-dialog-image" src={product.image_url} alt={product.name} />
            )}
            <span className="eyebrow">{product.category}</span>
            <p>{product.description}</p>
            <strong>{formatPrice(Number(product.price))}</strong>
            <p>{stockStatus.label} — Estoque: {product.stock_quantity ?? 0}</p>
            {quantity > 0 && <p>Na sacola: {quantity}</p>}
          </>
        ) : (
          <p role="status">
            {loading
              ? 'Carregando produto...'
              : typeof error === 'string'
                ? error
                : error?.message || 'Produto não encontrado.'}
          </p>
        )}
        {shareFeedback && (
          <div className="product-share-feedback">
            <p role="status">{shareFeedback.message}</p>
            <input aria-label="Link do produto" readOnly value={shareFeedback.url} onFocus={event => event.target.select()} />
          </div>
        )}
        <div className="product-dialog-actions">
          <button
            type="button"
            className="button button-primary"
            disabled={!product || addingDisabled}
            onClick={() => onAdd(product)}
          >
            Adicionar à sacola
          </button>
          <button
            type="button"
            className="button"
            disabled={!product}
            onClick={() => onShare(product)}
          >
            Compartilhar
          </button>
          <button type="button" className="button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}
