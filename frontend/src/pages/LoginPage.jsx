import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, TextInput, PasswordInput, Button, Title, Alert, Stack, Center } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import api from '../api';
import { setAuthToken } from '../utils/auth';

export function LoginPage() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const form = useForm({
        initialValues: { username: '', password: '' },
        validate: {
            username: (value) => (value.length < 2 ? 'Nome de usuário muito curto' : null),
            password: (value) => (value.length < 4 ? 'Senha muito curta' : null),
        },
    });

    const handleLogin = async (values) => {
        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('username', values.username);
            formData.append('password', values.password);

            const response = await api.post('/login', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            setAuthToken(response.data.access_token);
            navigate('/');
        } catch (err) {
            setError('Credenciais inválidas. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Center style={{ minHeight: '100vh' }}>
            <Card shadow="md" p="xl" radius="md" style={{ width: 400 }}>
                <Stack>
                    <Title order={2} ta="center">Login</Title>
                    
                    {error && (
                        <Alert icon={<IconAlertCircle size="1rem" />} color="red">
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={form.onSubmit(handleLogin)}>
                        <TextInput
                            label="Nome de usuário"
                            {...form.getInputProps('username')}
                            mb="sm"
                        />
                        <PasswordInput
                            label="Senha"
                            {...form.getInputProps('password')}
                            mb="md"
                        />
                        <Button 
                            type="submit" 
                            fullWidth 
                            loading={loading}
                        >
                            Entrar
                        </Button>
                    </form>
                </Stack>
            </Card>
        </Center>
    );
}