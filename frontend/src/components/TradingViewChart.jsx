import React, { useEffect, useRef, useState } from 'react';
import { Card, Text, Alert, Loader, Group, Box } from '@mantine/core';
import { IconAlertCircle, IconChartLine } from '@tabler/icons-react';

/**
 * TradingView Chart Component - Widget Embed Version
 * Using TradingView's free widget embed instead of the paid charting library
 * This approach doesn't require licensing and works out of the box
 */

const TradingViewChart = ({
  symbol = 'BINANCE:BTCUSDT',
  interval = '1D',
  height = 600,
  width = '100%',
  studies = [],
  theme = 'light',
  timezone = 'America/Sao_Paulo'
}) => {
  const containerRef = useRef(null);
  const containerIdRef = useRef(`tradingview_${Math.random().toString(36).slice(2, 9)}`);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const createWidget = () => {
      if (cancelled || !containerRef.current) return;

      try {
        // Adicionar CSS global para forçar tamanho
        const style = document.createElement('style');
        style.textContent = `
          .tradingview-widget-container {
            height: ${height}px !important;
            min-height: ${height}px !important;
          }
          .tradingview-widget-container iframe {
            height: ${height}px !important;
            min-height: ${height}px !important;
            width: 100% !important;
          }
          .tradingview-widget-container__widget {
            height: ${height}px !important;
            min-height: ${height}px !important;
          }
        `;
        document.head.appendChild(style);
        
        // Limpar container
        containerRef.current.innerHTML = '';
        
        // Usar iframe direto para maior controle de tamanho
        const iframe = document.createElement('iframe');
        const params = new URLSearchParams({
          symbol: symbol,
          interval: interval,
          timezone: timezone,
          theme: theme === 'dark' ? 'dark' : 'light',
          style: '1',
          locale: 'br',
          toolbar_bg: '#f1f3f6',
          enable_publishing: false,
          withdateranges: true,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          details: true,
          hotlist: true,
          calendar: true,
          autosize: false,
          width: '100%',
          height: height
        });
        
        iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${encodeURIComponent(symbol)}&interval=${interval}&hidesidetoolbar=0&hidetoptoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=&hideideas=1&theme=${theme}&style=1&timezone=${timezone}&withdateranges=1&showpopupbutton=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=br&utm_medium=widget_new&utm_campaign=chart&utm_term=${encodeURIComponent(symbol)}`;
        
        iframe.style.width = '100%';
        iframe.style.height = `${height}px`;
        iframe.style.border = 'none';
        iframe.style.minHeight = `${height}px`;
        iframe.frameBorder = '0';
        iframe.allowTransparency = 'true';
        iframe.scrolling = 'no';
        iframe.allowFullScreen = true;
        
        // Adicionar iframe diretamente ao container
        containerRef.current.appendChild(iframe);
        
        // Widget carregado
        const timer = setTimeout(() => {
          if (!cancelled) {
            setLoading(false);
            setError(null);
          }
        }, 2000);

        return () => {
          clearTimeout(timer);
          // Remover CSS adicionado
          if (style && style.parentNode) {
            style.parentNode.removeChild(style);
          }
        };

      } catch (err) {
        console.error('Error creating TradingView widget:', err);
        if (!cancelled) {
          setError(err.message || String(err));
          setLoading(false);
        }
      }
    };

    setLoading(true);
    setError(null);
    
    const cleanup = createWidget();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [symbol, interval, JSON.stringify(studies), theme, timezone]);

  return (
    <Card shadow="sm" p="md">
      <Group position="apart" align="center" mb="xs">
        <Group align="center">
          <IconChartLine />
          <Text weight={600}>Chart</Text>
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle />} title="Erro no gráfico" color="red" mb="md">
          {String(error)}
        </Alert>
      )}

      <Box sx={{ width: width, height: height, position: 'relative', minHeight: height }}>
        <div ref={containerRef} id={containerIdRef.current} style={{ width: '100%', height: '100%', minHeight: `${height}px` }} />

        {loading && (
          <Group position="center" style={{ position: 'absolute', inset: 0 }}>
            <Loader size="lg" />
            <Text c="dimmed">Inicializando TradingView...</Text>
          </Group>
        )}
      </Box>

      <Text size="xs" c="dimmed" mt="xs" ta="center">
        Powered by TradingView - Dados em tempo real
      </Text>
    </Card>
  );
};

export default TradingViewChart;