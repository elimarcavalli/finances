import React from 'react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';


/**
 * Manipula erros de API de forma padronizada
 * @param {Error} error - Objeto de erro
 * @param {string} fallbackMessage - Mensagem de fallback se não conseguir extrair do erro
 * @param {boolean} showNotification - Se deve mostrar notificação automática
 */
export const handleApiError = (error, fallbackMessage = 'Ocorreu um erro inesperado', showNotification = true) => {
  console.error('API Error:', error);
  
  let message = fallbackMessage;
  let title = 'Erro';
  
  // Tentar extrair mensagem mais específica do erro
  if (error.response) {
    // Erro com resposta do servidor
    const { status, data } = error.response;
    
    if (status >= 400 && status < 500) {
      title = 'Erro de Validação';
      
      if (data?.detail) {
        message = data.detail;
      } else if (data?.error) {
        message = data.error;
      } else if (status === 400) {
        message = 'Dados inválidos fornecidos';
      } else if (status === 401) {
        message = 'Sessão expirada. Por favor, atualize a página e faça login novamente.';
        title = 'Sessão Expirada';
        // Optional: Clear any stored auth tokens
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
        }
      } else if (status === 403) {
        message = 'Acesso negado';
      } else if (status === 404) {
        message = 'Recurso não encontrado';
      }
    } else if (status >= 500) {
      title = 'Erro do Servidor';
      message = data?.detail || 'Erro interno do servidor. Tente novamente.';
    }
  } else if (error.request) {
    // Erro de rede/conexão
    title = 'Erro de Conexão';
    message = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
  } else {
    // Outros erros
    title = 'Erro';
    message = error.message || fallbackMessage;
  }
  
  if (showNotification) {
    notifications.show({
      title,
      message,
      color: 'red',
      icon: React.createElement(IconX, { size: "1rem" }),
      autoClose: 5000,
    });
  }
  
  return { title, message, status: error.response?.status };
};

/**
 * Manipula sucesso de operações
 * @param {string} message - Mensagem de sucesso
 * @param {string} title - Título da notificação
 */
export const handleApiSuccess = (message, title = 'Sucesso') => {
  notifications.show({
    title,
    message,
    color: 'green',
    autoClose: 3000,
  });
};

/**
 * Wrapper para chamadas de API que aplica tratamento de erro automaticamente
 * @param {Function} apiCall - Função que faz a chamada de API
 * @param {string} errorMessage - Mensagem de erro customizada
 * @param {Function} onError - Callback adicional em caso de erro
 */
export const withErrorHandling = async (apiCall, errorMessage, onError = null) => {
  try {
    return await apiCall();
  } catch (error) {
    const errorInfo = handleApiError(error, errorMessage);
    
    if (onError) {
      onError(errorInfo);
    }
    
    throw error; // Re-throw para permitir handling adicional se necessário
  }
};

/**
 * Wrapper silencioso para chamadas de API que NÃO re-throw erros
 * Usado para operações de carregamento de dados onde falhas não devem quebrar o componente
 * @param {Function} apiCall - Função que faz a chamada de API
 * @param {string} errorMessage - Mensagem de erro customizada
 * @param {Function} onError - Callback adicional em caso de erro
 * @param {boolean} showNotification - Se deve mostrar notificação de erro
 */
export const withErrorHandlingSilent = async (apiCall, errorMessage, onError = null, showNotification = false) => {
  try {
    return await apiCall();
  } catch (error) {
    console.error('Silent API Error:', error);
    const errorInfo = handleApiError(error, errorMessage, showNotification);
    
    if (onError) {
      onError(errorInfo);
    }
    
    // NÃO re-throw o erro - permite que o componente continue funcionando
    return null;
  }
};

/**
 * Circuit Breaker para prevenir cascatas de chamadas de API falhadas
 */
class CircuitBreaker {
  constructor(failureThreshold = 3, recoveryTimeout = 30000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }
  
  async execute(apiCall) {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - API calls temporarily blocked');
      }
    }
    
    try {
      const result = await apiCall();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

export const apiCircuitBreaker = new CircuitBreaker();

/**
 * Verifica se a resposta da API tem erro de autenticação e trata especificamente
 * @param {Response} response - Objeto Response do fetch
 * @returns {Response} - Mesmo objeto response se não há erro 401
 * @throws {Error} - Erro específico para 401
 */
export const checkAuthResponse = (response) => {
  if (response.status === 401) {
    // Limpar tokens salvos
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
    }
    
    // Mostrar notificação específica
    notifications.show({
      title: 'Sessão Expirada',
      message: 'Sua sessão expirou. Por favor, atualize a página e faça login novamente.',
      color: 'orange',
      icon: React.createElement(IconX, { size: "1rem" }),
      autoClose: 8000,
    });
    
    throw new Error('HTTP 401 - Unauthorized');
  }
  
  return response;
};

/**
 * Valida se uma resposta de API é válida
 * @param {Object} response - Resposta da API
 * @returns {boolean} - Se a resposta é válida
 */
export const isValidApiResponse = (response) => {
  return response && response.data && typeof response.data === 'object';
};