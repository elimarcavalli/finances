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
        message = 'Não autorizado. Faça login novamente.';
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
 * Valida se uma resposta de API é válida
 * @param {Object} response - Resposta da API
 * @returns {boolean} - Se a resposta é válida
 */
export const isValidApiResponse = (response) => {
  return response && response.data && typeof response.data === 'object';
};