import React, { forwardRef } from 'react';
import { Group, Text, Badge, Avatar } from '@mantine/core';
import { formatCurrency } from '../utils/formatters';
import { getAssetClassColor } from '../utils/assetUtils';

const AssetSelectItem = forwardRef(({ 
  icon_url, 
  symbol, 
  name, 
  asset_class, 
  last_price_brl, 
  last_price_updated_at,
  ...others 
}, ref) => (
  <div ref={ref} {...others} style={{ padding: '8px 12px' }}>
    <Group noWrap>
      <Avatar 
        src={icon_url} 
        size="md" 
        radius="sm"
        style={{
          border: '1px solid var(--mantine-color-gray-3)',
          background: 'var(--mantine-color-gray-0)'
        }}
      />
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <Group position="apart" noWrap>
          <div>
            <Text size="sm" weight={600} style={{ lineHeight: 1.2 }}>
              {symbol}
            </Text>
            <Text 
              size="xs" 
              color="dimmed" 
              truncate 
              style={{ maxWidth: '200px' }}
            >
              {name}
            </Text>
          </div>
          
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <Badge 
              size="xs" 
              color={getAssetClassColor(asset_class)} 
              variant="light"
              style={{ marginBottom: '2px' }}
            >
              {asset_class}
            </Badge>
            {last_price_brl && (
              <Text size="xs" color="green" weight={600}>
                R$ {formatCurrency(last_price_brl)}
              </Text>
            )}
          </div>
        </Group>
      </div>
    </Group>
  </div>
));

AssetSelectItem.displayName = 'AssetSelectItem';

export default AssetSelectItem;