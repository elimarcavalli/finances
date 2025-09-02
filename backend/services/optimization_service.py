import mysql.connector
import json
import random
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime, date
from services.database_service import DatabaseService
import numpy as np
# IMPORTS REMOVIDOS PARA EVITAR PROBLEMAS DE SERIALIZAÇÃO EM ProcessPoolExecutor:
# from services.backtesting_service import BacktestingService
# from services.historical_data_service import HistoricalDataService
from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing
import os

logger = logging.getLogger(__name__)


def _evaluate_individual_parallel(task_data: dict) -> dict:
    """
    Função auxiliar para avaliar um indivíduo em processo paralelo.
    As importações são feitas aqui dentro para evitar erros de serialização (pickle).
    """
    # Passo 1: Importações locais dentro do worker
    from services.historical_data_service import HistoricalDataService
    from services.backtesting_service import BacktestingService
    import logging

    # Configura um logger básico para o processo filho, se necessário
    logger = logging.getLogger(f"worker_{os.getpid()}")

    try:
        # Passo 2: Instanciar os serviços
        historical_data_service = HistoricalDataService()
        backtesting_service = BacktestingService(historical_data_service)
        
        # Passo 3: Executar o backtest
        results = backtesting_service.run_backtest(
            asset_symbol=task_data['asset_symbol'],
            timeframe=task_data['timeframe'],
            start_date=task_data['start_date'],
            end_date=task_data['end_date'],
            base_strategy_name=task_data['base_strategy_name'],
            parameters=task_data['parameters']
        )
        
        return results
        
    except Exception as e:
        # Usar o logger para capturar o erro exato do processo filho
        logger.error(f"Erro fatal no processo de avaliação individual: {str(e)}", exc_info=True)
        # Retornar um resultado de falha
        return {
            'total_trades': 0,
            'win_rate_percent': 0.0,
            'net_profit_percent': -100.0,
            'max_drawdown_percent': 100.0,
            'sharpe_ratio': -10.0,
            'fitness_score': -1000.0
        }


class OptimizationService:
    def __init__(self):
        self.db_service = DatabaseService()
        # Não instanciamos os serviços aqui para evitar problemas de serialização
        # Eles serão instanciados localmente nos workers quando necessário
        self.max_workers = max(1, multiprocessing.cpu_count() // 2)

    def create_optimization_job(self, user_id: int, job_data: dict) -> dict:
        """
        Cria um novo job de otimização de estratégia
        """
        self.db_service.ensure_connection()
        cursor = self.db_service.connection.cursor(dictionary=True)
        
        try:
            # Rollback preventivo para evitar estados residuais
            self.db_service.connection.rollback()
            
            # Validar se o asset existe
            asset_query = "SELECT id FROM assets WHERE id = %s"
            cursor.execute(asset_query, (job_data['asset_id'],))
            if not cursor.fetchone():
                raise ValueError("Asset not found")
            
            # Serializar parameter_ranges como JSON
            parameter_ranges_json = json.dumps(job_data['parameter_ranges'])
            
            query = """
                INSERT INTO strategy_optimization_jobs 
                (user_id, base_strategy_name, asset_id, timeframe, start_date, end_date, parameter_ranges, status) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'PENDING')
            """
            cursor.execute(query, (
                user_id,
                job_data['base_strategy_name'],
                job_data['asset_id'],
                job_data['timeframe'],
                job_data['start_date'],
                job_data['end_date'],
                parameter_ranges_json
            ))
            self.db_service.connection.commit()
            job_id = cursor.lastrowid
            
            # Buscar e retornar o job criado
            cursor.execute("SELECT * FROM strategy_optimization_jobs WHERE id = %s", (job_id,))
            job = cursor.fetchone()
            
            # Deserializar parameter_ranges de volta para dict
            if job and job['parameter_ranges']:
                job['parameter_ranges'] = json.loads(job['parameter_ranges'])
            
            logger.info(f"Optimization job created: {job_id} for user {user_id}")
            return job
            
        except Exception as e:
            self.db_service.connection.rollback()
            logger.error(f"Error creating optimization job: {str(e)}")
            raise e
        finally:
            cursor.close()
    
    def get_optimization_jobs_by_user(self, user_id: int) -> List[dict]:
        """
        Retorna todos os jobs de otimização de um usuário
        """
        print(f"[get_optimization_jobs_by_user] INICIO - user_id: {user_id}")

        self.db_service.ensure_connection()
        cursor = self.db_service.connection.cursor(dictionary=True)
        
        try:
            query = """
                SELECT soj.*, a.symbol as asset_symbol, a.name as asset_name
                FROM strategy_optimization_jobs soj
                JOIN assets a ON soj.asset_id = a.id
                WHERE soj.user_id = %s 
                ORDER BY soj.created_at DESC
            """
            cursor.execute(query, (user_id,))
            jobs = cursor.fetchall()
            # print(f"[get_optimization_jobs_by_user] QUERY EXECUTADA - JOBS: {jobs}")
            
            # Deserializar parameter_ranges para cada job
            for job in jobs:
                if job['parameter_ranges']:
                    job['parameter_ranges'] = json.loads(job['parameter_ranges'])
                else:
                    job['parameter_ranges'] = {}
            
            return jobs
            
        finally:
            cursor.close()
    
    def get_optimization_job_by_id(self, job_id: int, user_id: int) -> Optional[dict]:
        """
        Busca um job de otimização específico por ID
        """
        self.db_service.ensure_connection()
        cursor = self.db_service.connection.cursor(dictionary=True)
        
        try:
            query = """
                SELECT soj.*, a.symbol as asset_symbol, a.name as asset_name
                FROM strategy_optimization_jobs soj
                JOIN assets a ON soj.asset_id = a.id
                WHERE soj.id = %s AND soj.user_id = %s
            """
            cursor.execute(query, (job_id, user_id))
            job = cursor.fetchone()
            
            if job and job['parameter_ranges']:
                job['parameter_ranges'] = json.loads(job['parameter_ranges'])
            
            return job
            
        finally:
            cursor.close()
    
    def update_job_status(self, job_id: int, status: str, completed_at: Optional[datetime] = None, progress: Optional[float] = None) -> None:
        """
        Atualiza o status de um job de otimização
        """
        self.db_service.ensure_connection()
        cursor = self.db_service.connection.cursor()
        
        try:
            if completed_at and progress is not None:
                query = "UPDATE strategy_optimization_jobs SET status = %s, completed_at = %s, progress = %s WHERE id = %s"
                cursor.execute(query, (status, completed_at, progress, job_id))
            elif completed_at:
                query = "UPDATE strategy_optimization_jobs SET status = %s, completed_at = %s WHERE id = %s"
                cursor.execute(query, (status, completed_at, job_id))
            elif progress is not None:
                query = "UPDATE strategy_optimization_jobs SET status = %s, progress = %s WHERE id = %s"
                cursor.execute(query, (status, progress, job_id))
            else:
                query = "UPDATE strategy_optimization_jobs SET status = %s WHERE id = %s"
                cursor.execute(query, (status, job_id))
            
            self.db_service.connection.commit()
            logger.info(f"Job {job_id} status updated to {status}" + (f" with progress {progress}%" if progress is not None else ""))
            
        except Exception as e:
            self.db_service.connection.rollback()
            logger.error(f"Error updating job status: {str(e)}")
            raise e
        finally:
            cursor.close()
    
    def update_job_progress(self, job_id: int, progress: float) -> None:
        """
        Atualiza apenas o progresso de um job
        """
        try:
            # Garantir que o progresso está no range correto
            progress = max(0.0, min(100.0, progress))
            
            self.db_service.ensure_connection()
            cursor = self.db_service.connection.cursor()
            
            query = "UPDATE strategy_optimization_jobs SET progress = %s WHERE id = %s"
            cursor.execute(query, (progress, job_id))
            self.db_service.connection.commit()
            cursor.close()
            
        except Exception as e:
            logger.error(f"Error updating job progress: {str(e)}")
    
    def save_optimization_result(self, job_id: int, parameters: dict, 
                               total_trades: int, win_rate_percent: float,
                               net_profit_percent: float, max_drawdown_percent: float,
                               sharpe_ratio: float, fitness_score: float) -> int:
        """
        Salva um resultado de otimização individual
        """
        self.db_service.ensure_connection()
        cursor = self.db_service.connection.cursor()
        
        try:
            parameters_json = json.dumps(parameters)
            
            query = """
                INSERT INTO optimization_job_results 
                (job_id, parameters, total_trades, win_rate_percent, net_profit_percent, 
                 max_drawdown_percent, sharpe_ratio, fitness_score)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(query, (
                job_id, parameters_json, total_trades, win_rate_percent,
                net_profit_percent, max_drawdown_percent, sharpe_ratio, fitness_score
            ))
            self.db_service.connection.commit()
            result_id = cursor.lastrowid
            
            return result_id
            
        except Exception as e:
            self.db_service.connection.rollback()
            logger.error(f"Error saving optimization result: {str(e)}")
            raise e
        finally:
            cursor.close()
    
    def get_optimization_results(self, job_id: int, user_id: int, limit: int = 100) -> List[dict]:
        """
        Retorna os resultados de otimização ordenados por fitness score
        """
        self.db_service.ensure_connection()
        cursor = self.db_service.connection.cursor(dictionary=True)
        
        try:
            # Verificar se o job pertence ao usuário
            job_check_query = "SELECT id FROM strategy_optimization_jobs WHERE id = %s AND user_id = %s"
            cursor.execute(job_check_query, (job_id, user_id))
            if not cursor.fetchone():
                raise ValueError("Optimization job not found or does not belong to user")
            
            query = """
                SELECT * FROM optimization_job_results 
                WHERE job_id = %s 
                ORDER BY fitness_score DESC 
                LIMIT %s
            """
            cursor.execute(query, (job_id, limit))
            results = cursor.fetchall()
            
            # Deserializar parameters para cada resultado
            for result in results:
                if result['parameters']:
                    result['parameters'] = json.loads(result['parameters'])
            
            return results
            
        finally:
            cursor.close()
    
    def run_genetic_optimization(self, job_id: int) -> None:
        """
        Executa o algoritmo genético para otimização de parâmetros
        """
        logger.info(f"Starting genetic optimization for job {job_id}")

        try:
            # Buscar dados do job
            cursor = self.db_service.connection.cursor(dictionary=True)
            cursor.execute("select soj.*,a.symbol as asset_symbol from strategy_optimization_jobs soj join assets a on a.id = soj.asset_id WHERE soj.id = %s", (job_id,))
            job = cursor.fetchone()
            cursor.close()
            
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            # Atualizar status para RUNNING
            self.update_job_status(job_id, 'RUNNING')
            
            # Deserializar parameter_ranges
            parameter_ranges = json.loads(job['parameter_ranges'])
            
            # Configurações do algoritmo genético
            # EXEMPLO
            POPULATION_SIZE = 20
            GENERATIONS = 10
            MUTATION_RATE = 0.1
            ELITE_SIZE = 2

            # Gerar população inicial
            population = self._generate_initial_population(parameter_ranges, POPULATION_SIZE)
            
            best_fitness = -float('inf')
            best_individual = None
            
            # Evolução por gerações
            for generation in range(GENERATIONS):
                logger.info(f"Generation {generation + 1}/{GENERATIONS}")
                
                # Calcular e atualizar progresso
                progress = ((generation + 1) / GENERATIONS) * 100
                self.update_job_progress(job_id, progress)
                
                # Avaliar fitness de cada indivíduo em paralelo
                fitness_scores = self._evaluate_population_parallel(population, job, job_id)
                
                # Rastrear melhor indivíduo desta geração
                for i, fitness in enumerate(fitness_scores):
                    if fitness['fitness_score'] > best_fitness:
                        best_fitness = fitness['fitness_score']
                        best_individual = population[i].copy()
                
                # Seleção, crossover e mutação para próxima geração
                if generation < GENERATIONS - 1:  # Não evolui na última geração
                    population = self._evolve_population(
                        population, fitness_scores, ELITE_SIZE, MUTATION_RATE, parameter_ranges
                    )
            
            # Atualizar status para COMPLETED com progresso 100%
            self.update_job_status(job_id, 'COMPLETED', datetime.now(), 100.0)
            
            logger.info(f"Genetic optimization completed for job {job_id}")
            logger.info(f"Best fitness: {best_fitness}")
            logger.info(f"Best parameters: {best_individual}")
            
        except Exception as e:
            logger.error(f"Error in genetic optimization: {str(e)}")
            print(f"Error in genetic optimization: {str(e)}")
            self.update_job_status(job_id, 'FAILED')
            raise e
    
    def _generate_initial_population(self, parameter_ranges: dict, population_size: int) -> List[dict]:
        """
        Gera população inicial aleatória dentro dos ranges especificados
        """
        population = []
        
        for _ in range(population_size):
            individual = {}
            for param_name, param_range in parameter_ranges.items():
                if param_range['type'] == 'int':
                    individual[param_name] = random.randint(param_range['min'], param_range['max'])
                elif param_range['type'] == 'float':
                    individual[param_name] = random.uniform(param_range['min'], param_range['max'])
                elif param_range['type'] == 'choice':
                    individual[param_name] = random.choice(param_range['values'])
            
            population.append(individual)
        
        return population
    
    def _evaluate_fitness(self, parameters: dict, job: dict) -> dict:
        """
        Avalia o fitness de um conjunto de parâmetros executando um backtest real.
        """
        try:
            # Chama o serviço de backtest com os dados do job e os parâmetros do indivíduo
            backtest_results = self.backtesting_service.run_backtest(
                asset_symbol=job['asset_symbol'], 
                timeframe=job['timeframe'],
                start_date=job['start_date'],
                end_date=job['end_date'],
                base_strategy_name=job['base_strategy_name'],
                parameters=parameters
            )
            return backtest_results
            
        except Exception as e:
            logger.error(f"Error in fitness evaluation via backtesting service: {str(e)}")
            # Retorna um resultado de erro/penalidade se o serviço de backtest falhar
            return {
                'total_trades': 0,
                'win_rate_percent': 0.0,
                'net_profit_percent': -100.0,
                'max_drawdown_percent': 100.0,
                'sharpe_ratio': -10.0,
                'fitness_score': -1000.0
            }
    
    def _evolve_population(self, population: List[dict], fitness_scores: List[dict], 
                          elite_size: int, mutation_rate: float, parameter_ranges: dict) -> List[dict]:
        """
        Evolui a população usando seleção, crossover e mutação
        """
        # Ordenar população por fitness
        population_fitness = list(zip(population, fitness_scores))
        population_fitness.sort(key=lambda x: x[1]['fitness_score'], reverse=True)
        
        # Manter elite (melhores indivíduos)
        new_population = [individual for individual, _ in population_fitness[:elite_size]]
        
        # Gerar resto da população através de crossover e mutação
        while len(new_population) < len(population):
            # Seleção por torneio
            parent1 = self._tournament_selection(population_fitness, tournament_size=3)
            parent2 = self._tournament_selection(population_fitness, tournament_size=3)
            
            # Crossover
            child = self._crossover(parent1, parent2, parameter_ranges)
            
            # Mutação
            if random.random() < mutation_rate:
                child = self._mutate(child, parameter_ranges)
            
            new_population.append(child)
        
        return new_population
    
    def _tournament_selection(self, population_fitness: List[Tuple], tournament_size: int) -> dict:
        """
        Seleção por torneio para escolher pais para reprodução
        """
        tournament = random.sample(population_fitness, min(tournament_size, len(population_fitness)))
        winner = max(tournament, key=lambda x: x[1]['fitness_score'])
        return winner[0]
    
    def _crossover(self, parent1: dict, parent2: dict, parameter_ranges: dict) -> dict:
        """
        Crossover uniforme entre dois pais
        """
        child = {}
        for param_name in parameter_ranges.keys():
            # 50% chance de herdar de cada pai
            if random.random() < 0.5:
                child[param_name] = parent1[param_name]
            else:
                child[param_name] = parent2[param_name]
        
        return child
    
    def _mutate(self, individual: dict, parameter_ranges: dict) -> dict:
        """
        Mutação de um indivíduo
        """
        mutated = individual.copy()
        
        # Escolher um parâmetro aleatório para mutar
        param_name = random.choice(list(parameter_ranges.keys()))
        param_range = parameter_ranges[param_name]
        
        if param_range['type'] == 'int':
            mutated[param_name] = random.randint(param_range['min'], param_range['max'])
        elif param_range['type'] == 'float':
            mutated[param_name] = random.uniform(param_range['min'], param_range['max'])
        elif param_range['type'] == 'choice':
            mutated[param_name] = random.choice(param_range['values'])
        
        return mutated
    
    def _evaluate_population_parallel(self, population: List[dict], job: dict, job_id: int) -> List[dict]:
        """
        Avalia uma população de indivíduos em paralelo.
        """
        try:
            # Preparar dados para processamento paralelo
            evaluation_tasks = []
            for individual in population:
                task_data = {
                    'parameters': individual,
                    'asset_symbol': job['asset_symbol'],
                    'timeframe': job['timeframe'],
                    'start_date': job['start_date'],
                    'end_date': job['end_date'],
                    'base_strategy_name': job['base_strategy_name']
                }
                evaluation_tasks.append(task_data)
            
            # Executar avaliações em paralelo
            fitness_scores = []
            
            with ProcessPoolExecutor(max_workers=self.max_workers) as executor:
                # Submeter todas as tarefas
                future_to_individual = {
                    executor.submit(_evaluate_individual_parallel, task): i 
                    for i, task in enumerate(evaluation_tasks)
                }
                
                # Coletar resultados conforme completam
                for future in as_completed(future_to_individual):
                    individual_index = future_to_individual[future]
                    try:
                        fitness = future.result()
                        fitness_scores.append((individual_index, fitness))
                        
                        # Salvar resultado no banco
                        self.save_optimization_result(
                            job_id=job_id,
                            parameters=population[individual_index],
                            total_trades=fitness.get('total_trades', 0),
                            win_rate_percent=fitness.get('win_rate_percent', 0.0),
                            net_profit_percent=fitness.get('net_profit_percent', 0.0),
                            max_drawdown_percent=fitness.get('max_drawdown_percent', 0.0),
                            sharpe_ratio=fitness.get('sharpe_ratio', 0.0),
                            fitness_score=fitness.get('fitness_score', 0.0)
                        )
                        
                    except Exception as e:
                        logger.error(f"Error in parallel evaluation: {str(e)}")
                        fitness_scores.append((individual_index, {'fitness_score': -1000}))
            
            # Reorganizar resultados na ordem original
            fitness_scores.sort(key=lambda x: x[0])
            return [fitness for _, fitness in fitness_scores]
            
        except Exception as e:
            logger.error(f"Error in parallel population evaluation: {str(e)}")
            # Fallback para processamento sequencial
            return self._evaluate_population_sequential(population, job, job_id)
    
    def _evaluate_population_sequential(self, population: List[dict], job: dict, job_id: int) -> List[dict]:
        """
        Avalia uma população sequencialmente (fallback).
        """
        fitness_scores = []
        for individual in population:
            try:
                fitness = self._evaluate_fitness(individual, job)
                fitness_scores.append(fitness)
                
                # Salvar resultado no banco
                self.save_optimization_result(
                    job_id=job_id,
                    parameters=individual,
                    total_trades=fitness.get('total_trades', 0),
                    win_rate_percent=fitness.get('win_rate_percent', 0.0),
                    net_profit_percent=fitness.get('net_profit_percent', 0.0),
                    max_drawdown_percent=fitness.get('max_drawdown_percent', 0.0),
                    sharpe_ratio=fitness.get('sharpe_ratio', 0.0),
                    fitness_score=fitness.get('fitness_score', 0.0)
                )
                
            except Exception as e:
                logger.error(f"Error evaluating individual: {str(e)}")
                fitness_scores.append({'fitness_score': -1000})
                
        return fitness_scores
    
    def get_best_parameters(self, job_id: int, user_id: int) -> Optional[dict]:
        """
        Retorna os melhores parâmetros encontrados para um job
        """
        results = self.get_optimization_results(job_id, user_id, limit=1)
        
        if results:
            best_result = results[0]
            return {
                'parameters': best_result['parameters'],
                'performance_metrics': {
                    'total_trades': best_result['total_trades'],
                    'win_rate_percent': best_result['win_rate_percent'],
                    'net_profit_percent': best_result['net_profit_percent'],
                    'max_drawdown_percent': best_result['max_drawdown_percent'],
                    'sharpe_ratio': best_result['sharpe_ratio'],
                    'fitness_score': best_result['fitness_score']
                }
            }
        
        return None