# middleware/error_handler.py

import logging
import traceback
from datetime import datetime
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import json

logger = logging.getLogger(__name__)

class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """
    Middleware para interceptar e logar todos os erros da aplicação.
    Fornece respostas consistentes e logs detalhados.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = datetime.now()
        
        try:
            # Log da requisição
            logger.info(f"Request: {request.method} {request.url}")
            logger.info(f"Headers: {dict(request.headers)}")
            
            # Executar a requisição
            response = await call_next(request)
            
            # Log da resposta
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"Response status: {response.status_code}")
            logger.info(f"Response headers: {dict(response.headers)}")
            logger.info(f"Duration: {duration:.3f}s")
            
            return response
            
        except Exception as exc:
            # Log do erro
            error_id = f"ERR_{int(datetime.now().timestamp())}"
            duration = (datetime.now() - start_time).total_seconds()
            
            logger.error(f"Error ID: {error_id}")
            logger.error(f"Request: {request.method} {request.url}")
            logger.error(f"Duration: {duration:.3f}s")
            logger.error(f"Error: {str(exc)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Determinar o tipo de erro e resposta apropriada
            if isinstance(exc, HTTPException):
                return JSONResponse(
                    status_code=exc.status_code,
                    content={
                        "error": {
                            "type": "HTTPException",
                            "detail": exc.detail,
                            "error_id": error_id,
                            "timestamp": datetime.now().isoformat()
                        }
                    }
                )
            elif isinstance(exc, RequestValidationError):
                return JSONResponse(
                    status_code=422,
                    content={
                        "error": {
                            "type": "ValidationError",
                            "detail": "Dados de entrada inválidos",
                            "errors": exc.errors(),
                            "error_id": error_id,
                            "timestamp": datetime.now().isoformat()
                        }
                    }
                )
            else:
                # Erro interno não tratado
                return JSONResponse(
                    status_code=500,
                    content={
                        "error": {
                            "type": "InternalServerError",
                            "detail": f"Erro interno do servidor. ID: {error_id}",
                            "error_id": error_id,
                            "timestamp": datetime.now().isoformat()
                        }
                    }
                )

class DatabaseErrorHandler:
    """Handler específico para erros de banco de dados."""
    
    @staticmethod
    def handle_database_error(error: Exception, operation: str = "database operation") -> HTTPException:
        """
        Converte erros de banco em HTTPException apropriadas.
        """
        error_msg = str(error).lower()
        
        # Erros de conexão
        if 'connection' in error_msg or 'timeout' in error_msg:
            logger.error(f"Database connection error in {operation}: {error}")
            return HTTPException(
                status_code=503,
                detail=f"Serviço temporariamente indisponível. Tente novamente em alguns instantes."
            )
        
        # Violações de constraint
        elif 'duplicate' in error_msg or 'unique' in error_msg:
            logger.warning(f"Duplicate key error in {operation}: {error}")
            return HTTPException(
                status_code=409,
                detail="Operação não permitida: dados duplicados."
            )
        
        # Violações de foreign key
        elif 'foreign key' in error_msg or 'constraint' in error_msg:
            logger.warning(f"Foreign key constraint error in {operation}: {error}")
            return HTTPException(
                status_code=400,
                detail="Operação não permitida: dados relacionados não existem."
            )
        
        # Erro genérico de banco
        else:
            logger.error(f"Generic database error in {operation}: {error}")
            return HTTPException(
                status_code=500,
                detail=f"Erro interno na operação: {operation}"
            )

class ValidationErrorHandler:
    """Handler específico para erros de validação."""
    
    @staticmethod
    def handle_validation_error(error: Exception, field: str = None) -> HTTPException:
        """
        Converte erros de validação em HTTPException apropriadas.
        """
        if field:
            detail = f"Erro de validação no campo '{field}': {str(error)}"
        else:
            detail = f"Erro de validação: {str(error)}"
        
        logger.warning(f"Validation error: {detail}")
        return HTTPException(status_code=422, detail=detail)

class ServiceErrorHandler:
    """Handler para erros de serviços específicos."""
    
    @staticmethod
    def handle_optimization_error(error: Exception, job_id: int = None) -> HTTPException:
        """Handler específico para erros de otimização."""
        error_msg = str(error).lower()
        
        if 'insufficient data' in error_msg:
            return HTTPException(
                status_code=400,
                detail="Dados históricos insuficientes para executar a otimização."
            )
        elif 'invalid parameters' in error_msg:
            return HTTPException(
                status_code=400,
                detail="Parâmetros de otimização inválidos."
            )
        else:
            logger.error(f"Optimization service error for job {job_id}: {error}")
            return HTTPException(
                status_code=500,
                detail=f"Erro na otimização do job {job_id if job_id else 'desconhecido'}"
            )
    
    @staticmethod
    def handle_historical_data_error(error: Exception, asset_symbol: str = None) -> HTTPException:
        """Handler específico para erros de dados históricos."""
        error_msg = str(error).lower()
        
        if 'not found' in error_msg or '404' in error_msg:
            return HTTPException(
                status_code=404,
                detail=f"Dados não encontrados para o ativo {asset_symbol if asset_symbol else 'especificado'}"
            )
        elif 'rate limit' in error_msg or '429' in error_msg:
            return HTTPException(
                status_code=429,
                detail="Limite de requisições atingido. Tente novamente em alguns instantes."
            )
        elif 'api' in error_msg or 'network' in error_msg:
            return HTTPException(
                status_code=503,
                detail="Serviço de dados temporariamente indisponível."
            )
        else:
            logger.error(f"Historical data service error for {asset_symbol}: {error}")
            return HTTPException(
                status_code=500,
                detail="Erro ao buscar dados históricos"
            )

# Decorator para aplicar tratamento de erro em endpoints
def handle_errors(operation_name: str = "operation"):
    """
    Decorator para aplicar tratamento consistente de erros em endpoints.
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except HTTPException:
                # Re-raise HTTPExceptions (já tratadas)
                raise
            except Exception as e:
                # Log e converter outros erros
                logger.error(f"Error in {operation_name}: {str(e)}")
                logger.error(f"Traceback: {traceback.format_exc()}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Erro interno na operação: {operation_name}"
                )
        return wrapper
    return decorator