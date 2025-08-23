#!/usr/bin/env python3
"""
Worker de Snapshots Diários
Script projetado para ser executado periodicamente (ex: via cron job, uma vez por dia)
Responsável por criar snapshots de patrimônio líquido para todos os usuários do sistema
"""

import sys
import os
import logging
from datetime import datetime
from typing import List

# Adicionar o diretório backend ao Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.database_service import DatabaseService
from services.summary_service import SummaryService

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/snapshot_worker.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class SnapshotWorker:
    def __init__(self):
        """
        Inicializa o worker com os serviços necessários
        """
        self.db_service = DatabaseService()
        self.summary_service = SummaryService(self.db_service)
    
    def get_all_users(self) -> List[dict]:
        """
        Busca todos os usuários ativos do sistema
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        
        try:
            cursor.execute("""
                SELECT id, user_name, email 
                FROM users 
                WHERE user_level >= 1
                ORDER BY id
            """)
            
            users = cursor.fetchall()
            logger.info(f"Encontrados {len(users)} usuários no sistema")
            return users
            
        except Exception as e:
            logger.error(f"Erro ao buscar usuários: {e}")
            return []
        finally:
            cursor.close()
    
    def create_snapshot_for_user(self, user_id: int, user_name: str) -> dict:
        """
        Cria um snapshot diário para um usuário específico
        """
        try:
            logger.info(f"Criando snapshot para usuário {user_name} (ID: {user_id})")
            
            result = self.summary_service.create_daily_snapshot(user_id)
            
            if result.get('success'):
                logger.info(f"Snapshot criado para {user_name}: R$ {result['total_net_worth']:.2f}")
                return {
                    'user_id': user_id,
                    'user_name': user_name,
                    'success': True,
                    'net_worth': result['total_net_worth'],
                    'breakdown': result['breakdown']
                }
            else:
                logger.error(f"Falha ao criar snapshot para {user_name}")
                return {
                    'user_id': user_id,
                    'user_name': user_name,
                    'success': False,
                    'error': 'Snapshot creation failed'
                }
                
        except Exception as e:
            logger.error(f"Erro ao criar snapshot para {user_name} (ID: {user_id}): {e}")
            return {
                'user_id': user_id,
                'user_name': user_name,
                'success': False,
                'error': str(e)
            }
    
    def run_daily_snapshots(self) -> dict:
        """
        Executa a criação de snapshots para todos os usuários
        """
        start_time = datetime.now()
        logger.info(f"Iniciando processo de snapshots diários - {start_time}")
        
        # Obter todos os usuários
        users = self.get_all_users()
        
        if not users:
            logger.warning("Nenhum usuário encontrado para processar")
            return {
                'success': False,
                'message': 'Nenhum usuário encontrado',
                'processed': 0,
                'successful': 0,
                'failed': 0
            }
        
        # Processar cada usuário
        results = []
        successful_count = 0
        failed_count = 0
        
        for user in users:
            try:
                result = self.create_snapshot_for_user(user['id'], user['user_name'])
                results.append(result)
                
                if result['success']:
                    successful_count += 1
                else:
                    failed_count += 1
                    
            except Exception as e:
                logger.error(f"Erro geral ao processar usuário {user['user_name']}: {e}")
                failed_count += 1
                results.append({
                    'user_id': user['id'],
                    'user_name': user['user_name'],
                    'success': False,
                    'error': f'Erro geral: {str(e)}'
                })
        
        # Calcular estatísticas finais
        end_time = datetime.now()
        duration = end_time - start_time
        
        summary = {
            'success': failed_count == 0,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'duration_seconds': duration.total_seconds(),
            'processed': len(users),
            'successful': successful_count,
            'failed': failed_count,
            'results': results
        }
        
        # Log final
        logger.info(f"Processo concluído em {duration.total_seconds():.2f}s")
        logger.info(f"Total: {len(users)} | Sucesso: {successful_count} | Falhas: {failed_count}")
        
        if failed_count > 0:
            logger.warning(f"{failed_count} usuários falharam no processo de snapshot")
            for result in results:
                if not result['success']:
                    logger.error(f"   - {result['user_name']}: {result.get('error', 'Erro desconhecido')}")
        
        return summary
    
    def cleanup(self):
        """
        Limpa recursos e fecha conexões
        """
        try:
            if hasattr(self.db_service, 'connection') and self.db_service.connection:
                self.db_service.connection.close()
                logger.info("Conexão com banco de dados fechada")
        except Exception as e:
            logger.error(f"Erro ao fechar conexão: {e}")

def main():
    """
    Função principal do worker
    """
    worker = None
    
    try:
        logger.info("=" * 50)
        logger.info("INICIANDO SNAPSHOT WORKER")
        logger.info("=" * 50)
        
        worker = SnapshotWorker()
        result = worker.run_daily_snapshots()
        
        # Exibir resultado final
        if result['success']:
            print(f"Processo concluído com sucesso!")
            print(f"{result['successful']}/{result['processed']} usuários processados")
        else:
            print(f"Processo concluído com falhas!")
            print(f"{result['successful']}/{result['processed']} usuários processados com sucesso")
            print(f"{result['failed']} falhas encontradas")
            
        return 0 if result['success'] else 1
        
    except KeyboardInterrupt:
        logger.info("Processo interrompido pelo usuário")
        return 1
    except Exception as e:
        logger.error(f"Erro crítico no worker: {e}")
        return 1
    finally:
        if worker:
            worker.cleanup()
        logger.info("=" * 50)
        logger.info("SNAPSHOT WORKER FINALIZADO")
        logger.info("=" * 50)

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)