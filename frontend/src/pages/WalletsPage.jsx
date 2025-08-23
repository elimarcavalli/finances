import React, { useState, useEffect, useCallback } from 'react';
import { Title, Grid, Stack, Card, TextInput, PasswordInput, Button, Table, Text, Paper } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck, IconX } from '@tabler/icons-react';
import api from '../api';

export function WalletsPage() {
    const [wallets, setWallets] = useState([]);
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [details, setDetails] = useState({ balance: null, transactions: [] });

    const form = useForm({
        initialValues: { name: '', public_address: '', private_key: '' },
        validate: {
            name: (value) => (value.length < 2 ? 'Nome muito curto' : null),
            public_address: (value) => (/^0x[a-fA-F0-9]{40}$/.test(value) ? null : 'Endereço inválido'),
        },
    });

    const fetchWallets = useCallback(async () => {
        const response = await api.get('/wallets');
        setWallets(response.data);
    }, []);

    useEffect(() => {
        fetchWallets();
    }, [fetchWallets]);

    useEffect(() => {
        if (!selectedWallet) return;
        const fetchDetails = async () => {
            const balanceRes = await api.get(`/wallet/${selectedWallet.public_address}/balance`);
            const txRes = await api.get(`/wallet/${selectedWallet.public_address}/transactions`);
            setDetails({ balance: balanceRes.data.balance_matic, transactions: txRes.data.transactions.slice(0, 5) });
        };
        fetchDetails();
    }, [selectedWallet]);

    const handleAddWallet = async (values) => {
        await api.post('/wallets', values);
        fetchWallets();
        form.reset();
    };

    const rows = wallets.map((wallet) => (
        <tr key={wallet.id} onClick={() => setSelectedWallet(wallet)} style={{ cursor: 'pointer' }}>
            <td>{wallet.name}</td>
            <td>{wallet.public_address}</td>
        </tr>
    ));

    return (
        <Stack>
            <Title order={2}>Gerenciamento de Carteiras</Title>
            <Grid>
                <Grid.Col span={5}>
                    <Card shadow="sm" p="lg" radius="md" withBorder>
                        <Title order={4}>Adicionar Nova Carteira</Title>
                        <form onSubmit={form.onSubmit(handleAddWallet)}>
                            <TextInput mt="sm" label="Nome da Carteira" {...form.getInputProps('name')} />
                            <TextInput mt="sm" label="Endereço Público" {...form.getInputProps('public_address')} />
                            <PasswordInput mt="sm" label="Chave Privada (opcional para carteiras somente leitura)" {...form.getInputProps('private_key')} />
                            <Button type="submit" mt="md">Salvar Carteira</Button>
                        </form>
                    </Card>
                </Grid.Col>
                <Grid.Col span={7}>
                     <Card shadow="sm" p="lg" radius="md" withBorder>
                         <Title order={4}>Carteiras Gerenciadas</Title>
                         <Table highlightOnHover mt="md">
                             <thead><tr><th>Nome</th><th>Endereço</th></tr></thead>
                             <tbody>{rows}</tbody>
                         </Table>
                     </Card>
                </Grid.Col>
            </Grid>
            {selectedWallet && (
                <Paper shadow="sm" p="lg" radius="md" withBorder>
                    <Title order={4}>Detalhes de: {selectedWallet.name}</Title>
                    <Text>Saldo: {details.balance ?? 'Carregando...'} MATIC</Text>
                    <Text mt="sm">Últimas Transações:</Text>
                     <ul>{details.transactions.map(tx => <li key={tx.hash}><a href={`https://polygonscan.com/tx/${tx.hash}`} target="_blank">{tx.hash.substring(0, 30)}...</a></li>)}</ul>
                </Paper>
            )}
        </Stack>
    );
}