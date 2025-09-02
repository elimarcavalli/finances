import { useEffect, useRef, useCallback } from 'react';
import { withErrorHandlingSilent } from '../utils/errorHandler.js';
import api from '../api';

/**
 * Custom hook para polling inteligente de jobs de otimização
 * @param {Array} jobs - Lista de jobs para monitorar
 * @param {Function} onJobUpdate - Callback chamado quando um job é atualizado
 * @param {number} interval - Intervalo de polling em milissegundos (default: 5000)
 */
export const useJobPolling = (jobs = [], onJobUpdate = () => {}, interval = 5000) => {
  const intervalRef = useRef(null);
  const isPollingRef = useRef(false);
  
  // Função para buscar status de um job específico
  const fetchJobStatus = useCallback(async (jobId) => {
    try {
      const response = await api.get(`/strategy-optimization/jobs/${jobId}/status`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching job ${jobId} status:`, error);
      return null;
    }
  }, []);
  
  // Função para buscar status de múltiplos jobs
  const fetchMultipleJobsStatus = useCallback(async (jobIds) => {
    try {
      const promises = jobIds.map(id => fetchJobStatus(id));
      const results = await Promise.allSettled(promises);
      
      const updates = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          updates.push({
            jobId: jobIds[index],
            data: result.value
          });
        }
      });
      
      return updates;
    } catch (error) {
      console.error('Error fetching multiple jobs status:', error);
      return [];
    }
  }, [fetchJobStatus]);
  
  // Função principal de polling
  const pollJobs = useCallback(async () => {
    if (!jobs || jobs.length === 0) return;
    
    // Filtrar apenas jobs que estão RUNNING
    const runningJobs = jobs
      .filter(job => job.status === 'RUNNING')
      .map(job => job.id);
    
    if (runningJobs.length === 0) {
      // Se não há jobs rodando, parar o polling
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        isPollingRef.current = false;
      }
      return;
    }
    
    // Buscar atualizações dos jobs em execução
    const updates = await fetchMultipleJobsStatus(runningJobs);
    
    // Processar atualizações
    updates.forEach(({ jobId, data }) => {
      const currentJob = jobs.find(job => job.id === jobId);
      
      // Verificar se houve mudanças significativas
      if (currentJob && (
        currentJob.status !== data.status ||
        currentJob.progress !== data.progress ||
        (data.status === 'COMPLETED' && !currentJob.completed_at)
      )) {
        onJobUpdate(jobId, data);
      }
    });
    
  }, [jobs, fetchMultipleJobsStatus, onJobUpdate]);
  
  // Função para iniciar polling
  const startPolling = useCallback(() => {
    if (isPollingRef.current) return; // Já está fazendo polling
    
    // Verificar se há jobs que precisam de monitoramento
    const hasRunningJobs = jobs && jobs.some(job => job.status === 'RUNNING');
    if (!hasRunningJobs) return;
    
    isPollingRef.current = true;
    intervalRef.current = setInterval(pollJobs, interval);
    
    // Fazer uma primeira verificação imediata
    pollJobs();
  }, [jobs, pollJobs, interval]);
  
  // Função para parar polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);
  
  // Função para forçar uma verificação imediata
  const checkNow = useCallback(() => {
    pollJobs();
  }, [pollJobs]);
  
  // Effect para gerenciar o ciclo de vida do polling
  useEffect(() => {
    // Iniciar polling se há jobs rodando
    const hasRunningJobs = jobs && jobs.some(job => job.status === 'RUNNING');
    
    if (hasRunningJobs && !isPollingRef.current) {
      startPolling();
    } else if (!hasRunningJobs && isPollingRef.current) {
      stopPolling();
    }
    
    // Cleanup ao desmontar
    return () => {
      stopPolling();
    };
  }, [jobs, startPolling, stopPolling]);
  
  // Effect para detectar mudanças no array de jobs
  useEffect(() => {
    // Se jobs mudaram e temos jobs rodando, reiniciar polling
    const hasRunningJobs = jobs && jobs.some(job => job.status === 'RUNNING');
    
    if (hasRunningJobs) {
      stopPolling();
      startPolling();
    }
  }, [jobs?.length, startPolling, stopPolling]);
  
  return {
    isPolling: isPollingRef.current,
    startPolling,
    stopPolling,
    checkNow
  };
};