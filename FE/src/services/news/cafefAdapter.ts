import type { QuantNewsItem } from '../../data/quantData';
import { API_BASE } from '../../api/client';

export const fetchCafeFNews = async (): Promise<QuantNewsItem[]> => {
  const res = await fetch(`${API_BASE}/quant/dashboard`);
  const data = await res.json();
  return (data.stocks ?? []).flatMap((stock: { news?: QuantNewsItem[] }) =>
    (stock.news ?? []).filter((item) => item.source === 'cafef')
  );
};
