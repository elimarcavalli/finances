import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { DatesProvider } from '@mantine/dates';
import { HashRouter } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { polygon } from '@reown/appkit/networks';
import App from './App';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/spotlight/styles.css';
import 'dayjs/locale/pt-br';

const projectId = '2f05ae7f1116030fde2d36508f472bfb';

const metadata = {
  name: 'finances',
  description: 'Advanced Financial System + Crypto Trading Bot with Web3 and AI',
  url: 'http://localhost:5174',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

const networks = [polygon];
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  metadata,
  projectId,
  features: {
    analytics: true,
    onramp: false
  }
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <MantineProvider 
            defaultColorScheme="dark"
            theme={{
              defaultRadius: 'md',
              spacing: {
                xs: '8px',
                sm: '12px',
                md: '16px',
                lg: '20px',
                xl: '32px'
              }
            }}
          >
            <DatesProvider settings={{ locale: 'pt-br', firstDayOfWeek: 0, weekendDays: [0, 6] }}>
              <Notifications />
              <App />
            </DatesProvider>
          </MantineProvider>
        </HashRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
