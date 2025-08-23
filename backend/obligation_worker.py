"""
Worker de Obrigações Recorrentes
Gera automaticamente instâncias de obrigações baseadas nas regras de recorrência
Deve ser executado periodicamente (ex: diariamente via cron job)
"""

import logging
import mysql.connector
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta
from typing import List, Dict, Any
from services.database_service import DatabaseService
from services.obligation_service import ObligationService
from services.transaction_service import TransactionService

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ObligationWorker:
    def __init__(self):
        self.db_service = DatabaseService()
        self.transaction_service = TransactionService(self.db_service)
        self.obligation_service = ObligationService(self.db_service, self.transaction_service)
    
    def generate_future_obligations(self, days_ahead: int = 60) -> Dict[str, Any]:
        """
        FUNÇÃO PRINCIPAL: Gera obrigações futuras baseadas nas regras de recorrência
        
        Args:
            days_ahead: Quantos dias no futuro gerar obrigações
            
        Returns:
            dict: Relatório da execução com estatísticas
        """
        logger.info(f"Iniciando geração de obrigações futuras para os próximos {days_ahead} dias")
        
        report = {
            'execution_date': datetime.now().isoformat(),
            'days_ahead': days_ahead,
            'rules_processed': 0,
            'obligations_generated': 0,
            'obligations_skipped': 0,
            'errors': []
        }
        
        try:
            # 1. Buscar todas as regras de recorrência ativas
            active_rules = self._get_active_recurring_rules()
            report['rules_processed'] = len(active_rules)
            
            logger.info(f"Encontradas {len(active_rules)} regras de recorrência ativas")
            
            # 2. Processar cada regra individualmente
            for rule in active_rules:
                try:
                    generated_count = self._process_recurring_rule(rule, days_ahead)
                    report['obligations_generated'] += generated_count
                    
                    logger.info(f"Regra '{rule['description']}' gerou {generated_count} obrigações")
                    
                except Exception as e:
                    error_msg = f"Erro processando regra {rule['id']} ({rule['description']}): {str(e)}"
                    logger.error(error_msg)
                    report['errors'].append(error_msg)
            
            # 3. Atualizar status de obrigações vencidas
            overdue_count = self.obligation_service.update_overdue_status()
            logger.info(f"Atualizadas {overdue_count} obrigações para status OVERDUE")
            
            logger.info(f"Worker concluído: {report['obligations_generated']} obrigações geradas")
            return report
            
        except Exception as e:
            error_msg = f"Erro geral no worker: {str(e)}"
            logger.error(error_msg)
            report['errors'].append(error_msg)
            return report
    
    def _get_active_recurring_rules(self) -> List[Dict]:
        """
        Busca todas as regras de recorrência ativas
        """
        cursor = self.db_service.connection.cursor(dictionary=True)
        try:
            cursor.execute("""
                SELECT * FROM recurring_rules 
                WHERE is_active = TRUE 
                AND (end_date IS NULL OR end_date >= CURDATE())
                ORDER BY user_id, id
            """)
            
            return cursor.fetchall()
            
        except mysql.connector.Error as err:
            raise Exception(f"Erro ao buscar regras de recorrência: {err}")
        finally:
            cursor.close()
    
    def _process_recurring_rule(self, rule: Dict, days_ahead: int) -> int:
        """
        Processa uma regra de recorrência específica
        
        Returns:
            int: Número de obrigações geradas para esta regra
        """
        user_id = rule['user_id']
        rule_id = rule['id']
        
        # Calcular datas futuras baseadas na frequência
        future_dates = self._calculate_future_dates(rule, days_ahead)
        
        obligations_generated = 0
        
        for future_date in future_dates:
            # Verificar se já existe obrigação para esta data
            if not self._obligation_exists_for_date(rule_id, future_date):
                # Criar nova obrigação
                self._create_obligation_from_rule(rule, future_date)
                obligations_generated += 1
            
        return obligations_generated
    
    def _calculate_future_dates(self, rule: Dict, days_ahead: int) -> List[date]:
        """
        Calcula as próximas datas de vencimento baseadas na regra de recorrência
        """
        frequency = rule['frequency']
        interval_value = rule['interval_value']
        start_date = rule['start_date']
        end_date = rule['end_date']
        
        today = date.today()
        limit_date = today + timedelta(days=days_ahead)
        
        # Determinar próxima data a partir de hoje
        current_date = max(start_date, today)
        
        dates = []
        
        while current_date <= limit_date:
            # Verificar se não passou da data limite da regra
            if end_date and current_date > end_date:
                break
                
            dates.append(current_date)
            
            # Calcular próxima data baseada na frequência
            if frequency == 'DAILY':
                current_date += timedelta(days=interval_value)
            elif frequency == 'WEEKLY':
                current_date += timedelta(weeks=interval_value)
            elif frequency == 'MONTHLY':
                current_date += relativedelta(months=interval_value)
            elif frequency == 'YEARLY':
                current_date += relativedelta(years=interval_value)
            else:
                raise ValueError(f"Frequência inválida: {frequency}")
        
        return dates
    
    def _obligation_exists_for_date(self, rule_id: int, target_date: date) -> bool:
        """
        Verifica se já existe uma obrigação para esta regra nesta data
        """
        cursor = self.db_service.connection.cursor()
        try:
            cursor.execute("""
                SELECT COUNT(*) FROM financial_obligations 
                WHERE recurring_rule_id = %s AND due_date = %s
            """, (rule_id, target_date))
            
            count = cursor.fetchone()[0]
            return count > 0
            
        except mysql.connector.Error as err:
            raise Exception(f"Erro verificando existência de obrigação: {err}")
        finally:
            cursor.close()
    
    def _create_obligation_from_rule(self, rule: Dict, due_date: date) -> None:
        """
        Cria uma nova obrigação baseada na regra de recorrência
        """
        obligation_data = {
            'description': rule['description'],
            'amount': rule['amount'],
            'due_date': due_date,
            'type': rule['type'],
            'status': 'PENDING',
            'category': rule['category'],
            'entity_name': rule['entity_name'],
            'notes': f"Gerada automaticamente pela regra de recorrência",
            'recurring_rule_id': rule['id']
        }
        
        try:
            self.obligation_service.create_obligation(rule['user_id'], obligation_data)
            logger.debug(f"Obrigação criada: {rule['description']} para {due_date}")
            
        except Exception as e:
            raise Exception(f"Erro criando obrigação da regra {rule['id']}: {str(e)}")

def run_worker():
    """
    Função principal para executar o worker
    Pode ser chamada por cron job ou script manual
    """
    try:
        worker = ObligationWorker()
        report = worker.generate_future_obligations()
        
        print("=== RELATÓRIO DO WORKER DE OBRIGAÇÕES ===")
        print(f"Execução: {report['execution_date']}")
        print(f"Regras processadas: {report['rules_processed']}")
        print(f"Obrigações geradas: {report['obligations_generated']}")
        print(f"Obrigações ignoradas: {report['obligations_skipped']}")
        
        if report['errors']:
            print(f"Erros encontrados: {len(report['errors'])}")
            for error in report['errors']:
                print(f"  - {error}")
        else:
            print("Execução completada sem erros!")
            
        return report
        
    except Exception as e:
        print(f"ERRO CRÍTICO no worker: {str(e)}")
        return {'success': False, 'error': str(e)}

if __name__ == "__main__":
    # Executar worker quando script for chamado diretamente
    run_worker()