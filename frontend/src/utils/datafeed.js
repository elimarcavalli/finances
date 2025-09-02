// src/utils/datafeed.js

const API_URL = 'http://localhost:8000/datafeed';

// Mapeia a resolução do TradingView para a do nosso backend
const mapResolution = (resolution) => {
  if (resolution.includes('D')) return '1D';
  if (resolution.includes('W')) return '1W';
  if (resolution.includes('M')) return '1M';
  // Para minutos
  const numericResolution = parseInt(resolution, 10);
  if (!isNaN(numericResolution)) return resolution;
  return '60'; // Padrão
};

export const Datafeed = {
  onReady: (callback) => {
    console.log('[Datafeed] onReady: Buscando configuração...');
    fetch(`${API_URL}/config`)
      .then((res) => res.json())
      .then((config) => {
        console.log('[Datafeed] Configuração recebida:', config);
        setTimeout(() => callback(config), 0);
      })
      .catch((err) => {
        console.error('[Datafeed] Erro ao buscar configuração:', err);
      });
  },

  searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
    // A busca de símbolos não foi implementada no backend de exemplo,
    // então retornamos uma resposta vazia.
    console.log('[Datafeed] searchSymbols:', userInput);
    onResultReadyCallback([]);
  },

  resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
    console.log('[Datafeed] resolveSymbol:', symbolName);
    fetch(`${API_URL}/symbol_info?symbol=${symbolName}`)
      .then((res) => res.json())
      .then((symbolInfo) => {
        console.log('[Datafeed] Símbolo resolvido:', symbolInfo);
        onSymbolResolvedCallback(symbolInfo);
      })
      .catch((err) => {
        console.error('[Datafeed] Erro ao resolver símbolo:', err);
        onResolveErrorCallback('Não foi possível resolver o símbolo.');
      });
  },

  getBars: (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
    const { from, to, firstDataRequest } = periodParams;
    const mappedResolution = mapResolution(resolution);
    
    console.log(`[Datafeed] getBars: ${symbolInfo.name}, ${mappedResolution}, de ${from} para ${to}`);

    const url = new URL(`${API_URL}/history`);
    url.searchParams.append('symbol', symbolInfo.ticker || symbolInfo.name);
    url.searchParams.append('resolution', mappedResolution);
    url.searchParams.append('from', from);
    url.searchParams.append('to', to);

    fetch(url.toString())
      .then((res) => res.json())
      .then((data) => {
        if (data.s === 'no_data' || !data.t || data.t.length === 0) {
          console.log('[Datafeed] Não há dados para o período.');
          onHistoryCallback([], { noData: true });
          return;
        }

        if (data.s === 'ok') {
          const bars = [];
          for (let i = 0; i < data.t.length; i++) {
            bars.push({
              time: data.t[i] * 1000,
              open: data.o[i],
              high: data.h[i],
              low: data.l[i],
              close: data.c[i],
              volume: data.v[i],
            });
          }
          console.log(`[Datafeed] Retornando ${bars.length} barras.`);
          onHistoryCallback(bars, { noData: false });
        } else {
            throw new Error(data.errmsg || 'Erro desconhecido nos dados históricos');
        }
      })
      .catch((err) => {
        console.error('[Datafeed] Erro ao buscar barras:', err);
        onErrorCallback(err.message);
      });
  },

  subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) => {
    // O backend de exemplo não suporta tempo real (streaming), então não fazemos nada aqui.
    console.log('[Datafeed] subscribeBars: Inscrição não suportada pelo backend de exemplo.');
  },

  unsubscribeBars: (subscriberUID) => {
    // O backend de exemplo não suporta tempo real (streaming), então não fazemos nada aqui.
    console.log('[Datafeed] unsubscribeBars');
  },
};