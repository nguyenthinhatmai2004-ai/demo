import type { QuantNewsItem } from '../../data/quantData';

const API_BASE = 'http://127.0.0.1:8001/api';

export const fetchVietstockNews = async (): Promise<QuantNewsItem[]> => {
  const res = await fetch(`${API_BASE}/quant/dashboard`);
  const data = await res.json();
  return (data.stocks ?? []).flatMap((stock: { news?: QuantNewsItem[] }) =>
    (stock.news ?? []).filter((item) => item.source === 'vietstock')
  );
};
