import { quantStocks } from '../../data/quantData';
import type { QuantNewsItem } from '../../data/quantData';

export const fetchVietstockNews = async (): Promise<QuantNewsItem[]> =>
  quantStocks.flatMap((stock) => stock.news.filter((item) => item.source === 'vietstock'));
